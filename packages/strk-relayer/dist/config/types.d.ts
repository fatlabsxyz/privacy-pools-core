import { z } from "zod";
import { zAssetConfig, zChainConfig, zCommonConfig, zDefaultConfig, zConfig, zNativeCurrency } from "./schemas.js";
export type AssetConfig = z.infer<typeof zAssetConfig>;
export type ChainConfig = z.infer<typeof zChainConfig>;
export type NativeCurrency = z.infer<typeof zNativeCurrency>;
export type CommonConfig = z.infer<typeof zCommonConfig>;
export type DefaultConfig = z.infer<typeof zDefaultConfig>;
export type Config = z.infer<typeof zConfig>;
//# sourceMappingURL=types.d.ts.map