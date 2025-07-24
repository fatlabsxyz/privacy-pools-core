import { AssetConfig, ChainConfig } from "./types.js";
export declare const CONFIG: Readonly<{
    sqlite_db_path: string;
    cors_allow_all: boolean;
    allowed_domains: string[];
    defaults: {
        fee_receiver_address: `0x${string}`;
        signer_private_key: `0x${string}`;
        entrypoint_address: `0x${string}`;
        quote_expiration_time: number;
    };
    chains: {
        chain_id: number;
        chain_name: string;
        rpc_url: string;
        max_gas_price?: bigint | undefined;
        fee_receiver_address?: `0x${string}` | undefined;
        signer_private_key?: `0x${string}` | undefined;
        entrypoint_address?: `0x${string}` | undefined;
        supported_assets?: {
            asset_address: `0x${string}`;
            asset_name: string;
            fee_bps: bigint;
            min_withdraw_amount: bigint;
        }[] | undefined;
        native_currency?: {
            symbol: string;
            name: string;
            decimals: number;
        } | undefined;
    }[];
}>;
export declare const SQLITE_DB_PATH: string;
export declare const ALLOWED_DOMAINS: string[];
export declare const CORS_ALLOW_ALL: boolean;
/**
 * Gets the chain configuration by chain ID.
 *
 * @param {number} chainId - The chain ID to look up
 * @returns {ChainConfig} The chain configuration
 * @throws {ConfigError} If the chain is not found
 */
export declare function getChainConfig(chainId: number): ChainConfig;
/**
 * Gets the effective fee receiver address for a chain.
 * Uses the chain-specific address if available, otherwise falls back to the default.
 *
 * @param {number} chainId - The chain ID
 * @returns {string} The fee receiver address
 */
export declare function getFeeReceiverAddress(chainId: number): string;
/**
 * Gets the effective signer private key for a chain.
 * Uses the chain-specific key if available, otherwise falls back to the default.
 *
 * @param {number} chainId - The chain ID
 * @returns {string} The signer private key
 */
export declare function getSignerPrivateKey(chainId: number): string;
/**
 * Gets the effective entrypoint address for a chain.
 * Uses the chain-specific address if available, otherwise falls back to the default.
 *
 * @param {number} chainId - The chain ID
 * @returns {string} The entrypoint address
 */
export declare function getEntrypointAddress(chainId: number): string;
/**
 * Gets the quote expiration timeout value.
 *
 * @returns {number} Quote expiration time in miliseconds
 */
export declare function getQuoteExpirationTime(): number;
/**
 * Gets the asset configuration for a specific chain and asset address.
 *
 * @param {number} chainId - The chain ID
 * @param {string} assetAddress - The asset address
 * @returns {AssetConfig} The asset configuration, or undefined if not found
 */
export declare function getAssetConfig(chainId: number, assetAddress: string): AssetConfig;
export * from "./types.js";
//# sourceMappingURL=index.d.ts.map