import { z } from "zod";
import { 
  zAssetConfig, 
  zChainConfig, 
  zCommonConfig, 
  zDefaultConfig, 
  zVariableChainConfig, 
  zConfig,
  zNativeCurrency
} from "./schemas.js";

// Export types derived from Zod schemas
export type AssetConfig = z.infer<typeof zAssetConfig>;
export type ChainConfig = z.infer<typeof zChainConfig>;
export type VariableChainConfig = z.infer<typeof zVariableChainConfig>;
export type UpdateChainConfigBody = VariableChainConfig;
export type NativeCurrency = z.infer<typeof zNativeCurrency>;
export type CommonConfig = z.infer<typeof zCommonConfig>;
export type DefaultConfig = z.infer<typeof zDefaultConfig>;
export type Config = z.infer<typeof zConfig>; 
// export type VariableConfig = z.infer<typeof zVariableConfig>; 
