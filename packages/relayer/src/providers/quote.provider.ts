import { Address, getAddress } from "viem";
import { uniswapProvider, cowProvider, web3Provider } from "./index.js";
import { FRAXUSD_ADDRESS, FXUSD_ADDRESS, WOETH_ADDRESS, YUSND_ADDRESS } from "../config/index.js";
import { ChainId } from "../types.js";
import { createModuleLogger } from "../logger/index.js";
import { QuoterError } from "../exceptions/base.exception.js";

function Quote() {};
const logger = createModuleLogger(Quote);

const USDC_ADDRESS_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_ADDRESS_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

/** WOETH is an ERC-4626 vault over OETH (1:1 with ETH); convertToAssets gives the live rate. */
const convertToAssetsAbi = [
  {
    type: "function",
    name: "convertToAssets",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ONE_WOETH = 10n ** 18n;

/** The vault rate only accrues yield, so it moves slowly; cache to avoid an RPC call per quote. */
const WOETH_RATE_CACHE_TTL_MS = 300_000;

/** Fallback rate if the on-chain read fails (~the rate as of 2026). */
const WOETH_FALLBACK_RATE = { num: 117n, den: 100n };

export class QuoteProvider {

  constructor() {
  }

  /// If your stablecoin is not listed in uniswap we quote it against USDC in uniswap
  /// 18 decimal only pls
  private async quoteNativeTokenInStablesUniswap(chainId: ChainId, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // input token has 18 decimals, USDC has 6 decimals
    // adjust the amountIn from 18 decimals to 6 decimals
    const DECIMAL_DIFFERENCE = 10n ** 12n;  // 18-6
    const adjustedAmount = amountIn / DECIMAL_DIFFERENCE;

    // Get the USDC quote - this returns how much ETH we need for X USDC
    const { valueOut, path } = (await uniswapProvider.quoteNativeToken({chainId, tokenAddress: USDC_ADDRESS_MAINNET as Address, amount: adjustedAmount}))!;

    // So num = ETH amount, den = FRXUSD or fxUSD amount in 18 decimals
    return { num: valueOut.amount, den: amountIn, path };
  }

  private woethRateCache?: { num: bigint; den: bigint; fetchedAt: number; };

  private async woethRate(chainId: ChainId, woethAddress: Address): Promise<{ num: bigint; den: bigint; }> {
    if (this.woethRateCache && Date.now() - this.woethRateCache.fetchedAt < WOETH_RATE_CACHE_TTL_MS) {
      return this.woethRateCache;
    }
    try {
      const client = await web3Provider.client(chainId);
      const assets = await client.readContract({
        address: woethAddress,
        abi: convertToAssetsAbi,
        functionName: "convertToAssets",
        args: [ONE_WOETH],
      });
      if (assets > 0n) {
        this.woethRateCache = { num: assets, den: ONE_WOETH, fetchedAt: Date.now() };
        return this.woethRateCache;
      }
      logger.warn("WOETH convertToAssets returned 0, using fallback rate");
    } catch (error) {
      logger.warn("Failed to read WOETH convertToAssets, using fallback rate", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return WOETH_FALLBACK_RATE;
  }

  private async quoteNativeTokenInWoeth(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<{ num: bigint; den: bigint; path: (string | number)[]; }> {
    // num = ETH amount, den = WOETH amount
    const rate = await this.woethRate(chainId, addressIn);
    return { num: (amountIn * rate.num) / rate.den, den: amountIn, path: [] };
  }

  /// If your stablecoin is not listed in cowswap we quote it against USDC in cowswap
  /// 18 decimal only pls
  private async quoteNativeTokenInStablesCowswap(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // input token has 18 decimals, USDC has 6 decimals
    // adjust the amountIn from 18 decimals to 6 decimals
    const DECIMAL_DIFFERENCE = 10n ** 12n;  // 18-6
    const adjustedAmount = amountIn / DECIMAL_DIFFERENCE;

    // Check if adjusted amount is too small for cow-swap
    const minAdjustedAmount = 20000n; // Minimum for 6-decimal USDC (0.02 USDC)
    if (adjustedAmount < minAdjustedAmount) {
      const errorMsg = `Amount too small for CoW Protocol quote: ${adjustedAmount.toString()} USDC units. Minimum required: ${minAdjustedAmount.toString()} USDC units (0.02 USDC)`;
      logger.error(errorMsg, { adjustedAmount, amountIn, addressIn });
      throw QuoterError.amountTooLow(errorMsg);
    }

    logger.debug(`yUSND quote: converting ${amountIn.toString()} (18 decimals) to ${adjustedAmount.toString()} (6 decimals)`);

    // Get the USDC quote - this returns how much ETH we need for X USDC
    const { valueOut, path } = (await cowProvider.quoteNativeToken({chainId, tokenAddress: USDC_ADDRESS_ARBITRUM as Address, amount: adjustedAmount}))!;

    // So num = ETH amount, den = yUSND amount in 18 decimals
    return { num: valueOut.amount, den: amountIn, path };
  }

  async quoteNativeTokenInERC20(chainId: ChainId, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // XXX: if FRXUSD, use USDC quote but adjust for decimal difference
    if (
      chainId === 1 && 
      (
        getAddress(addressIn) === getAddress(FRAXUSD_ADDRESS) ||
        getAddress(addressIn) === getAddress(FXUSD_ADDRESS)
      )
    ) {
      console.log("quoting native token in USDC")
      return this.quoteNativeTokenInStablesUniswap(chainId, amountIn);
    } else if (chainId === 1 && getAddress(addressIn) === getAddress(WOETH_ADDRESS)) {
      return this.quoteNativeTokenInWoeth(chainId, addressIn, amountIn);
    } else if (chainId === 42161) {
      // TODO: this for BARBITRUM
      if (getAddress(addressIn) === getAddress(YUSND_ADDRESS)) {
        return this.quoteNativeTokenInStablesCowswap(chainId, addressIn, amountIn)
      }
      const quote = await cowProvider.quoteNativeToken({chainId, tokenAddress: addressIn, amount: amountIn});
      return {num: quote.valueOut.amount, den: quote.valueIn.amount, path: quote.path}
    }

    const quote = await uniswapProvider.quoteNativeToken({chainId, tokenAddress: addressIn, amount: amountIn});
    
    logger.debug(`Quote returned by quote provider: ${quote}`, { quote })
    return {num: quote.valueOut.amount, den: quote.valueIn.amount, path: quote.path}
  }
}
