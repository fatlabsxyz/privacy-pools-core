import { Address } from "viem";
import { TradingSdk, SupportedChainId, OrderKind, PrivateKey } from "@cowprotocol/cow-sdk";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import { createModuleLogger } from "../../logger/index.js";
import { web3Provider } from "../index.js";
import { getSignerPrivateKey } from "../../config/index.js";

function Cow() {};
const logger = createModuleLogger(Cow);

export type CowQuote = {
  num: bigint;
  den: bigint;
  path: (string | number)[];
};

export class CowProvider {
  private sdk: TradingSdk;

  constructor() {
    // Setup will happen per request to use correct chain
    this.sdk = new TradingSdk({
      chainId: SupportedChainId.MAINNET,
      appCode: 'privacy-pools-relayer'
    });
  }

  private createAdapter(chainId: number) {
    // Create proper viem adapter for the specific chain
    const viemClient = web3Provider.client(chainId);

    const adapter = new ViemAdapter({
      provider: viemClient
    });
    
    adapter.setSigner(getSignerPrivateKey(chainId));
    
    return adapter; 
  }

  async quoteNativeToken(chainId: number, address: Address, amount: bigint): Promise<CowQuote> {
    const supportedChainId = this.getSupportedChainId(chainId);
    const sellTokenDecimals = this.getTokenDecimals(address);
    
    logger.debug('Fetching CoW Protocol native price', { 
      chainId: supportedChainId,
      address,
      amount: amount.toString(),
      sellTokenDecimals
    });

    try {
      // Create adapter for the correct chain
      const adapter = this.createAdapter(chainId);
      
      // Update SDK for the correct chain with adapter
      this.sdk = new TradingSdk({
        chainId: supportedChainId,
        appCode: 'privacy-pools-relayer'
      }, {}, adapter);

      const { quoteResults } = await this.sdk.getQuote({
        kind: OrderKind.SELL,
        sellToken: address,
        buyToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address,
        amount: amount.toString(),
        sellTokenDecimals,
        buyTokenDecimals: 18
      });

      logger.debug('CoW SDK quote response', { quoteResults });

      if (!quoteResults?.quoteResponse?.quote?.sellAmount || !quoteResults?.quoteResponse?.quote?.buyAmount) {
        logger.error('Invalid quote response structure', { quoteResults });
        throw new Error('Invalid quote response from CoW SDK');
      }

      const tokenAmount = BigInt(quoteResults.quoteResponse.quote.sellAmount);
      const ethAmount = BigInt(quoteResults.quoteResponse.quote.buyAmount);
      
      logger.debug('CoW Protocol native price response', { 
        tokenAmount: tokenAmount.toString(),
        ethAmount: ethAmount.toString()
      });

      return {
        num: ethAmount,
        den: tokenAmount,
        path: ["cow_protocol"]
      }; 
    } catch(error) {
      logger.error(`CoW SDK request failed: ${error}`);
      throw new Error(`CoW SDK request failed: ${error}`);
    } 
  }

  private getSupportedChainId(chainId: number): SupportedChainId {
    switch (chainId) {
      case 1:
        return SupportedChainId.MAINNET;
      case 11155111:
        return SupportedChainId.SEPOLIA;
      default:
        throw new Error(`Unsupported chainId ${chainId}. Only mainnet (1) and sepolia (11155111) are supported.`);
    }
  }

  private getTokenDecimals(address: Address): number {
    const addr = address.toLowerCase();
    
    // Common token decimals mapping
    const tokenDecimals: Record<string, number> = {
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,  // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,  // USDT  
      '0x6b175474e89094c44da98b954eedeac495271d0f': 18, // DAI
      '0xa1fdf8c4894439cc6ff5cdf354d234052e01aa59': 18, // FRAX USD
      '0xd4ca8b6d7f5a5c8b7e8c7b8f3f7b8f3f7b8f3f7b': 18  // WOETH (placeholder)
    };

    return tokenDecimals[addr] || 18; // Default to 18 decimals for unknown tokens
  }
}
