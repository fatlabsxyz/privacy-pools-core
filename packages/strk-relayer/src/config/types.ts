import { z } from "zod";
import { 
  zAssetConfig, 
  zChainConfig, 
  zCommonConfig, 
  zDefaultConfig, 
  zConfig,
  zNativeCurrency
} from "./schemas.js";
import { constants } from "starknet";

// export enum ChainId {
//   Starknet = constants.StarknetChainId.SN_MAIN,
//   Sepolia = constants.StarknetChainId.SN_SEPOLIA,
// }

export const ChainId = {
  Starknet: constants.StarknetChainId.SN_MAIN,
  Sepolia: constants.StarknetChainId.SN_SEPOLIA,
} as const;

export type ChainId = typeof ChainId[keyof typeof ChainId];

// Export types derived from Zod schemas
export type AssetConfig = z.infer<typeof zAssetConfig>;
export type ChainConfig = z.infer<typeof zChainConfig>;
export type NativeCurrency = z.infer<typeof zNativeCurrency>;
export type CommonConfig = z.infer<typeof zCommonConfig>;
export type DefaultConfig = z.infer<typeof zDefaultConfig>;
export type Config = z.infer<typeof zConfig>; 
