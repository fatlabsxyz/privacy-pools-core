import { z } from "zod";
import { Address } from "../types.js";
// import { getAddress } from "viem";
// import path from "node:path";

const zNonNegativeBigInt = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative());

// Address validation schema
export const zAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]+/)
  .length(42)
  // .transform((v) => getAddress(v));   // TODO check if we can validate the address with starknetjs

// Quote timeout validation schema
export const zQuoteTime = z
  .number()
  .min(12, { message: 'Quote timeout must be at least 12 seconds' })
  .transform((v) => v * 1000);    // convert to ms


// Private key validation schema
export const zPkey = z
  .string()
  .regex(/^0x[0-9a-fA-F]+/)
  .length(66)
  .transform((v) => v as Address);

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
  name: z.string().default("Ether"), //TODO this should be strk???
  symbol: z.string().default("ETH"),
  decimals: z.number().default(18)
});

// Chain configuration schema
export const zChainConfig = z.object({
  chain_name: z.string().optional(),
  rpc_url: z.string().url(),
  max_gas_price: zNonNegativeBigInt,
  fee_receiver_address: zAddress,
  signer_private_key: zPkey,
  entrypoint_address: zAddress.optional(),
  supported_assets: z.array(zAssetConfig).optional(),
  native_currency: zNativeCurrency.optional()
});

// Common configuration schema
export const zCommonConfig = z.object({
  cors_allow_all: z.boolean().default(true),
  allowed_domains: z.array(z.string().url()).default(["https://testnet.privacypools.com, https://prod-privacy-pool-ui.vercel.app, https://staging-privacy-pool-ui.vercel.app, https://dev-privacy-pool-ui.vercel.app, http://localhost:3000"]),
});

// Default configuration schema
export const zDefaultConfig = z.object({
  fee_receiver_address: zAddress,
  signer_private_key: zPkey,
  entrypoint_address: zAddress,
  quote_expiration_time: zQuoteTime,
});

// Complete configuration schema
export const zConfig = z
  .object({
    defaults: zDefaultConfig,
    starknet_chain: zChainConfig,
    sepolia_chain: zChainConfig,
    cors_allow_all: zCommonConfig.shape.cors_allow_all,
    allowed_domains: zCommonConfig.shape.allowed_domains,
  })
  .strict()
  .readonly();
