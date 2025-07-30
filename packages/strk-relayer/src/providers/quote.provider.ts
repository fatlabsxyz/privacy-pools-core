import { ChainId } from "../config/types.js";
import { Address } from "../types.js";

export type QuoteResponse = {
  num: bigint,
  den: bigint,
  path: (string|number)[]
}

// TODO define address type more precisely, since starknet just uses string
/// The most basic impl of quote provider calculates the fee amount that your relay would charge for the transaction.
export interface IQuoteProvider {
  quoteNativeTokenInERC20(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<QuoteResponse> 
}

