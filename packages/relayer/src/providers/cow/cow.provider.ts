import { Address } from "viem";
import { z } from "zod";
import { createModuleLogger } from "../../logger/index.js";
import { zAddress, zNonNegativeBigInt } from "../../config/schemas.js";
import { zHex } from "../../schemes/relayer/request.scheme.js";

function Cow() {};
const logger = createModuleLogger(Cow);

const CowNativePriceResponse = z.object({
  price: z.number()
});

const CowNativePriceQuoteResponse = z.object({
  price: z.number().optional(), 
  quote: z.object({
    sellToken: zAddress,
    buyToken: zAddress,
    // receiver: zAddress.optional(),
    sellAmount: zNonNegativeBigInt,
    buyAmount: zNonNegativeBigInt,
    validTo: z.number(),
    appData: zHex,
    feeAmount: zNonNegativeBigInt,
    kind: z.string(),
    partiallyFillable: z.boolean(),
    sellTokenBalance: z.string(),
    buyTokenBalance: z.string(),
    signingScheme: z.string()
  }),
  from: zAddress,
  expiration: z.string(),
  verified: z.boolean(),
  // protocolFeeSellAmount: zNonNegativeBigInt,
  protocolFeeBps: zNonNegativeBigInt
});

export type CowQuote = {
  num: bigint;
  den: bigint;
  path: (string | number)[];
};

export class CowProvider {
  private readonly baseUrl = "https://api.cow.fi";

  constructor() {
  }

  async quoteNativeToken(chainId: number, address: Address, amount: bigint): Promise<CowQuote> {
    const networkPath = chainId === 1 ? "mainnet" : "sepolia"; // TODO this should be better!
    const url = `${this.baseUrl}/${networkPath}/api/v1/quote` 

    logger.debug('Fetching CoW Protocol native price', { 
      url, 
      chainId, 
      address 
    });

    const data = { 
      sellToken: address,
      buyToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      from: address, // TODO idk
      kind: "sell",
      sellAmountBeforeFee: amount.toString()  
    }
 
    try {
      const response = await fetch(
        url, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );
     
      if (!response.ok) {
        logger.error(response);
        throw new Error(`CoW API request failed: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();

      const parse = CowNativePriceQuoteResponse.safeParse(resJson);

      const value = {
        ...parse,
        errors: parse.success ? undefined : parse.error.errors.map(err => ({ 
          message: `${err.path.join('.')}: ${err.message}` 
        }))
      }

      if (!parse.success) {
        logger.error("PARSE ERROR", parse.error);
        throw new Error(`cow response parse failed`);
      }
      
      const parsedResponse = value.data; 

      logger.debug('CoW Protocol native price response', { parsedResponse });

      const tokenAmount = parsedResponse!.quote.sellAmount;
      const ethAmount = parsedResponse!.quote.buyAmount;
      
      return {
        num: ethAmount,
        den: tokenAmount,
        path: ["cow_protocol"]
      }; 
    } catch(error) {
      logger.error("CoW API request failed MISTERIOUSLY")
      throw new Error("CoW API request failed MISTERIOUSLY");
    } 
  }
}
