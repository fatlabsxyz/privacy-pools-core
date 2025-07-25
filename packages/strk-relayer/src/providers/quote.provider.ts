import { ChainName } from "../config/types.js";
import { Address } from "../types.js";

export type QuoteResponse = {
  num: bigint,
  den: bigint,
  path: (string|number)
}

// TODO define address type more precisely, since starknet just uses string
export interface IQuoteProvider {
  quoteNativeTokenInERC20(chainName: ChainName, addressIn: Address, amountIn: bigint): Promise<QuoteResponse> 
}

