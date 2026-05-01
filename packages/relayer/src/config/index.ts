import { Address, getAddress } from "viem";
import { ChainId } from "../types.js";

export { RelayerConfig } from "./config.js";

// ARBITRUM
export const YUSND_ADDRESS_ARB  = getAddress("0x252b965400862d94bda35fecf7ee0f204a53cc36");  // yUSND

// ETH MAINNET
export const BOLD_ADDRESS       = getAddress("0x6440f144b7e50D6a8439336510312d2F54beB01D");  // BOLD 
export const FRAXUSD_ADDRESS    = getAddress("0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29");  // FRAXUSD
export const FXUSD_ADDRESS      = getAddress("0x085780639cc2cacd35e474e71f4d000e2405d8f6");  // fxUSD
export const WOETH_ADDRESS      = getAddress("0xDcEe70654261AF21C44c093C300eD3Bb97b78192");  // WOETH

// Checks if a token is stable and illiquid (which can't be quoted normally)
export function isIlliquidStableCoin(chainId: ChainId, asset: Address): boolean {
    let coins: Address[];
    if (chainId === 1) {
        coins = [
            FRAXUSD_ADDRESS,
            FXUSD_ADDRESS,
            BOLD_ADDRESS,
        ];
    } else if (chainId === 42161) {
        coins = [
            YUSND_ADDRESS_ARB
        ];
    } else {
        return false;
    }
    return coins.includes(getAddress(asset));
}

// Re-export types
export * from "./types.js";
export * from "./schemas.js";
