type QuoteProvided = {
    num: bigint;
    den: bigint;
    path: (string | number);
};
export interface QuoteProvider {
    quoteNativeTokenInERC20(chainId: number, addressIn: Address, amountIn: bigint): Promise<QuoteProvided>;
}
export {};
//# sourceMappingURL=quote.provider.d.ts.map