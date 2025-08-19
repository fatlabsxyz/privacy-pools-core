import { Address, type Hex } from 'viem';
import type { WithdrawalService } from './withdrawal.service.js';
import type { ContractInteractionsService } from './contracts.service.js';
import type { 
  BatchWithdrawalPayload, 
  Withdrawal, 
  WithdrawalProof,
  WithdrawalProofInput,
  BatchRelayData,
  BatchRelayResult
} from '../types/withdrawal.js';
import type { AccountCommitment } from '../types/account.js';
import { 
  encodeBatchRelayData,
  decodeBatchRelayData,
  validateBatchRelayData,
  calculateBatchFees 
} from '../utils/batchRelayEncoder.js';
import { BatchRelayError } from '../errors/batchRelay.error.js';

/**
 * Service for building and managing batch withdrawals
 * Uses ContractsService for blockchain interactions but only for batch relay operations
 */
export class BatchWithdrawalService {
  constructor(
    private readonly withdrawalService: WithdrawalService,
    private readonly contractsService: ContractInteractionsService
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
   * @returns BatchWithdrawalPayload ready for submission
   */
  async buildBatchWithdrawal(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[]
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

    // Create BatchRelayData
    const batchRelayData: BatchRelayData = {
      recipient,
      feeRecipient,
      relayFeeBPS,
      batchSize: notes.length
    };

    // Validate the batch relay data
    validateBatchRelayData(batchRelayData);

    // Check fee against max if possible
    try {
      const maxFeeBPS = await this.contractsService.getMaxRelayFeeBPS(batchRelayerAddress);
      if (relayFeeBPS > maxFeeBPS) {
        throw BatchRelayError.feeTooHigh(relayFeeBPS, maxFeeBPS);
      }
    } catch (error) {
      // If it's our specific error, re-throw it
      if (error instanceof BatchRelayError) {
        throw error;
      }
      // Otherwise just warn - contract might not be deployed yet
      console.warn('Could not verify max relay fee BPS:', error);
    }

    // Encode BatchRelayData
    const encodedData = encodeBatchRelayData(batchRelayData);

    // Create Withdrawal struct
    const withdrawal: Withdrawal = {
      processooor: batchRelayerAddress,
      data: encodedData
    };

    // Generate proofs for each note
    const proofs: WithdrawalProof[] = [];
    for (let i = 0; i < notes.length; i++) {
      const proof = await this.withdrawalService.proveWithdrawal(
        notes[i],
        proofInputs[i]
      );
      proofs.push(proof);
    }

    // Verify all proofs have matching context (withdrawal hash)
    const firstContext = proofs[0].publicSignals[3]; // context is at index 3
    for (let i = 1; i < proofs.length; i++) {
      if (proofs[i].publicSignals[3] !== firstContext) {
        throw BatchRelayError.contextMismatch(i);
      }
    }

    return {
      withdrawal,
      proofs,
      poolAddress
    };
  }

  /**
   * Validate a batch withdrawal before submission
   */
  validateBatchWithdrawal(
    payload: BatchWithdrawalPayload,
    batchRelayerAddress: Address
  ): void {
    // Check processooor matches
    if (payload.withdrawal.processooor !== batchRelayerAddress) {
      throw BatchRelayError.invalidProcessooor(
        batchRelayerAddress,
        payload.withdrawal.processooor
      );
    }

    // Decode and validate batch data
    const batchData = decodeBatchRelayData(payload.withdrawal.data);
    validateBatchRelayData(batchData);

    // Check batch size matches proofs
    if (batchData.batchSize !== payload.proofs.length) {
      throw BatchRelayError.invalidBatchSize(
        batchData.batchSize,
        payload.proofs.length
      );
    }

    // Verify all proofs have the same context
    if (payload.proofs.length > 0) {
      const firstContext = payload.proofs[0].publicSignals[3];
      for (let i = 1; i < payload.proofs.length; i++) {
        if (payload.proofs[i].publicSignals[3] !== firstContext) {
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
    relayFeeBPS: bigint
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
      ...calculateBatchFees(totalAmount, relayFeeBPS)
    };
  }

  /**
   * Execute a batch relay transaction
   */
  async executeBatchRelay(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload
  ): Promise<BatchRelayResult> {
    // Validate the batch withdrawal
    this.validateBatchWithdrawal(payload, batchRelayerAddress);

    // Execute the batch relay using ContractsService
    return await this.contractsService.batchRelay(
      batchRelayerAddress,
      payload.poolAddress,
      payload.withdrawal,
      payload.proofs
    );
  }

  /**
   * Estimate gas for a batch withdrawal
   */
  async estimateGas(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload
  ): Promise<bigint> {
    return await this.contractsService.estimateBatchRelayGas(
      batchRelayerAddress,
      payload.poolAddress,
      payload.withdrawal,
      payload.proofs
    );
  }

  /**
   * Simulate a batch withdrawal to check if it would succeed
   */
  async simulate(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload
  ): Promise<boolean> {
    return await this.contractsService.simulateBatchRelay(
      batchRelayerAddress,
      payload.poolAddress,
      payload.withdrawal,
      payload.proofs
    );
  }
}