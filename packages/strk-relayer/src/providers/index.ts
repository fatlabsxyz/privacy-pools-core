import { PragmaProvider } from "./pragma/provider.js";
import { StarknetProvider } from "./starknet.provider.js";

// export { SdkProvider } from "./sdk.provider.js";
export { StarknetProvider } from "./starknet.provider.js"

export const starknetProvider = new StarknetProvider();
export const quoteProvider = new PragmaProvider();
