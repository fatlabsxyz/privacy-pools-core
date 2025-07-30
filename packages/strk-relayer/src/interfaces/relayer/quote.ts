import { Address, Hex } from "../../types.js";

export interface QuotetBody {
  /** Chain ID to process the request on */
  chainId: string | number;
  /** Potential balance to withdraw */
  amount: string;
  /** Asset address */
  asset: string;
  /** Asset address */
  recipient?: string;
  /** Extra gas flag */
  extraGas: boolean;
}

export interface QuoteResponse {
  baseFeeBPS: bigint,
  feeBPS: bigint,
  gasPrice: bigint,
  detail: { [key: string]: { gas: bigint, eth: bigint; } | undefined; };
  feeCommitment?: {
    expiration: number,
    withdrawalData: Hex, //TODO not sure if this should be Hex or Address
    amount: string,
    extraGas: boolean,
    signedRelayerCommitment: Hex, //TODO not sure if this should be Hex or Address

  };
}
