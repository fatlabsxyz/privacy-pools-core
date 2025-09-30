
/**
 * Represents the relayer commitment for a pre-built withdrawal.
 */
export interface FeeCommitment {
  expiration: number,
  withdrawalData: `0x${string}`,
  signedRelayerCommitment: `0x${string}`,
}

/**
 * Represents the relayer commitment for a batch relay operation.
 * Contains all batch-specific parameters that the relayer commits to.
 */
export interface BatchFeeCommitment {
  expiration: number,
  batchRelayData: `0x${string}`,
  signedBatchRelayerCommitment: `0x${string}`,
}

