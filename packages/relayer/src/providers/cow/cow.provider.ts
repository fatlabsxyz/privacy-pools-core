import { Address } from "@0xbow/privacy-pools-core-sdk";
import { TradingSdk, SupportedChainId, OrderKind, QuoteAndPost, OrderBookApi, EnrichedOrder } from "@cowprotocol/cow-sdk";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import { createModuleLogger } from "../../logger/index.js";
import { web3Provider } from "../index.js";
import { Quote, QuoteInNativeTokenParams, SwapProvider, SwapWithRefundParams } from "../swap.provider.interface.js";
import { Hex } from "viem";
import { ChainId } from "../../types.js";
import { RelayerConfig } from "../../config/config.js";

function Cow() {};
const logger = createModuleLogger(Cow);

export type CowQuote = {
  num: bigint;
  den: bigint;
  path: (string | number)[];
};

export class CowProvider implements SwapProvider {
  private sdk: Map<SupportedChainId, TradingSdk>;
  private ethDecimals: number = 18;

  constructor() {
    this.sdk = new Map();
  }

  private async createAdapter(chainId: ChainId) {
    const viemClient = await web3Provider.client(chainId);

    const adapter = new ViemAdapter({
      provider: viemClient
    });
    const config = new RelayerConfig().chain(chainId);
    const pkey = await config.signerPrivateKey();

    adapter.setSigner(pkey);
    
    return adapter; 
  }

  async quoteNativeToken({chainId, tokenAddress, amount}: QuoteInNativeTokenParams): Promise<Quote> {
    try {
      this.createSdkForChain(chainId)


      const { quoteResults } = await this.generateEthQuote(chainId, tokenAddress, amount);

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
        valueIn: { amount: tokenAmount, decimals: this.getTokenDecimals(tokenAddress)},
        valueOut: { amount: ethAmount, decimals: this.ethDecimals},
        path: ["cow_protocol"] // TODO this is the optional multihop path with fees and stuff
        }; 
    } catch(error) {
      logger.error(`CoW SDK request failed: ${error}`);
      throw new Error(`CoW SDK request failed: ${error}`);
    } 
  }


  async swapExactInputForWeth(params: SwapWithRefundParams): Promise<Hex>  {
    const { chainId, tokenIn, refundAmount } = params;
    const orderBookApi = this.getOrderBookApi(chainId);

    // get quote in native token
    const quote = await this.generateEthQuote(chainId, tokenIn, refundAmount); // TODO is refund amount ok?
    // call for the swap //TODO this swaps the full amount
    const {orderId} = await quote.postSwapOrderFromQuote();
    // wait for swap to complete
    const order = await this.waitForOrderExecution(orderId, orderBookApi); 

    const trades = await orderBookApi.getTrades({ orderUid: orderId });

    if (trades.length > 0) {
      const txHash = trades[0]!.txHash;
      logger.info('Transaction hash:', txHash)
      logger.info('Etherscan:', `https://etherscan.io/tx/${txHash}`)
      return txHash as Hex;
    } else {
      logger.error("could not get tx hash from swap order", order)
      throw Error("could not get txhash from swap")
    }
  }

  getOrderBookApi(chainId: ChainId) {
    const supportedChainId = this.getSupportedChainId(chainId);
    return new OrderBookApi({ chainId: supportedChainId });
  }

  async waitForOrderExecution(orderId: string, orderBookApi: OrderBookApi,timeoutMs = 300000): Promise<EnrichedOrder> { 
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      const order = await orderBookApi.getOrder(orderId)
      
      if (order.status === 'fulfilled') {
        console.log('✅ Order executed!')
        return order
      }
      
      if (order.status === 'cancelled' || order.status === 'expired') {
        throw new Error(`Order ${order.status}`)
      }
      
      console.log(`Order status: ${order.status}, waiting...`)
      await new Promise(resolve => setTimeout(resolve, 5000)) // Check every 5s
    }
    
    throw new Error('Order execution timeout')
  }

  private async generateEthQuote(chainId: SupportedChainId, token: Address,  amount: bigint): Promise<QuoteAndPost> {   
    const sellTokenDecimals = this.getTokenDecimals(token);
    logger.debug('Fetching CoW Protocol native price', { 
      chainId,
      address: token,
      amount: amount.toString(),
      sellTokenDecimals
    });

    const sdk = this.sdk.get(chainId)!; 

    return sdk.getQuote({
        kind: OrderKind.SELL,
        sellToken: token,
        buyToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address,
        amount: amount.toString(),
        sellTokenDecimals,
        buyTokenDecimals: this.ethDecimals
    });
  }

  private getSupportedChainId(chainId: ChainId): SupportedChainId {
    switch (chainId) {
      case 1:
        return SupportedChainId.MAINNET;
      case 11155111:
        return SupportedChainId.SEPOLIA;
      default:
        throw new Error(`Unsupported chainId ${chainId}`);
    }
  }

  private getTokenDecimals(address: Address): number {
    const addr = address.toLowerCase();
    
    const tokenDecimals: Record<string, number> = {
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,  // USDC
      '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,  // USDT  
      '0x6b175474e89094c44da98b954eedeac495271d0f': 18, // DAI
      '0xa1fdf8c4894439cc6ff5cdf354d234052e01aa59': 18, // FRAX USD
      '0xd4ca8b6d7f5a5c8b7e8c7b8f3f7b8f3f7b8f3f7b': 18  // WOETH 
      // TODO add all the other ones or figure out a better way to do this
    };

    return tokenDecimals[addr] || 18; // default to 18 decimals for unknown tokens
  }

  private async createSdkForChain(chainId: ChainId) {
    const adapter = await this.createAdapter(chainId);
    const supportedChainId = this.getSupportedChainId(chainId);
    
    if (this.sdk.get(supportedChainId) === undefined) {
      this.sdk.set(
        supportedChainId, 
        new TradingSdk(
        {
          chainId: supportedChainId,
          appCode: 'privacy-pools-relayer'
        }, 
        {}, 
        adapter
        )
      )
    } 
  }
}

