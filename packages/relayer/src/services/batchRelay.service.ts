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
import { BatchWithdrawalPayload, ContractWithdrawProof } from "../interfaces/relayer/batchRequest.js";
import { RelayerResponse, WithdrawalPayload } from "../interfaces/relayer/request.js";
import { FeeCommitment } from "../interfaces/relayer/common.js";
import { web3Provider, SdkProvider, db } from "../providers/index.js";
import { parseSignals } from "../utils.js";
import { BatchRelayData } from "../utils/batchRelayEncoder.js";
import { RelayerDatabase } from "../types/db.types.js";
import { SdkProviderInterface } from "../types/sdk.types.js";
import { Web3Provider } from "../providers/web3.provider.js";

const BASE_GAS_UNITS = 160500n; // Base gas units for batch relay function call
const GAS_UNITS_PER_NOTE = 650000n; // Gas units per proof verification
const GAS_PRICE_BUFFER = 20n; // buffer for estimation

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
   * Calculate gas units needed for a batch relay operation
   */
  calculateBatchGasUnits(batchSize: number): bigint {
    const baseGasUnits = BASE_GAS_UNITS;
    const notesGasUnits = GAS_UNITS_PER_NOTE * BigInt(batchSize);
    const totalGasUnits = baseGasUnits + notesGasUnits;

    return totalGasUnits;
  }


  /**
   * Calculate the total gas cost in Wei for profitability validation
   * Uses deterministic gas units + current gas price + buffer
   */
  async calculateBatchGasCostWei(chainId: number, batchSize: number): Promise<bigint> {
    const gasUnits = this.calculateBatchGasUnits(batchSize);
    const gasPrice = await this.web3Provider.getGasPrice(chainId);
    const baseGasCostWei = gasUnits * gasPrice;
    const bufferedGasCostWei = baseGasCostWei + (baseGasCostWei * GAS_PRICE_BUFFER) / 100n;

    return bufferedGasCostWei;
  }

  /**
   * validates batch relay profitability before executing the transaction.
   * checks for: relayFee >= tx_cost + (total_batch_value * batch_relay_fee_bps)
   * This prevents executing unprofitable batch relays that would lose money for the relayer.
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
   * Handle a batch relay request
   */
  async handleBatchRequest(
    payload: BatchWithdrawalPayload,
    chainId: number
  ): Promise<RelayerResponse> {
    const requestId = crypto.randomUUID();
    const timestamp = Date.now();

    try {

      // Store request in database
      const firstProof = payload.originalProofs[0];
      if (!firstProof) {
        throw new WithdrawalValidationError("No proofs provided", ErrorCode.INVALID_INPUT);
      }

      // TODO: save all proofs?
      const withdrawalProofForDb: WithdrawalProof = {
        proof: {
          protocol: "groth16",
          curve: "bn128",
          pi_a: firstProof.proof.pi_a,
          pi_b: firstProof.proof.pi_b,
          pi_c: firstProof.proof.pi_c,
        },
        publicSignals: firstProof.publicSignals,
      };

      const withdrawalPayload: WithdrawalPayload = {
        proof: withdrawalProofForDb,
        withdrawal: payload.withdrawal,
        scope: BigInt(0),
        feeCommitment: payload.feeCommitment
      };
      await this.db.createNewRequest(requestId, timestamp, withdrawalPayload);

      const batchRelayData = decodeBatchRelayData(payload.withdrawal.data);

      await this.validateBatchWithdrawal(payload, batchRelayData, chainId);
      await this.verifyAllProofs(payload.originalProofs as WithdrawalProof[]);

      const amounts = this.calculateTotalAmounts(payload.proofs);

      const estimatedGasCostWei = await this.calculateBatchGasCostWei(chainId, payload.proofs.length);
      const relayFeeWei = (amounts.totalAmount * batchRelayData.relayFeeBPS) / 10000n;

      await this.validateProfitability(chainId, relayFeeWei, amounts.totalAmount, estimatedGasCostWei);

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

    // Use SDK validation
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

    // Validate all proofs have exactly 8 public signals and the same context (withdrawal hash)
    if (payload.proofs.length > 0) {
      // Validate first proof has exactly 8 public signals (required by contract)
      const firstProof = payload.proofs[0];
      if (firstProof && firstProof.pubSignals.length !== 8) {
        throw new WithdrawalValidationError(
          `First proof must have exactly 8 public signals, got ${firstProof.pubSignals.length}`,
          ErrorCode.INVALID_PROOF
        );
      }

      const firstContext = firstProof?.pubSignals[7]; // context is at index 7 based on circuit
      for (let i = 1; i < payload.proofs.length; i++) {
        const currentProof = payload.proofs[i];
        // Validate each proof has exactly 8 public signals (required by contract)
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
  protected calculateTotalAmounts(proofs: ContractWithdrawProof[]): {
    totalAmount: bigint;
  } {
    let totalAmount = 0n;

    for (const proof of proofs) {
      // ContractWithdrawProof uses pubSignals instead of publicSignals
      const signals = parseSignals(proof.pubSignals);
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

  /**
   * Validate fee commitment if provided
   */
  protected async validateFeeCommitment(
    feeCommitment: FeeCommitment,
    relayFeeBPS: bigint,
    chainId: number
  ) {
    if (feeCommitment.expiration && Date.now() > feeCommitment.expiration) {
      throw WithdrawalValidationError.feeCommitmentExpired();
    }

    // TODO: add signature check
  }
}
