import { Address } from "viem/accounts";
import { Mock, vi } from "vitest";
import { SdkProvider } from "../../src/providers/sdk.provider";
import { SdkProviderInterface } from "../../src/types/sdk.types.ts";
import { ASSET_ADDRESS_TEST } from "../inputs/default.input";

export function createSdkProviderMock(overrides?: {
  [key in keyof SdkProviderInterface]?: Mock;
}): SdkProviderInterface {
  return {
    scopeData: vi.fn().mockImplementation(async () => {
      return {
        poolAddress: "0x0" as Address,
        assetAddress: ASSET_ADDRESS_TEST,
      };
    }),
    broadcastWithdrawal: vi.fn().mockImplementation(async () => {
      return { hash: "0xTx" };
    }),
    calculateContext: SdkProvider.prototype.calculateContext,
    verifyWithdrawal: vi.fn().mockResolvedValue(true),
    getAssetConfig: vi.fn().mockImplementation(async () => {
      return {
        pool: "0xPool" as Address,
        minimumDepositAmount: 0n,
        vettingFeeBPS: 100n,
        maxRelayFeeBPS: 10_000n,
      };
    }),
    ...(overrides || {}),
  };
}
