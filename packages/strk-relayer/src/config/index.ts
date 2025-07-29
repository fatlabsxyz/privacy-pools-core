import fs from "node:fs";
import path from "node:path";
import { ConfigError, RelayerError } from "../exceptions/base.exception.js";
import { zConfig } from "./schemas.js";
import { AssetConfig, ChainConfig, ChainId } from "./types.js";

/**
 * Reads the configuration file from the path specified in the CONFIG_PATH environment variable
 * or from the default path ./config.json.
 * 
 * @returns {Record<string, unknown>} The parsed configuration object
 * @throws {ConfigError} If the configuration file is not found
 */
function readConfigFile(): Record<string, unknown> {
  let configPathString = process.env["CONFIG_PATH"];
  if (!configPathString) {
    console.warn("CONFIG_PATH is not set, using default path: ./config.json");
    configPathString = "./config.json";
  }
  if (!fs.existsSync(configPathString)) {
    throw ConfigError.default("No config.json found for relayer.");
  }
  return JSON.parse(
    fs.readFileSync(path.resolve(configPathString), { encoding: "utf-8" }),
  );
}

// Parse the configuration file
const config = zConfig.parse(readConfigFile());

// Export the configuration
export const CONFIG = config;

// Export common configuration
export const ALLOWED_DOMAINS = config.allowed_domains;
export const CORS_ALLOW_ALL = config.cors_allow_all;

/**
 * Gets the chain configuration by chain name.
 * 
 * @param {ChainId} chain - The starknet chain name
 * @returns {ChainConfig} The chain configuration
 * @throws {ConfigError} If the chain is not found
 */
export function getChainConfig(chain: ChainId): ChainConfig {
  let chainConfig: ChainConfig;
  switch (chain) {
    case ChainId.Starknet: { 
      chainConfig = CONFIG.starknet_chain; 
      chainConfig.chain_name = ChainId.Starknet.toString(); 
      chainConfig.entrypoint_address = "0xStarknetAddress"; // TODO set this here
      break;
    };
    case ChainId.Sepolia: { 
      chainConfig = CONFIG.sepolia_chain;
      chainConfig.chain_name = ChainId.Sepolia.toString(); 
      chainConfig.entrypoint_address = "0xSepoliaAddress"; // TODO set this here
      break;
    };
    default: throw ConfigError.default(`Chain not supported.`);
  }
  if (!chainConfig.max_gas_price) {
    console.warn(`[CONFIG WARNING] There's no max_gas_price set for chain ${chainConfig.chain_name}`);
  }

  return chainConfig;
}

/**
 * Gets the effective fee receiver address for a chain.
 * Uses the chain-specific address if available, otherwise falls back to the default.
 * 
 * @param {ChainId} chain - Chain name, either Starknet or Sepolia
 * @returns {string} The fee receiver address
 */
export function getFeeReceiverAddress(chain: ChainId): string {
  const chainConfig = getChainConfig(chain);
  return chainConfig.fee_receiver_address || CONFIG.defaults.fee_receiver_address;
}

/**
 * Gets the effective signer private key for a chain.
 * Uses the chain-specific key if available, otherwise falls back to the default.
 * 
 * @param {ChainId} chain - Chain name, either Starknet or Sepolia
 * @returns {string} The signer private key
 */
export function getSignerPrivateKey(chain: ChainId): string {
  const chainConfig = getChainConfig(chain);
  return chainConfig.signer_private_key || CONFIG.defaults.signer_private_key;
}

/**
 * Gets the effective entrypoint address for a chain.
 * Uses the chain-specific address if available, otherwise falls back to the default.
 * 
 * @param {ChainId} chain - Chain name, either Starknet or Sepolia
 * @returns {string} The entrypoint address
 */
export function getEntrypointAddress(chain: ChainId): string {
  const chainConfig = getChainConfig(chain);
  return chainConfig.entrypoint_address || CONFIG.defaults.entrypoint_address;
}

/**
 * Gets the quote expiration timeout value.
 * 
 * @returns {number} Quote expiration time in miliseconds 
 */
export function getQuoteExpirationTime(): number {
  return CONFIG.defaults.quote_expiration_time;
}

/**
 * Gets the asset configuration for a specific chain and asset address.
 * 
 * @param {ChainId} chain - Chain name, either Starknet or Sepolia
 * @param {string} assetAddress - The asset address
 * @returns {AssetConfig} The asset configuration, or undefined if not found
 */
export function getAssetConfig(chain: ChainId, assetAddress: string): AssetConfig {
  const chainConfig = getChainConfig(chain);

  if (!chainConfig.supported_assets) {
    throw RelayerError.assetNotSupported();
  }

  const assetConfig =  chainConfig.supported_assets.find(
    asset => asset.asset_address.toLowerCase() === assetAddress.toLowerCase()
  );

  if (!assetConfig) {
    throw RelayerError.assetNotSupported();
  }

  return assetConfig

}

// Re-export types
export * from "./types.js";
