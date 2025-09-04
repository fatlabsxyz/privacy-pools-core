import { Address, Hex, Hash as TxHash } from "viem";
import { Groth16Proof, PublicSignals } from "snarkjs";
import { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import { Hash, Secret } from "./commitment.js";

/**
 * Represents a withdrawal request in the system.
 */
export interface Withdrawal {
  readonly processooor: Address;
  readonly data: Hex;
}

export interface WithdrawalProof {
  readonly proof: Groth16Proof;
  readonly publicSignals: PublicSignals;
}

/**
 * Input parameters required for withdrawal proof generation.
 */
export interface WithdrawalProofInput {
  readonly context: bigint;
  readonly withdrawalAmount: bigint;
  readonly stateMerkleProof: LeanIMTMerkleProof<bigint>;
  readonly aspMerkleProof: LeanIMTMerkleProof<bigint>;
  readonly stateRoot: Hash;
  readonly stateTreeDepth: bigint;
  readonly aspRoot: Hash;
  readonly aspTreeDepth: bigint;
  readonly newSecret: Secret;
  readonly newNullifier: Secret;
}

/**
 * BatchRelayData struct that gets encoded in withdrawal.data for batch withdrawals
 */
export interface BatchRelayData {
  readonly recipient: Address; // final receiver of funds
  readonly feeRecipient: Address; // fee receiver (relayer)
  readonly relayFeeBPS: bigint; // fee in basis points
  readonly batchSize: number; // number of withdrawals expected (uint8)
  readonly totalValue: bigint; // total value of all withdrawals in the batch
}

/**
 * Batch withdrawal payload for SDK methods
 */
export interface BatchWithdrawalPayload {
  readonly withdrawal: Withdrawal; // Standard withdrawal with processooor = BatchRelayer
  readonly proofs: WithdrawalProof[]; // Array of proofs for each note
  readonly poolAddress: Address; // The privacy pool to withdraw from
}

/**
 * Result returned after a successful batch relay transaction
 */
export interface BatchRelayResult {
  readonly transactionHash: TxHash;
  readonly recipient: Address;
  readonly totalAmount: bigint;
  readonly fee: bigint;
  readonly amountAfterFees: bigint;
}
