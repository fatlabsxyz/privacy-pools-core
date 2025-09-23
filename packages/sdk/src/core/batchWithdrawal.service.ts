import { Address, type Hex } from "viem";
import type { WithdrawalService } from "./withdrawal.service.js";
import type { ContractInteractionsService } from "./contracts.service.js";
import type {
  BatchWithdrawalPayload,
  Withdrawal,
  WithdrawalProof,
  WithdrawalProofInput,
  BatchRelayData,
  BatchRelayResult,
} from "../types/withdrawal.js";
import type { AccountCommitment } from "../types/account.js";
import {
  encodeBatchRelayData,
  decodeBatchRelayData,
  validateBatchRelayData,
  calculateBatchFees,
} from "../utils/batchRelayEncoder.js";
import { BatchRelayError } from "../errors/batchRelay.error.js";
import { calculateContext } from "../crypto.js";
import type { Hash } from "../types/commitment.js";

/**
 * Service for building and managing batch withdrawals
 * Uses ContractsService for blockchain interactions but only for batch relay operations
 */
export class BatchWithdrawalService {
  constructor(
    private readonly withdrawalService: WithdrawalService,
    private readonly contractsService: ContractInteractionsService,
  ) {}

  /**
   * Build a batch withdrawal from multiple notes
   * @param notes - Array of notes to withdraw
   * @param batchRelayerAddress - Address of BatchRelayer contract
   * @param recipient - Final recipient of funds
   * @param feeRecipient - Address to receive fees
   * @param relayFeeBPS - Fee in basis points
   * @param poolAddress - Address of the privacy pool
   * @param proofInputs - Array of proof inputs corresponding to each note
   * @param scope - The pool scope for context calculation
   * @returns BatchWithdrawalPayload ready for submission
   */
  async buildBatchWithdrawal(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[],
    scope: Hex,
  ): Promise<BatchWithdrawalPayload> {
    // Validate inputs
    if (notes.length === 0) {
      throw BatchRelayError.emptyBatch();
    }

    if (notes.length !== proofInputs.length) {
      throw BatchRelayError.invalidBatchSize(proofInputs.length, notes.length);
    }

    if (notes.length > 255) {
      throw BatchRelayError.batchTooLarge(notes.length);
    }

    // Calculate total value from proof inputs
    const totalValue = proofInputs.reduce(
      (sum, input) => sum + input.withdrawalAmount,
      0n,
    );

    // Create preliminary BatchRelayData (without final validation yet)
    const batchRelayData: BatchRelayData = {
      recipient,
      feeRecipient,
      relayFeeBPS,
      batchSize: notes.length,
      totalValue,
    };

    // Encode BatchRelayData
    const encodedData = encodeBatchRelayData(batchRelayData);

    // Create Withdrawal struct
    const withdrawal: Withdrawal = {
      processooor: batchRelayerAddress,
      data: encodedData,
    };

    // Calculate the context that all proofs must share
    // This context is calculated from the batch withdrawal struct and scope
    const batchContext = calculateContext(withdrawal, BigInt(scope) as Hash);

    // Generate proofs for each note with the correct batch context
    const proofs: WithdrawalProof[] = [];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const proofInput = proofInputs[i];
      if (!note) {
        throw BatchRelayError.invalidInput(`Note at index ${i} is undefined`);
      }
      if (!proofInput) {
        throw BatchRelayError.invalidInput(
          `Proof input at index ${i} is undefined`,
        );
      }

      // Create proof input with the correct batch context
      // This ensures the proof is generated with the right context from the start
      // The context gets embedded in the proof's public signals during proving
      const batchProofInput: WithdrawalProofInput = {
        ...proofInput,
        context: BigInt(batchContext),
      };

      const proof = await this.withdrawalService.proveWithdrawal(
        note,
        batchProofInput,
      );
      proofs.push(proof);
    }

    // Now validate everything after proof generation
    validateBatchRelayData(batchRelayData);

    // Check fee against max if possible
    try {
      const maxFeeBPS =
        await this.contractsService.getMaxRelayFeeBPS(batchRelayerAddress);
      if (relayFeeBPS > maxFeeBPS) {
        throw BatchRelayError.feeTooHigh(relayFeeBPS, maxFeeBPS);
      }
    } catch (error) {
      // If it's our specific error, re-throw it
      if (error instanceof BatchRelayError) {
        throw error;
      }
      // Otherwise ignore - contract might not be deployed yet
    }

    // Verify all proofs have matching context (withdrawal hash) and exactly 8 public signals
    if (proofs.length === 0) {
      throw BatchRelayError.invalidInput("No proofs generated");
    }
    const firstProof = proofs[0];
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
    for (let i = 1; i < proofs.length; i++) {
      const currentProof = proofs[i];
      if (!currentProof) {
        throw BatchRelayError.invalidInput(`Proof at index ${i} is undefined`);
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

    return {
      withdrawal,
      proofs,
      poolAddress,
    };
  }

  /**
   * Generate proofs for batch withdrawal with correct batch context
   * This is the recommended way to generate proofs for batch relay operations
   *
   * @param notes - Array of notes to withdraw
   * @param batchRelayerAddress - Address of BatchRelayer contract
   * @param recipient - Final recipient of funds
   * @param feeRecipient - Address to receive fees
   * @param relayFeeBPS - Fee in basis points
   * @param poolAddress - Address of the privacy pool
   * @param proofInputs - Array of proof inputs (contexts will be overridden with batch context)
   * @param scope - The pool scope for context calculation
   * @returns Array of correctly proven withdrawal proofs for batch relay
   */
  async proveBatchWithdrawal(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[],
    scope: Hex,
  ): Promise<WithdrawalProof[]> {
    // Validate inputs
    if (notes.length === 0) {
      throw BatchRelayError.emptyBatch();
    }

    if (notes.length !== proofInputs.length) {
      throw BatchRelayError.invalidBatchSize(proofInputs.length, notes.length);
    }

    if (notes.length > 255) {
      throw BatchRelayError.batchTooLarge(notes.length);
    }

    // Calculate total value from proof inputs
    const totalValue = proofInputs.reduce(
      (sum, input) => sum + input.withdrawalAmount,
      0n,
    );

    // Create BatchRelayData
    const batchRelayData: BatchRelayData = {
      recipient,
      feeRecipient,
      relayFeeBPS,
      batchSize: notes.length,
      totalValue,
    };

    // Encode BatchRelayData
    const encodedData = encodeBatchRelayData(batchRelayData);

    // Create Withdrawal struct
    const withdrawal: Withdrawal = {
      processooor: batchRelayerAddress,
      data: encodedData,
    };

    // Calculate the batch context that all proofs must share
    const batchContext = calculateContext(withdrawal, BigInt(scope) as Hash);

    // Generate proofs for each note with the correct batch context
    const proofs: WithdrawalProof[] = [];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const proofInput = proofInputs[i];
      if (!note) {
        throw BatchRelayError.invalidInput(`Note at index ${i} is undefined`);
      }
      if (!proofInput) {
        throw BatchRelayError.invalidInput(
          `Proof input at index ${i} is undefined`,
        );
      }

      const batchProofInput: WithdrawalProofInput = {
        ...proofInput,
        context: BigInt(batchContext),
      };

      const proof = await this.withdrawalService.proveWithdrawal(
        note,
        batchProofInput,
      );
      proofs.push(proof);
    }

    // Verify all proofs have matching context and exactly 8 public signals
    if (proofs.length === 0) {
      throw BatchRelayError.invalidInput("No proofs generated");
    }

    const firstProof = proofs[0];
    if (!firstProof) {
      throw BatchRelayError.invalidInput("First proof is undefined");
    }

    const firstContext = firstProof.publicSignals[7]; // context is at index 7 (based on circuit)
    for (let i = 1; i < proofs.length; i++) {
      const currentProof = proofs[i];
      if (!currentProof) {
        throw BatchRelayError.invalidInput(`Proof at index ${i} is undefined`);
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

    return proofs;
  }

  /**
   * Validate a batch withdrawal before submission
   */
  validateBatchWithdrawal(
    payload: BatchWithdrawalPayload,
    batchRelayerAddress: Address,
  ): void {
    // Check processooor matches
    if (payload.withdrawal.processooor !== batchRelayerAddress) {
      throw BatchRelayError.invalidProcessooor(
        batchRelayerAddress,
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

  /**
   * Calculate total amount and fees for a batch
   */
  calculateBatchAmounts(
    notes: AccountCommitment[],
    relayFeeBPS: bigint,
  ): {
    totalAmount: bigint;
    fee: bigint;
    amountAfterFees: bigint;
  } {
    // Calculate total withdrawal amount
    const totalAmount = notes.reduce((sum, note) => sum + note.value, 0n);

    // Calculate fees
    return {
      totalAmount,
      ...calculateBatchFees(totalAmount, relayFeeBPS),
    };
  }

  /**
   * Execute a batch relay transaction
   */
  async executeBatchRelay(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload,
  ): Promise<BatchRelayResult> {
    // Validate the batch withdrawal
    this.validateBatchWithdrawal(payload, batchRelayerAddress);

    // Execute the batch relay using ContractsService
    return await this.contractsService.batchRelay(
      batchRelayerAddress,
      payload.poolAddress,
      payload.withdrawal,
      payload.proofs,
    );
  }

  /**
   * Estimate gas for a batch withdrawal
   */
  async estimateGas(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload,
  ): Promise<bigint> {
    return await this.contractsService.estimateBatchRelayGas(
      batchRelayerAddress,
      payload.poolAddress,
      payload.withdrawal,
      payload.proofs,
    );
  }

  /**
   * Simulate a batch withdrawal to check if it would succeed
   */
  async simulate(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload,
  ): Promise<boolean> {
    return await this.contractsService.simulateBatchRelay(
      batchRelayerAddress,
      payload.poolAddress,
      payload.withdrawal,
      payload.proofs,
    );
  }
}
