import { CommitmentService } from "./commitment.service.js";
import { WithdrawalService } from "./withdrawal.service.js";
import { BatchWithdrawalService } from "./batchWithdrawal.service.js";
import { CircuitsInterface } from "../interfaces/circuits.interface.js";
import { Commitment, CommitmentProof } from "../types/commitment.js";
import { 
  WithdrawalProof, 
  WithdrawalProofInput,
  BatchWithdrawalPayload,
  BatchRelayResult
} from "../types/withdrawal.js";
import { ContractInteractionsService } from "./contracts.service.js";
import { Hex, Address, Chain } from "viem";
import { AccountCommitment } from "../types/account.js";

/**
 * Main SDK class providing access to all privacy pool functionality.
 * Uses Poseidon hash for all commitment operations.
 */
export class PrivacyPoolSDK {
  private readonly commitmentService: CommitmentService;
  private readonly withdrawalService: WithdrawalService;
  private batchWithdrawalService?: BatchWithdrawalService;
  private contractsService?: ContractInteractionsService;

  constructor(circuits: CircuitsInterface) {
    this.commitmentService = new CommitmentService(circuits);
    this.withdrawalService = new WithdrawalService(circuits);
  }

  public createContractInstance(
    rpcUrl: string,
    chain: Chain,
    entrypointAddress: Address,
    privateKey: Hex,
  ): ContractInteractionsService {
    this.contractsService = new ContractInteractionsService(
      rpcUrl,
      chain,
      entrypointAddress,
      privateKey,
    );
    
    // Initialize batch withdrawal service when contracts service is created
    this.batchWithdrawalService = new BatchWithdrawalService(
      this.withdrawalService,
      this.contractsService
    );
    
    return this.contractsService;
  }

  /**
   * Generates a commitment proof.
   *
   * @param value - Value to commit
   * @param label - Label for the commitment
   * @param nullifier - Nullifier for the commitment
   * @param secret - Secret for the commitment
   */
  public async proveCommitment(
    value: bigint,
    label: bigint,
    nullifier: bigint,
    secret: bigint,
  ): Promise<CommitmentProof> {
    return this.commitmentService.proveCommitment(
      value,
      label,
      nullifier,
      secret,
    );
  }

  /**
   * Verifies a commitment proof.
   *
   * @param proof - The proof to verify
   */
  public async verifyCommitment(proof: CommitmentProof): Promise<boolean> {
    return this.commitmentService.verifyCommitment(proof);
  }

  /**
   * Generates a withdrawal proof.
   *
   * @param commitment - Commitment to withdraw
   * @param input - Input parameters for the withdrawal
   * @param withdrawal - Withdrawal details
   */
  public async proveWithdrawal(
    commitment: Commitment | AccountCommitment ,
    input: WithdrawalProofInput,
  ): Promise<WithdrawalProof> {
    return await this.withdrawalService.proveWithdrawal(commitment, input);
  }

  /**
   * Verifies a withdrawal proof.
   *
   * @param withdrawalProof - The withdrawal payload to verify
   */
  public async verifyWithdrawal(
    withdrawalProof: WithdrawalProof,
  ): Promise<boolean> {
    return this.withdrawalService.verifyWithdrawal(withdrawalProof);
  }

  /**
   * Execute a batch withdrawal from multiple notes
   * @param notes - Notes to withdraw
   * @param batchRelayerAddress - BatchRelayer contract address
   * @param recipient - Final recipient
   * @param feeRecipient - Fee recipient
   * @param relayFeeBPS - Fee in basis points
   * @param poolAddress - Privacy pool address
   * @param proofInputs - Proof inputs for each note
   * @returns Transaction result
   */
  public async batchWithdraw(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[]
  ): Promise<BatchRelayResult> {
    if (!this.batchWithdrawalService) {
      throw new Error('BatchWithdrawal service not initialized. Call createContractInstance first.');
    }

    if (!this.contractsService) {
      throw new Error('Contracts service not initialized. Call createContractInstance first.');
    }

    // Get scope from pool address
    const scope = await this.contractsService.getScope(poolAddress);

    // Build batch withdrawal
    const payload = await this.batchWithdrawalService.buildBatchWithdrawal(
      notes,
      batchRelayerAddress,
      recipient,
      feeRecipient,
      relayFeeBPS,
      poolAddress,
      proofInputs,
      `0x${scope.toString(16).padStart(64, "0")}` as Hex,
    );

    // Execute batch relay
    return await this.batchWithdrawalService.executeBatchRelay(
      batchRelayerAddress,
      payload,
    );
  }

  /**
   * Prepare a batch withdrawal for relaying (doesn't execute)
   */
  public async prepareBatchWithdrawal(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[],
  ): Promise<BatchWithdrawalPayload> {
    if (!this.batchWithdrawalService) {
      throw new Error(
        "BatchWithdrawal service not initialized. Call createContractInstance first.",
      );
    }

    if (!this.contractsService) {
      throw new Error(
        "Contracts service not initialized. Call createContractInstance first.",
      );
    }

    // Get scope from pool address
    const scope = await this.contractsService.getScope(poolAddress);

    return await this.batchWithdrawalService.buildBatchWithdrawal(
      notes,
      batchRelayerAddress,
      recipient,
      feeRecipient,
      relayFeeBPS,
      poolAddress,
      proofInputs,
      `0x${scope.toString(16).padStart(64, "0")}` as Hex,
    );
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
   * @returns Array of correctly proven withdrawal proofs for batch relay
   */
  public async proveBatchWithdrawal(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[],
  ): Promise<WithdrawalProof[]> {
    if (!this.batchWithdrawalService) {
      throw new Error(
        "BatchWithdrawal service not initialized. Call createContractInstance first.",
      );
    }

    if (!this.contractsService) {
      throw new Error(
        "Contracts service not initialized. Call createContractInstance first.",
      );
    }

    // Get scope from pool address
    const scope = await this.contractsService.getScope(poolAddress);

    return await this.batchWithdrawalService.proveBatchWithdrawal(
      notes,
      batchRelayerAddress,
      recipient,
      feeRecipient,
      relayFeeBPS,
      poolAddress,
      proofInputs,
      `0x${scope.toString(16).padStart(64, "0")}` as Hex,
    );
  }

  /**
   * Execute a batch withdrawal with already-proven payload
   * This is used by relayers that receive pre-proven batch withdrawal payloads
   *
   * @param batchRelayerAddress - Address of BatchRelayer contract
   * @param payload - BatchWithdrawalPayload with proven proofs
   * @returns Transaction result
   */
  public async executeBatchWithdrawal(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload,
  ): Promise<BatchRelayResult> {
    if (!this.batchWithdrawalService) {
      throw new Error(
        "BatchWithdrawal service not initialized. Call createContractInstance first.",
      );
    }

    // Delegate to SDK's batch withdrawal service for execution only
    return await this.batchWithdrawalService.executeBatchRelay(
      batchRelayerAddress,
      payload,
    );
  }

  /**
   * Estimate gas for a batch withdrawal
   */
  public async estimateBatchWithdrawalGas(
    notes: AccountCommitment[],
    batchRelayerAddress: Address,
    recipient: Address,
    feeRecipient: Address,
    relayFeeBPS: bigint,
    poolAddress: Address,
    proofInputs: WithdrawalProofInput[],
  ): Promise<bigint> {
    if (!this.batchWithdrawalService) {
      throw new Error(
        "BatchWithdrawal service not initialized. Call createContractInstance first.",
      );
    }

    if (!this.contractsService) {
      throw new Error(
        "Contracts service not initialized. Call createContractInstance first.",
      );
    }

    // Get scope from pool address
    const scope = await this.contractsService.getScope(poolAddress);

    // Build payload
    const payload = await this.batchWithdrawalService.buildBatchWithdrawal(
      notes,
      batchRelayerAddress,
      recipient,
      feeRecipient,
      relayFeeBPS,
      poolAddress,
      proofInputs,
      `0x${scope.toString(16).padStart(64, "0")}` as Hex,
    );

    // Estimate gas
    return await this.batchWithdrawalService.estimateGas(
      batchRelayerAddress,
      payload,
    );
  }

  /**
   * Calculate amounts for a batch withdrawal
   */
  public calculateBatchAmounts(
    notes: AccountCommitment[],
    relayFeeBPS: bigint,
  ): {
    totalAmount: bigint;
    fee: bigint;
    amountAfterFees: bigint;
  } {
    if (!this.batchWithdrawalService) {
      // Can calculate without service since it's just math
      const totalAmount = notes.reduce((sum, note) => sum + note.value, 0n);
      const fee = (totalAmount * relayFeeBPS) / 10000n;
      const amountAfterFees = totalAmount - fee;

      return {
        totalAmount,
        fee,
        amountAfterFees,
      };
    }

    return this.batchWithdrawalService.calculateBatchAmounts(
      notes,
      relayFeeBPS,
    );
  }

  /**
   * Get the batch withdrawal service instance
   */
  public getBatchWithdrawalService(): BatchWithdrawalService | undefined {
    return this.batchWithdrawalService;
  }
}
