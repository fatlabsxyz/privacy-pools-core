import { Hex } from "../../types.js";

/**
 * Represents the relayer commitment for a pre-built withdrawal.
 */
export interface FeeCommitment {
  withdrawalData: Hex,
  asset: Hex,
  expiration: number,
  amount: bigint,
  extraGas: boolean,
  signedRelayerCommitment: Hex, //TODO: not sure if this should be Hex or Address
}

