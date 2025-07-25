import { ChainName } from "../../config/types.js";
import { Address, ChainId, IQuoteProvider, QuoteResponse } from "../quote.provider.js";


export class PragmaProvider implements IQuoteProvider {
  quoteNativeTokenInERC20(chainName: ChainName, addressIn: Address, amountIn: bigint): Promise<QuoteResponse> {
    const quote: QuoteResponse = {num: 1n, den: 2n, path: 3};
    return Promise.resolve(quote); //TODO fix using pragma, since this is insane
  } 
}
