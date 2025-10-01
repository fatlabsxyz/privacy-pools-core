import { Abi, Account, Address, decodeEventLog, PublicClient, WalletClient } from "viem";
import type {
  BatchWithdrawalPayload,
  Withdrawal,
  WithdrawalProof,
  BatchRelayResult,
} from "../types/withdrawal.js";
import {
  decodeBatchRelayData,
  validateBatchRelayData,
} from "../utils/batchRelayEncoder.js";
import { BatchRelayError } from "../errors/batchRelay.error.js";
import { bigintToHex } from "../crypto.js";
import type { CommitmentProof } from "../types/commitment.js";
import { ContractError } from "../errors/base.error.js";
import { IBatchRelayerABI } from "../abi/IBatchRelayer.js";

/**
 * Service for building and managing batch withdrawals
 * Uses ContractsService for blockchain interactions but only for batch relay operations
 */
export class BatchWithdrawalService {
  constructor(
    readonly batchRelayerAddress: Address,
    private readonly publicClient: PublicClient,
    private readonly walletClient: WalletClient,
    private readonly account: Account
  ) { }

  /**
   * Validate a batch withdrawal before submission
   */
  validateBatchWithdrawal(
    payload: BatchWithdrawalPayload,
  ): void {
    // Check processooor matches
    if (payload.withdrawal.processooor !== this.batchRelayerAddress) {
      throw BatchRelayError.invalidProcessooor(
        this.batchRelayerAddress,
        payload.withdrawal.processooor,
      );
    }

    // Decode and validate batch data
    const batchData = decodeBatchRelayData(payload.withdrawal.data);
    validateBatchRelayData(batchData);

    // Check batch size matches proofs
    if (batchData.batchSize !== payload.proofs.length) {
      throw BatchRelayError.invalidBatchSize(
        batchData.batchSize,
        payload.proofs.length,
      );
    }

    // Verify all proofs have the same context and exactly 8 public signals
    if (payload.proofs.length > 0) {
      const firstProof = payload.proofs[0];
      if (!firstProof) {
        throw BatchRelayError.invalidInput("First proof is undefined");
      }

      // Validate first proof has exactly 8 public signals (required by contract)
      if (firstProof.publicSignals.length !== 8) {
        throw BatchRelayError.invalidInput(
          `First proof must have exactly 8 public signals, got ${firstProof.publicSignals.length}`,
        );
      }

      const firstContext = firstProof.publicSignals[7]; // context is at index 7 (based on circuit)
      for (let i = 1; i < payload.proofs.length; i++) {
        const currentProof = payload.proofs[i];
        if (!currentProof) {
          throw BatchRelayError.invalidInput(
            `Proof at index ${i} is undefined`,
          );
        }

        // Validate each proof has exactly 8 public signals (required by contract)
        if (currentProof.publicSignals.length !== 8) {
          throw BatchRelayError.invalidInput(
            `Proof at index ${i} must have exactly 8 public signals, got ${currentProof.publicSignals.length}`,
          );
        }

        if (currentProof.publicSignals[7] !== firstContext) {
          throw BatchRelayError.contextMismatch(i);
        }
      }
    }
  }

  //  /**
  //   * Calculate total amount and fees for a batch
  //   */
  //  calculateBatchAmounts(
  //    notes: AccountCommitment[],
  //    relayFeeBPS: bigint,
  //  ): {
  //    totalAmount: bigint;
  //    fee: bigint;
  //    amountAfterFees: bigint;
  //  } {
  //    // Calculate batch amounts using utility function
  //    return calculateBatchAmounts(notes, relayFeeBPS);
  //  }

  /**
   * Execute a batch relay through the BatchRelayer contract
   * @param batchRelayerAddress - Address of the BatchRelayer contract
   * @param poolAddress - Address of the privacy pool
   * @param withdrawal - Withdrawal struct with processooor set to BatchRelayer
   * @param proofs - Array of withdrawal proofs
   * @returns Transaction hash and batch relay details
   */
  async batchRelay(
    poolAddress: Address,
    withdrawal: Withdrawal,
    proofs: WithdrawalProof[],
  ): Promise<BatchRelayResult> {
    // Validate inputs
    if (withdrawal.processooor !== this.batchRelayerAddress) {
      throw ContractError.invalidProcessooor(
        this.batchRelayerAddress,
        withdrawal.processooor,
      );
    }

    // Decode and validate BatchRelayData
    const batchRelayData = decodeBatchRelayData(withdrawal.data);
    if (batchRelayData.batchSize !== proofs.length) {
      throw BatchRelayError.invalidBatchSize(
        batchRelayData.batchSize,
        proofs.length,
      );
    }

    try {
      // Format all proofs
      const formattedProofs = proofs.map((proof, index) => {
        if (!proof) {
          throw BatchRelayError.invalidInput(`Proof ${index + 1} is null or undefined`);
        }
        return this.formatProof(proof);
      });

      // Simulate the contract call
      const { request } = await this.publicClient.simulateContract({
        address: this.batchRelayerAddress,
        abi: IBatchRelayerABI as Abi,
        functionName: "batchRelay",
        args: [poolAddress, withdrawal, formattedProofs],
        account: this.account,
      });

      // Execute the transaction
      const hash = await this.walletClient.writeContract(request);

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      // Parse the BatchRelayed event from the logs
      // The BatchRelayer contract emits this event with the final amounts
      const batchRelayedEvent = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({
              abi: IBatchRelayerABI,
              data: log.data,
              topics: log.topics,
            });
          } catch {
            return null;
          }
        })
        .find((event) => event?.eventName === "BatchRelayed");

      if (!batchRelayedEvent) {
        throw ContractError.eventNotFound("BatchRelayed");
      }

      const amountAfterFees = batchRelayedEvent.args._amountAfterFees as bigint;
      const fee = batchRelayedEvent.args._fee as bigint;
      const totalAmount = amountAfterFees + fee;

      return {
        transactionHash: hash,
        recipient: batchRelayData.recipient,
        totalAmount,
        fee,
        amountAfterFees,
      };
    } catch (error) {
      console.error("Batch Relay Error:", {
        error,
        batchRelayerAddress: this.batchRelayerAddress,
        poolAddress,
      });
      throw ContractError.executionFailed(
        "batch relay",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  /**
   * Get the maximum relay fee BPS from BatchRelayer contract
   */
  async getMaxRelayFeeBPS(batchRelayerAddress: Address): Promise<bigint> {
    try {
      const maxFeeBPS = await this.publicClient.readContract({
        address: batchRelayerAddress,
        abi: IBatchRelayerABI as Abi,
        functionName: "MAX_RELAY_FEE_BPS",
      });

      return maxFeeBPS as bigint;
    } catch (error) {
      throw ContractError.executionFailed(
        "read MAX_RELAY_FEE_BPS",
        error instanceof Error ? error : new Error("Unknown error"),
      );
    }
  }

  private formatProof(proof: CommitmentProof | WithdrawalProof) {
    if (!proof || !proof.proof) {
      throw new Error(
        `formatProof received invalid proof structure: ${JSON.stringify(proof)}`,
      );
    }

    const result = {
      pA: [
        bigintToHex(proof.proof.pi_a?.[0]),
        bigintToHex(proof.proof.pi_a?.[1]),
      ],
      pB: [
        [
          bigintToHex(proof.proof.pi_b?.[0]?.[1]),
          bigintToHex(proof.proof.pi_b?.[0]?.[0]),
        ],
        [
          bigintToHex(proof.proof.pi_b?.[1]?.[1]),
          bigintToHex(proof.proof.pi_b?.[1]?.[0]),
        ],
      ],
      pC: [
        bigintToHex(proof.proof.pi_c?.[0]),
        bigintToHex(proof.proof.pi_c?.[1]),
      ],
      pubSignals: proof.publicSignals.map(bigintToHex),
    };

    return result;
  }
}
