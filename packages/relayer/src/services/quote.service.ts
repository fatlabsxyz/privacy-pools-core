import { Address, getAddress } from "viem";
import { quoteProvider, web3Provider } from "../providers/index.js";
import { ChainId } from "../types.js";
import { ChickenService } from "./chicken.service.js";

interface QuoteFeeBPSParams {
  chainId: ChainId,
  assetAddress: Address,
  amountIn: bigint,
  baseFeeBPS: bigint,
  extraGas: boolean;
};

const NativeAddress = getAddress("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
const NativeWETHAddress = getAddress("0x4200000000000000000000000000000000000006");

export interface QuoteFee {
  feeBPS: bigint;
  path: (string | number)[];
  gasPrice: bigint;
  relayTxGasUnits: bigint;
  extraGasTxGasUnits?: bigint;
  extraGasFundGasUnits?: bigint;
  out?: bigint;
};

export class QuoteService {

  async quote(quoteParams: QuoteFeeBPSParams): Promise<QuoteFee> {
    const { chainId, assetAddress, amountIn, baseFeeBPS, extraGas } = quoteParams;
    const chickenService = new ChickenService();

    let quote: { num: bigint, den: bigint; path: (string | number)[]; };
    if (assetAddress === NativeAddress) {
      quote = { num: 1n, den: 1n, path: [] };
    } else if (assetAddress === NativeWETHAddress) {
      quote = { num: 1n, den: 1n, path: [] };          // XXX: for 0x420 we treat it as ETH
    } else {
      quote = await quoteProvider.quoteNativeTokenInERC20(chainId, assetAddress, amountIn);
    }

    const gasPrice = await web3Provider.getGasPrice(chainId);

    return {
        feeBPS: await chickenService.getFeeBPS(baseFeeBPS, amountIn, quote, gasPrice, extraGas),
        gasPrice,
        relayTxGasUnits: chickenService.relayTxGasUnits,
        extraGasFundGasUnits: extraGas ? chickenService.extraGasFundGasUnits: undefined,
        extraGasTxGasUnits: extraGas ? chickenService.extraGasTxGasUnits: undefined,
        path: quote.path,
        out: quote.num
    };
  }

}
