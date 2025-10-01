/**
 * Service for handling batch relay operations
 */
import crypto from "crypto";
import { getAddress } from "viem";
import {
  WithdrawalProof,
  decodeBatchRelayData,
  validateBatchRelayData,
} from "@0xbow/privacy-pools-core-sdk";
import {
  getBatchRelayerAddress,
  getFeeReceiverAddress,
  getBatchRelayFeeBPS,
  getMaxBatchRelayFeeBPS,
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
import { BatchRelayData } from "../utils/batchRelayEncoder.js";
import {
  calculateBatchGasUnits,
  calculateTotalAmountFromProofs,
  GAS_PRICE_BUFFER
} from "../utils/batchRelayUtils.js";
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
   * Calculate the total gas cost in Wei for profitability validation
   * Uses deterministic gas units + current gas price + buffer
   */
  async calculateBatchGasCostWei(chainId: number, batchSize: number): Promise<bigint> {
    const gasUnits = calculateBatchGasUnits(batchSize);
    const gasPrice = await this.web3Provider.getGasPrice(chainId);
    const baseGasCostWei = gasUnits * gasPrice;
    const bufferedGasCostWei = baseGasCostWei + (baseGasCostWei * GAS_PRICE_BUFFER) / 100n;

    return bufferedGasCostWei;
  }

  /**
   * validates batch relay profitability before executing the transaction.
   * checks for: relayFee >= tx_cost + (total_batch_value * batch_relay_fee_bps)
   * 
   * @param chainId - The chain ID
   * @param relayFeeWei - The relay fee in Wei
   * @param totalBatchValueWei - The total value of the batch in Wei
   * @param estimatedGasCostWei - The estimated gas cost in Wei
   * @returns Promise<boolean> - true if profitable, throws error if not
   */
  async validateProfitability(
    chainId: number,
    relayFeeWei: bigint,
    totalBatchValueWei: bigint,
    estimatedGasCostWei: bigint
  ): Promise<boolean> {
    try {
      // Get the minimum profit margin configuration
      const batchRelayFeeBPS = getBatchRelayFeeBPS(chainId);

      // Calculate minimum profit required (in Wei)
      const minimumProfitWei = (totalBatchValueWei * batchRelayFeeBPS) / 10000n;

      // Calculate minimum relay fee required
      const minimumRelayFeeWei = estimatedGasCostWei + minimumProfitWei;

      // Check profitability
      const isProfitable = relayFeeWei >= minimumRelayFeeWei;


      if (!isProfitable) {
        const shortfallWei = minimumRelayFeeWei - relayFeeWei;
        throw new RelayerError(
          `Batch relay not profitable: need ${minimumRelayFeeWei.toString()} Wei, got ${relayFeeWei.toString()} Wei (shortfall: ${shortfallWei.toString()} Wei)`,
          ErrorCode.INSUFFICIENT_FEE
        );
      }

      return true;

    } catch (error) {
      if (error instanceof RelayerError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new RelayerError(
        `Profitability validation failed: ${errorMessage}`,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Calculate the fee in basis points needed to cover gas costs + profit
   * BPS = (gas_cost / total_amount * 10000) + profit_bps
   * Uses ceiling division to prevent precision loss
   */
  async calculateBatchFeeBPS(
    chainId: number,
    totalAmount: bigint,
    batchSize: number
  ): Promise<number> {
    try {
      const bufferedGasCostWei = await this.calculateBatchGasCostWei(chainId, batchSize);
      const gasFeeBPS = (bufferedGasCostWei * 10000n + totalAmount - 1n) / totalAmount;
      const profitBPS = getBatchRelayFeeBPS(chainId);
      const totalFeeBPS = gasFeeBPS + profitBPS;

      const maxBatchRelayFeeBps = getMaxBatchRelayFeeBPS(chainId);
      if (totalFeeBPS > maxBatchRelayFeeBps) {
        throw new Error(`Required fee ${totalFeeBPS} BPS exceeds maximum ${maxBatchRelayFeeBps} BPS`);
      }

      return Number(totalFeeBPS);
    } catch (error) {
      console.error("Error calculating batch fee BPS:", error);
      throw error;
    }
  }

  /**
   * Validates that the request data matches the signed quote commitment
   * @param signedData - The batch relay data from the signed quote
   * @param requestData - The batch relay data from the request
   * @param calculatedTotalAmount - The total amount calculated from proofs
   * @throws {WithdrawalValidationError} - If validation fails
   */
  protected validateSignedQuote(
    signedData: BatchRelayData,
    requestData: BatchRelayData,
    calculatedTotalAmount: bigint
  ): void {
    // Validate batch size matches
    if (signedData.batchSize !== requestData.batchSize) {
      throw new WithdrawalValidationError(
        `Batch size mismatch: signed quote has ${signedData.batchSize}, request has ${requestData.batchSize}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Validate total value matches calculated amount
    if (signedData.totalValue !== calculatedTotalAmount) {
      throw new WithdrawalValidationError(
        `Total value mismatch: signed quote has ${signedData.totalValue}, calculated ${calculatedTotalAmount}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Validate relay fee BPS matches
    if (signedData.relayFeeBPS !== requestData.relayFeeBPS) {
      throw new WithdrawalValidationError(
        `Relay fee BPS mismatch: signed quote has ${signedData.relayFeeBPS}, request has ${requestData.relayFeeBPS}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Validate recipient matches
    if (signedData.recipient.toLowerCase() !== requestData.recipient.toLowerCase()) {
      throw new WithdrawalValidationError(
        `Recipient mismatch: signed quote has ${signedData.recipient}, request has ${requestData.recipient}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Validate fee recipient matches
    if (signedData.feeRecipient.toLowerCase() !== requestData.feeRecipient.toLowerCase()) {
      throw new WithdrawalValidationError(
        `Fee recipient mismatch: signed quote has ${signedData.feeRecipient}, request has ${requestData.feeRecipient}`,
        ErrorCode.INVALID_INPUT
      );
    }
  }

  /**
   * Handle a batch relay request
   */
  async handleBatchRequest(
    payload: BatchWithdrawalPayload,
    chainId: number,
    signedBatchData?: BatchRelayData
  ): Promise<RelayerResponse> {
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();

    try {

      // TODO: save all proofs?
      //  const withdrawalProofForDb: WithdrawalProof = {
      //    proof: {
      //      protocol: "groth16",
      //      curve: "bn128",
      //      pi_a: firstProof.proof.pi_a,
      //      pi_b: firstProof.proof.pi_b,
      //      pi_c: firstProof.proof.pi_c,
      //    },
      //    publicSignals: firstProof.publicSignals,
      //  };

      //  const withdrawalPayload: WithdrawalPayload = {
      //    proof: withdrawalProofForDb,
      //    withdrawal: payload.withdrawal,
      //    scope: BigInt(0),
      //    feeCommitment: payload.feeCommitment
      //  };
      //  await this.db.createNewRequest(requestId, timestamp, withdrawalPayload);

      // Store request in database
      const firstProof = payload.originalProofs[0];

      if (!firstProof) {
        throw new WithdrawalValidationError("No proofs provided", ErrorCode.INVALID_INPUT);
      }

      const batchRelayData = decodeBatchRelayData(payload.withdrawal.data);

      // XXX: validate should include verify, just make one validation.
      await this.validateBatchWithdrawal(payload, batchRelayData, chainId);

      // XXX: should be inside validate
      await this.verifyAllProofs(payload.originalProofs as WithdrawalProof[]);

      const totalAmount = calculateTotalAmountFromProofs(payload.proofs);

      // If client provided a signed quote, validate it matches the request
      if (signedBatchData) {
        this.validateSignedQuote(signedBatchData, batchRelayData, totalAmount);
      }

      const estimatedGasCostWei = await this.calculateBatchGasCostWei(chainId, payload.proofs.length);

      // Use the signed relayFeeBPS if available, otherwise use the request's relayFeeBPS
      const relayFeeBPS = signedBatchData?.relayFeeBPS ?? batchRelayData.relayFeeBPS;
      const relayFeeWei = (totalAmount * relayFeeBPS) / 10000n;

      await this.validateProfitability(chainId, relayFeeWei, totalAmount, estimatedGasCostWei);

      const txHash = await this.broadcastBatchWithdrawal(
        payload,
        chainId
      );

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
   * Validate batch withdrawal parameters using SDK validation
   */
  protected async validateBatchWithdrawal(
    payload: BatchWithdrawalPayload,
    batchData: BatchRelayData,
    chainId: number
  ) {
    const batchRelayerAddress = getAddress(getBatchRelayerAddress(chainId));
    const feeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
    const processooorAddress = getAddress(payload.withdrawal.processooor);
    const batchFeeRecipient = getAddress(batchData.feeRecipient);

    try {
      validateBatchRelayData(batchData);
    } catch (error) {
      throw new WithdrawalValidationError(
        `Invalid batch relay data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCode.INVALID_INPUT
      );
    }

    // Validate processooor is the batch relayer
    if (processooorAddress !== batchRelayerAddress) {
      throw WithdrawalValidationError.processooorMismatch(
        `Expected ${batchRelayerAddress}, got ${payload.withdrawal.processooor}`
      );
    }

    // Validate fee recipient
    if (batchFeeRecipient !== feeReceiverAddress) {
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
    const maxFeeBPS = getMaxBatchRelayFeeBPS(chainId);
    if (batchData.relayFeeBPS > maxFeeBPS) {
      throw WithdrawalValidationError.feeTooHigh(
        batchData.relayFeeBPS,
        maxFeeBPS
      );
    }

    if (payload.proofs.length > 0) {
      // Validate first proof has exactly 8 public signals
      const firstProof = payload.proofs[0];
      if (firstProof && firstProof.pubSignals.length !== 8) {
        throw new WithdrawalValidationError(
          `First proof must have exactly 8 public signals, got ${firstProof.pubSignals.length}`,
          ErrorCode.INVALID_PROOF
        );
      }
      // Validate all proofs have exactly 8 public signals and share the same context

      const firstContext = firstProof?.pubSignals[7]; // context is at index 7 based on circuit
      for (let i = 1; i < payload.proofs.length; i++) {
        const currentProof = payload.proofs[i];

        // Validate each proof has exactly 8 public signals
        if (currentProof && currentProof.pubSignals.length !== 8) {
          throw new WithdrawalValidationError(
            `Proof at index ${i} must have exactly 8 public signals, got ${currentProof.pubSignals.length}`,
            ErrorCode.INVALID_PROOF
          );
        }

        const currentContext = currentProof?.pubSignals[7];

        if (currentContext !== firstContext) {
          throw new WithdrawalValidationError(
            `Proof at index ${i} has different withdrawal context`,
            ErrorCode.CONTEXT_MISMATCH
          );
        }
      }
    }

    // Validate total amount is positive
    const totalAmount = calculateTotalAmountFromProofs(payload.proofs);
    if (totalAmount <= 0n) {
      throw WithdrawalValidationError.amountTooLow(
        totalAmount.toString(),
        "0"
      );
    }

  }

  /**
   * Verify all withdrawal proofs using SDK batch verification
   */
  protected async verifyAllProofs(
    originalProofs: Array<{ publicSignals: string[]; proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] } }>
  ): Promise<void> {
    // Convert relayer proof format to SDK WithdrawalProof format
    const sdkProofs: WithdrawalProof[] = originalProofs.map(proof => ({
      proof: {
        pi_a: proof.proof.pi_a,
        pi_b: proof.proof.pi_b,
        pi_c: proof.proof.pi_c,
        protocol: "groth16" as const,
        curve: "bn128" as const
      },
      publicSignals: proof.publicSignals
    }));

    const isValid = await this.sdkProvider.verifyBatchWithdrawal(sdkProofs);
    if (!isValid) {
      throw new ZkError("Batch proof verification failed", ErrorCode.INVALID_PROOF);
    }
  }

  /**
   * Broadcast batch withdrawal to blockchain
   */
  protected async broadcastBatchWithdrawal(
    payload: BatchWithdrawalPayload,
    chainId: number
  ): Promise<string> {
    try {
      const result = await this.sdkProvider.broadcastBatchRelay(payload, chainId);

      return result.transactionHash;
    } catch (error) {
      throw BlockchainError.transactionFailed(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}
