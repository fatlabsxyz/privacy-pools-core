import { min } from "../utils.js";


export class ChickenService {
    // a typical withdrawal costs between 450k-650k gas
    relayTxGasUnits = 650_000n;
    // approximate value of a uniswap Router call. Can vary greatly if doing multi-hop swaps.
    extraGasTxGasUnits = 320_000n;
    // this gas will be transformed into equivalent native units at the time of the fund swap.
    extraGasFundGasUnits = 600_000n;

    extraGasTotalGasUnits = this.extraGasTxGasUnits + this.extraGasFundGasUnits;

    constructor () {
    } 

    async getFeeBPS(
        // assetAddress: Address,
        baseFee: bigint, 
        balance: bigint, 
        nativeQuote: { num: bigint, den: bigint; }, 
        gasPrice: bigint, 
        extraGas: boolean
    ): Promise<bigint> {  

        // TODO: if it's illiquid token we should charge 10% over total BPS

        const extraGasUnits = extraGas ? this.extraGasTotalGasUnits : 0n;
        const totalGasUnits = this.relayTxGasUnits + extraGasUnits;
        const nativeCosts = (1n * gasPrice * totalGasUnits);
        const feeBPS = baseFee + nativeQuote.den * 10_000n * nativeCosts / balance / nativeQuote.num;

        return feeBPS;
    }

    async calculateSendAmount(
        params: {
        withdrawnValueInEther: bigint, 
        relayFeeBPS: bigint, 
        baseFeeBPS: bigint,
        relayGasPrice: bigint,
        gasPrice: bigint
        }
    ): Promise<bigint> {
    const { withdrawnValueInEther, relayFeeBPS, baseFeeBPS, relayGasPrice, gasPrice } = params;

    const feeGross = withdrawnValueInEther * relayFeeBPS / 10_000n; // full extra gas + fee amount
    const relayerProfit = withdrawnValueInEther  * baseFeeBPS / 10_000n;
    
    const relayTxGasCost = gasPrice * this.extraGasTxGasUnits + relayGasPrice * this.relayTxGasUnits;

    const sendGasUnits = 21000n; // we're just doing ETH send, but ERC-20 token transfers typically cost 50,000–65,000 gas units
    const sendTxCost = gasPrice * sendGasUnits;

    const valueNet = feeGross - relayerProfit - relayTxGasCost - sendTxCost;

    const amountToSend = min(650_000n, valueNet); 


    return amountToSend;
    }
}
