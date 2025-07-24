export type QuoteProvided = {
  num: bigint,
  den: bigint,
  path: (string|number)
}

export type Address = string;
// TODO define address type more precisely, since starknet just uses string
export type ChainId = number;

export interface IQuoteProvider {
    quoteNativeTokenInERC20(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<QuoteProvided> 
}
