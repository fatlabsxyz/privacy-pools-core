/**
 * Service for handling batch relay operations
 */
import crypto from "crypto";
import { getAddress } from "viem";
import { WithdrawalProof } from "@0xbow/privacy-pools-core-sdk";
import { 
  decodeBatchRelayData, 
  calculateBatchFees 
} from "../utils/batchRelayEncoder.js";
import {
  getBatchRelayerAddress,
  getFeeReceiverAddress,
  getMaxRelayFeeBPS,
} from "../config/index.js";
import {
  RelayerError,
  WithdrawalValidationError,
  ZkError,
  BlockchainError,
  ErrorCode,
} from "../exceptions/base.exception.js";
import { BatchWithdrawalPayload } from "../interfaces/relayer/batchRequest.js";
import { RelayerResponse } from "../interfaces/relayer/request.js";
import { web3Provider, SdkProvider, db } from "../providers/index.js";
import { parseSignals } from "../utils.js";
import { RelayerDatabase } from "../types/db.types.js";
import { SdkProviderInterface } from "../types/sdk.types.js";
import { Web3Provider } from "../providers/web3.provider.js";

/**
 * Service for processing batch relay requests
 */
export class BatchRelayService {
  /** Database instance for storing and updating request states. */
  protected db: RelayerDatabase;
  /** SDK provider for handling contract interactions. */
  protected sdkProvider: SdkProviderInterface;
  /** Web3 provider for handling blockchain interactions. */
  protected web3Provider: Web3Provider;

  constructor() {
    this.db = db;
    this.sdkProvider = new SdkProvider();
    this.web3Provider = web3Provider;
  }

  /**
   * Handle a batch relay request
   */
  async handleBatchRequest(
    payload: BatchWithdrawalPayload,
    chainId: number
  ): Promise<RelayerResponse> {
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();
    
    try {
      // Store request in database (convert to standard withdrawal payload)
      const withdrawalPayload: any = {
        proof: payload.proofs[0], // Store first proof for tracking
        withdrawal: payload.withdrawal,
        scope: BigInt(0), // Batch doesn't use scope
        feeCommitment: payload.feeCommitment
      };
      await this.db.createNewRequest(
        requestId,
        timestamp,
        withdrawalPayload
      );

      // Validate the batch withdrawal
      await this.validateBatchWithdrawal(payload, chainId);

      // Verify all proofs
      await this.verifyAllProofs(payload.proofs);

      // Calculate amounts
      const amounts = this.calculateTotalAmounts(payload.proofs);

      // Broadcast the batch withdrawal
      const txHash = await this.broadcastBatchWithdrawal(
        payload,
        chainId,
        amounts.totalAmount
      );

      // Update database with success
      await this.db.updateBroadcastedRequest(requestId, txHash);

      return {
        success: true,
        txHash,
        timestamp,
        requestId,
      };
    } catch (error) {
      let errorMessage: string;
      if (error instanceof RelayerError) {
        errorMessage = error.toPrettyString();
      } else {
        errorMessage = error instanceof Error ? error.message : "Unknown error";
      }

      await this.db.updateFailedRequest(requestId, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        timestamp,
        requestId,
      };
    }
  }

  /**
   * Validate batch withdrawal parameters
   */
  protected async validateBatchWithdrawal(
    payload: BatchWithdrawalPayload,
    chainId: number
  ) {
    const batchRelayerAddress = getBatchRelayerAddress(chainId);
    const feeReceiverAddress = getFeeReceiverAddress(chainId);

    // Decode batch relay data
    const batchData = decodeBatchRelayData(payload.withdrawal.data);

    // Validate processooor is the batch relayer
    if (getAddress(payload.withdrawal.processooor) !== getAddress(batchRelayerAddress)) {
      throw WithdrawalValidationError.processooorMismatch(
        `Expected ${batchRelayerAddress}, got ${payload.withdrawal.processooor}`
      );
    }

    // Validate fee recipient
    if (getAddress(batchData.feeRecipient) !== getAddress(feeReceiverAddress)) {
      throw WithdrawalValidationError.feeReceiverMismatch(
        `Expected ${feeReceiverAddress}, got ${batchData.feeRecipient}`
      );
    }

    // Validate batch size
    if (batchData.batchSize !== payload.proofs.length) {
      throw WithdrawalValidationError.batchSizeMismatch(
        batchData.batchSize,
        payload.proofs.length
      );
    }

    // Validate fee is within limits
    const maxFeeBPS = getMaxRelayFeeBPS(chainId);
    if (batchData.relayFeeBPS > maxFeeBPS) {
      throw WithdrawalValidationError.feeTooHigh(
        batchData.relayFeeBPS,
        maxFeeBPS
      );
    }

    // Validate all proofs have the same context (withdrawal hash)
    if (payload.proofs.length > 0) {
      const firstContext = payload.proofs[0]?.publicSignals[3];
      for (let i = 1; i < payload.proofs.length; i++) {
        const currentContext = payload.proofs[i]?.publicSignals[3];
        if (currentContext !== firstContext) {
          throw new WithdrawalValidationError(
            `Proof at index ${i} has different withdrawal context`,
            ErrorCode.CONTEXT_MISMATCH
          );
        }
      }
    }

    // Validate total amount is positive
    const totalAmount = this.calculateTotalAmounts(payload.proofs).totalAmount;
    if (totalAmount <= 0n) {
      throw WithdrawalValidationError.amountTooLow(
        totalAmount.toString(),
        "0"
      );
    }

    // If fee commitment provided, validate it
    if (payload.feeCommitment) {
      await this.validateFeeCommitment(
        payload.feeCommitment,
        batchData.relayFeeBPS,
        chainId
      );
    }
  }

  /**
   * Verify all withdrawal proofs
   */
  protected async verifyAllProofs(proofs: WithdrawalProof[]): Promise<void> {
    for (let i = 0; i < proofs.length; i++) {
      const proof = proofs[i];
      if (!proof) {
        throw ZkError.invalidProofAtIndex(i);
      }
      const isValid = await this.sdkProvider.verifyWithdrawal(proof);
      if (!isValid) {
        throw ZkError.invalidProofAtIndex(i);
      }
    }
  }

  /**
   * Calculate total withdrawal amounts from proofs
   */
  protected calculateTotalAmounts(proofs: WithdrawalProof[]): {
    totalAmount: bigint;
  } {
    let totalAmount = 0n;

    for (const proof of proofs) {
      const signals = parseSignals(proof.publicSignals);
      const amount = signals.withdrawnValue;
      totalAmount += amount;
    }

    return { totalAmount };
  }

  /**
   * Broadcast batch withdrawal to blockchain
   */
  protected async broadcastBatchWithdrawal(
    payload: BatchWithdrawalPayload,
    chainId: number,
    totalAmount: bigint
  ): Promise<string> {
    try {
      const batchRelayerAddress = getBatchRelayerAddress(chainId);
      const poolAddress = payload.poolAddress;
      
      // Execute batch relay through SDK
      const result = await this.sdkProvider.executeBatchRelay(
        batchRelayerAddress,
        poolAddress,
        payload.withdrawal,
        payload.proofs,
        chainId
      );

      console.log("Batch relay broadcasted", {
        txHash: result.txHash,
        totalAmount: totalAmount.toString(),
        fee: result.fee.toString(),
      });

      return result.txHash;
    } catch (error) {
      console.error("Failed to broadcast batch relay", { error });
      throw BlockchainError.transactionFailed(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Validate fee commitment if provided
   */
  protected async validateFeeCommitment(
    feeCommitment: any,
    relayFeeBPS: bigint,
    chainId: number
  ) {
    // Check expiration
    if (feeCommitment.expiresAt && Date.now() > feeCommitment.expiresAt) {
      throw WithdrawalValidationError.feeCommitmentExpired();
    }

    // Check fee matches commitment
    if (feeCommitment.relayFeeBPS && BigInt(feeCommitment.relayFeeBPS) !== relayFeeBPS) {
      throw WithdrawalValidationError.feeCommitmentMismatch(
        feeCommitment.relayFeeBPS,
        relayFeeBPS.toString()
      );
    }
  }
}