import { ChainId } from "../../config/types.js";
import { Address } from "../../types.js";
import { IQuoteProvider, QuoteResponse } from "../quote.provider.js";
import { Contract, Provider, uint256 } from "starknet";

export class PragmaProvider implements IQuoteProvider {

  quoteNativeTokenInERC20(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<QuoteResponse> {
    let pragma_oracle_address: Address;

    switch (chainId) {
      case ChainId.Sepolia: {
        pragma_oracle_address = "0x36031daa264c24520b11d93af622c848b2499b66b41d611bac95e13cfca131a" as Address;
        break;
      };
      case ChainId.Starknet: {
        pragma_oracle_address = "0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b" as Address; 
        break;
      };
    }
    // const provider = new Provider({ sequencer: { network: "mainnet-alpha" } });
  
    const quote: QuoteResponse = {num: 1n, den: 2n, path: [3]};
    return Promise.resolve(quote); //TODO fix using pragma, since this is insane
  } 
}
