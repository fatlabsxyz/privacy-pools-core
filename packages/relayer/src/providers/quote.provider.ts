import { Address } from "viem";
import { uniswapProvider, cowProvider } from "./index.js";
import { isIlliquidStableCoin, WOETH_ADDRESS } from "../config/index.js";
import { ChainId } from "../types.js";
import { createModuleLogger } from "../logger/index.js";
import { QuoterError } from "../exceptions/base.exception.js";
import { QuoteInNativeTokenParams } from "./swap.provider.interface.js";

function Quote() {};
const logger = createModuleLogger(Quote);

const USDC_ADDRESS_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_ADDRESS_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

export class QuoteProvider {

  constructor() {
  }

  // Pick which quoter to use depending on chain
  async quoteInNativeToken(params: QuoteInNativeTokenParams) {
    if (params.chainId === 42161) {
      return cowProvider.quoteNativeToken(params);
    } else {
      return uniswapProvider.quoteNativeToken(params);
    }
  }

  /// If your stablecoin is not listed in uniswap we quote it against USDC in uniswap
  /// 18 decimal only pls
  private async quoteNativeTokenInStables(chainId: ChainId, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // input token has 18 decimals, USDC has 6 decimals
    // adjust the amountIn from 18 decimals to 6 decimals
    const DECIMAL_DIFFERENCE = 10n ** 12n;  // 18-6
    const adjustedAmount = amountIn / DECIMAL_DIFFERENCE;

    let valueOut, path;
    if (chainId === 42161) {

        // Check if adjusted amount is too small for cow-swap
        const minAdjustedAmount = 20000n; // Minimum for 6-decimal USDC (0.02 USDC)
        if (adjustedAmount < minAdjustedAmount) {
          const errorMsg = `Amount too small for CoW Protocol quote: ${adjustedAmount.toString()} USDC units. Minimum required: ${minAdjustedAmount.toString()} USDC units (0.02 USDC)`;
          logger.error(errorMsg, { adjustedAmount, amountIn });
          throw QuoterError.amountTooLow(errorMsg);
        }

        logger.debug(`yUSND quote: converting ${amountIn.toString()} (18 decimals) to ${adjustedAmount.toString()} (6 decimals)`);

        // Get the USDC quote - this returns how much ETH we need for X USDC
        const quote = await this.quoteInNativeToken({chainId, tokenAddress: USDC_ADDRESS_ARBITRUM as Address, amount: adjustedAmount});
        valueOut = quote.valueOut;
        path = quote.path;
    } else {
        // Get the USDC quote - this returns how much ETH we need for X USDC
        const quote = await this.quoteInNativeToken({chainId, tokenAddress: USDC_ADDRESS_MAINNET as Address, amount: adjustedAmount});
        valueOut = quote.valueOut;
        path = quote.path;
    }

        // So num = ETH amount, den = FRXUSD or fxUSD amount in 18 decimals
    return { num: valueOut.amount, den: amountIn, path };
  }

  private quoteNativeTokenInWoeth(chainId: ChainId, addressIn: string, amountIn: bigint): { num: bigint; den: bigint; path: (string | number)[]; } | PromiseLike<{ num: bigint; den: bigint; path: (string | number)[]; }> {
    // Here we assume 1 WOETH ~ 1.20 ETH
    return { num: amountIn, den: (amountIn * 12n) / 10n, path: [] };
  }

  async quoteNativeTokenInERC20(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // XXX: if FRXUSD, use USDC quote but adjust for decimal difference
    if (isIlliquidStableCoin(chainId, addressIn)) {
      // TODO: could add a check in config for stablecoins to check here 
      return this.quoteNativeTokenInStables(chainId, amountIn);
    } else if (chainId === 1 && addressIn === WOETH_ADDRESS) {
      return this.quoteNativeTokenInWoeth(chainId, addressIn, amountIn);
    }   
    const quote = await this.quoteInNativeToken({chainId, tokenAddress: addressIn, amount: amountIn})
    logger.debug(`Quote returned by quote provider: ${quote}`, { quote })
    return {num: quote.valueOut.amount, den: quote.valueIn.amount, path: quote.path}
  }
}
