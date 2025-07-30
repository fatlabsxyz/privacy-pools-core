import { PragmaProvider } from "./pragma/provider.js";
import { StarknetProvider } from "./starknet.provider.js";
export { StarknetProvider, keysToAccount } from "./starknet.provider.js";
export { StarknetSdkProvider } from "./sdk.provider.js";

export const starknetProvider = new StarknetProvider();
export const quoteProvider = new PragmaProvider();
