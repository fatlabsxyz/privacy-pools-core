import { z } from "zod";
import path from "node:path";
import { zAddress, zChainId, zNonNegativeBigInt, zPrivateKey } from "../schemes/shared.schemes.js";

// Fee BPS validation schema
export const zFeeBps = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative().max(10_000n));

// Withdraw amount validation schema
export const zWithdrawAmount = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative());

// Asset configuration schema
export const zAssetConfig = z.object({
  asset_address: zAddress,
  asset_name: z.string(),
  fee_bps: zFeeBps,
  min_withdraw_amount: zWithdrawAmount,
});

// Native currency configuration schema
export const zNativeCurrency = z.object({
  name: z.string().default("Ether"),
  symbol: z.string().default("ETH"),
  decimals: z.number().default(18)
});

// Chain configuration schema
export const zChainConfig = z.object({
  chain_id: zChainId,
  chain_name: z.string(),
  rpc_url: z.string().url(),
  max_gas_price: zNonNegativeBigInt.optional(),
  fee_receiver_address: zAddress.optional(),
  signer_private_key: zPrivateKey.optional(),
  entrypoint_address: zAddress.optional(),
  supported_assets: z.array(zAssetConfig).optional(),
  native_currency: zNativeCurrency.optional(),
});

// Common configuration schema
export const zCommonConfig = z.object({
  sqlite_db_path: z.string().transform((p) => path.resolve(p)),
  cors_allow_all: z.boolean().default(true),
  allowed_domains: z.array(z.string().url()).default(["https://testnet.privacypools.com, https://prod-privacy-pool-ui.vercel.app, https://staging-privacy-pool-ui.vercel.app, https://dev-privacy-pool-ui.vercel.app, http://localhost:3000"]),
});

// Default configuration schema
export const zDefaultConfig = z.object({
  fee_receiver_address: zAddress,
  signer_private_key: zPrivateKey,
  entrypoint_address: zAddress,
});

// Complete parsed configuration schema
export const zConfig = z
  .object({
    defaults: zDefaultConfig,
    chains: z.array(zChainConfig),
    sqlite_db_path: zCommonConfig.shape.sqlite_db_path,
    cors_allow_all: zCommonConfig.shape.cors_allow_all,
    allowed_domains: zCommonConfig.shape.allowed_domains,
  })
  .strict()
  .readonly();
