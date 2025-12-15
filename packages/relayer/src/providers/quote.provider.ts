import { Address, getAddress } from "viem";
import { uniswapProvider, cowProvider } from "./index.js";
import { FRAXUSD_ADDRESS, WOETH_ADDRESS } from "../config/index.js";
import { ChainId } from "../types.js";
import { createModuleLogger } from "../logger/index.js";

function Quote() {};
const logger = createModuleLogger(Quote);

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export class QuoteProvider {

  constructor() {
  }

  private async quoteNativeTokenInFrax(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // FRXUSD has 18 decimals, USDC has 6 decimals
    // adjust the amountIn from 18 decimals to 6 decimals
    const DECIMAL_DIFFERENCE = 10n ** 12n;  // 18-6
    const adjustedAmount = amountIn / DECIMAL_DIFFERENCE;

    // Get the USDC quote - this returns how much ETH we need for X USDC
    const { valueOut, path } = (await uniswapProvider.quoteNativeToken({chainId, tokenAddress: USDC_ADDRESS as Address, amount: adjustedAmount}))!;

    // So num = ETH amount, den = FRXUSD amount in 18 decimals
    return { num: valueOut.amount, den: amountIn, path };
  }

  private quoteNativeTokenInWoeth(chainId: ChainId, addressIn: string, amountIn: bigint): { num: bigint; den: bigint; path: (string | number)[]; } | PromiseLike<{ num: bigint; den: bigint; path: (string | number)[]; }> {
    // Here we assume 1 WOETH ~ 1.20 ETH
    return { num: amountIn, den: (amountIn * 12n) / 10n, path: [] };
  }

  async quoteNativeTokenInERC20(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // XXX: if FRXUSD, use USDC quote but adjust for decimal difference
    if (chainId === 1 && getAddress(addressIn) === getAddress(FRAXUSD_ADDRESS)) {
      return this.quoteNativeTokenInFrax(chainId, addressIn, amountIn);
    } else if (chainId === 1 && getAddress(addressIn) === getAddress(WOETH_ADDRESS)) {
      return this.quoteNativeTokenInWoeth(chainId, addressIn, amountIn);
    } else if (chainId === 42161) {
      // TODO: this for BARBITRUM
      const quote = await cowProvider.quoteNativeToken({chainId, tokenAddress: addressIn, amount: amountIn});
      return {num: quote.valueOut.amount, den: quote.valueIn.amount, path: quote.path}
    }

    const quote = await uniswapProvider.quoteNativeToken({chainId, tokenAddress: addressIn, amount: amountIn});
    
    logger.debug(`Quote returned by quote provider: ${quote}`, { quote })
    return {num: quote.valueOut.amount, den: quote.valueIn.amount, path: quote.path}
  }
}
