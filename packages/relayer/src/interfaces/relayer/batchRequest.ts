import {
  Withdrawal as SdkWithdrawal,
  WithdrawalProof,
} from "@0xbow/privacy-pools-core-sdk";
import { FeeCommitment } from "./common.js";
import { ProofRelayerPayload } from "./request.js";

/**
 * Represents the request body for a batch relay operation.
 * Multiple proofs are submitted for a single batch withdrawal struct
 */
export interface BatchRelayRequestBody {
  /** Single withdrawal struct with processooor = BatchRelayer */
  withdrawal: SdkWithdrawal;
  /** Array of proofs for each note being withdrawn */
  proofs: Array<{
    /** Public signals as string array */
    publicSignals: string[];
    /** Proof details */
    proof: ProofRelayerPayload;
  }>;
  /** Address of the privacy pool */
  poolAddress: string;
  /** Chain ID to process the request on */
  chainId: string | number;
  /** Optional fee commitment (if pre-negotiated) */
  feeCommitment?: FeeCommitment;
}

/**
 * Complete batch withdrawal payload for internal processing
 */
export interface BatchWithdrawalPayload {
  readonly withdrawal: SdkWithdrawal;
  readonly proofs: WithdrawalProof[];
  readonly poolAddress: string;
  readonly feeCommitment?: FeeCommitment;
}

/**
 * Batch relay response from the relayer
 */
export interface BatchRelayResponse {
  /** Indicates if the request was successful */
  success: boolean;
  /** Timestamp of the response */
  timestamp: number;
  /** Unique request identifier (UUID) */
  requestId: string;
  /** Number of notes in the batch */
  batchSize: number;
  /** Total amount withdrawn (before fees) */
  totalAmount?: string;
  /** Total fee charged */
  totalFee?: string;
  /** Optional transaction hash */
  txHash?: string;
  /** Optional error message */
  error?: string;
}

/**
 * Batch relay quote request
 */
export interface BatchRelayQuoteRequest {
  /** Number of notes to withdraw */
  batchSize: number;
  /** Total amount to withdraw */
  totalAmount: string;
  /** Chain ID */
  chainId: string | number;
  /** Optional fee commitment for pre-negotiated fees */
  feeCommitment?: FeeCommitment;
}

/**
 * Batch relay quote response
 */
export interface BatchRelayQuoteResponse {
  /** Quoted fee in basis points */
  relayFeeBPS: number;
  /** Estimated fee amount */
  estimatedFee: string;
  /** Estimated gas cost */
  estimatedGas: string;
  /** Quote expiration timestamp */
  expiresAt: number;
  /** Optional fee commitment if requested */
  feeCommitment?: FeeCommitment;
}
