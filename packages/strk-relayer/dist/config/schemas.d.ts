import { z } from "zod";
export declare const zAddress: z.ZodEffects<z.ZodString, `0x${string}`, string>;
export declare const zQuoteTime: z.ZodEffects<z.ZodNumber, number, number>;
export declare const zPkey: z.ZodEffects<z.ZodString, `0x${string}`, string>;
export declare const zFeeBps: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
export declare const zWithdrawAmount: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
export declare const zAssetConfig: z.ZodObject<{
    asset_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
    asset_name: z.ZodString;
    fee_bps: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
    min_withdraw_amount: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
}, "strip", z.ZodTypeAny, {
    asset_address: `0x${string}`;
    asset_name: string;
    fee_bps: bigint;
    min_withdraw_amount: bigint;
}, {
    asset_address: string;
    asset_name: string;
    fee_bps: string | number;
    min_withdraw_amount: string | number;
}>;
export declare const zNativeCurrency: z.ZodObject<{
    name: z.ZodDefault<z.ZodString>;
    symbol: z.ZodDefault<z.ZodString>;
    decimals: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    decimals: number;
}, {
    symbol?: string | undefined;
    name?: string | undefined;
    decimals?: number | undefined;
}>;
export declare const zChainConfig: z.ZodObject<{
    chain_id: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodNumber>;
    chain_name: z.ZodString;
    rpc_url: z.ZodString;
    max_gas_price: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>>;
    fee_receiver_address: z.ZodOptional<z.ZodEffects<z.ZodString, `0x${string}`, string>>;
    signer_private_key: z.ZodOptional<z.ZodEffects<z.ZodString, `0x${string}`, string>>;
    entrypoint_address: z.ZodOptional<z.ZodEffects<z.ZodString, `0x${string}`, string>>;
    supported_assets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        asset_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
        asset_name: z.ZodString;
        fee_bps: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
        min_withdraw_amount: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
    }, "strip", z.ZodTypeAny, {
        asset_address: `0x${string}`;
        asset_name: string;
        fee_bps: bigint;
        min_withdraw_amount: bigint;
    }, {
        asset_address: string;
        asset_name: string;
        fee_bps: string | number;
        min_withdraw_amount: string | number;
    }>, "many">>;
    native_currency: z.ZodOptional<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        symbol: z.ZodDefault<z.ZodString>;
        decimals: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        name: string;
        decimals: number;
    }, {
        symbol?: string | undefined;
        name?: string | undefined;
        decimals?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
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
}, {
    chain_id: string | number;
    chain_name: string;
    rpc_url: string;
    max_gas_price?: string | number | undefined;
    fee_receiver_address?: string | undefined;
    signer_private_key?: string | undefined;
    entrypoint_address?: string | undefined;
    supported_assets?: {
        asset_address: string;
        asset_name: string;
        fee_bps: string | number;
        min_withdraw_amount: string | number;
    }[] | undefined;
    native_currency?: {
        symbol?: string | undefined;
        name?: string | undefined;
        decimals?: number | undefined;
    } | undefined;
}>;
export declare const zCommonConfig: z.ZodObject<{
    sqlite_db_path: z.ZodEffects<z.ZodString, string, string>;
    cors_allow_all: z.ZodDefault<z.ZodBoolean>;
    allowed_domains: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    sqlite_db_path: string;
    cors_allow_all: boolean;
    allowed_domains: string[];
}, {
    sqlite_db_path: string;
    cors_allow_all?: boolean | undefined;
    allowed_domains?: string[] | undefined;
}>;
export declare const zDefaultConfig: z.ZodObject<{
    fee_receiver_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
    signer_private_key: z.ZodEffects<z.ZodString, `0x${string}`, string>;
    entrypoint_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
    quote_expiration_time: z.ZodEffects<z.ZodNumber, number, number>;
}, "strip", z.ZodTypeAny, {
    fee_receiver_address: `0x${string}`;
    signer_private_key: `0x${string}`;
    entrypoint_address: `0x${string}`;
    quote_expiration_time: number;
}, {
    fee_receiver_address: string;
    signer_private_key: string;
    entrypoint_address: string;
    quote_expiration_time: number;
}>;
export declare const zConfig: z.ZodReadonly<z.ZodObject<{
    defaults: z.ZodObject<{
        fee_receiver_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
        signer_private_key: z.ZodEffects<z.ZodString, `0x${string}`, string>;
        entrypoint_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
        quote_expiration_time: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strip", z.ZodTypeAny, {
        fee_receiver_address: `0x${string}`;
        signer_private_key: `0x${string}`;
        entrypoint_address: `0x${string}`;
        quote_expiration_time: number;
    }, {
        fee_receiver_address: string;
        signer_private_key: string;
        entrypoint_address: string;
        quote_expiration_time: number;
    }>;
    chains: z.ZodArray<z.ZodObject<{
        chain_id: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodNumber>;
        chain_name: z.ZodString;
        rpc_url: z.ZodString;
        max_gas_price: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>>;
        fee_receiver_address: z.ZodOptional<z.ZodEffects<z.ZodString, `0x${string}`, string>>;
        signer_private_key: z.ZodOptional<z.ZodEffects<z.ZodString, `0x${string}`, string>>;
        entrypoint_address: z.ZodOptional<z.ZodEffects<z.ZodString, `0x${string}`, string>>;
        supported_assets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            asset_address: z.ZodEffects<z.ZodString, `0x${string}`, string>;
            asset_name: z.ZodString;
            fee_bps: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
            min_withdraw_amount: z.ZodPipeline<z.ZodUnion<[z.ZodString, z.ZodNumber]>, z.ZodBigInt>;
        }, "strip", z.ZodTypeAny, {
            asset_address: `0x${string}`;
            asset_name: string;
            fee_bps: bigint;
            min_withdraw_amount: bigint;
        }, {
            asset_address: string;
            asset_name: string;
            fee_bps: string | number;
            min_withdraw_amount: string | number;
        }>, "many">>;
        native_currency: z.ZodOptional<z.ZodObject<{
            name: z.ZodDefault<z.ZodString>;
            symbol: z.ZodDefault<z.ZodString>;
            decimals: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            symbol: string;
            name: string;
            decimals: number;
        }, {
            symbol?: string | undefined;
            name?: string | undefined;
            decimals?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
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
    }, {
        chain_id: string | number;
        chain_name: string;
        rpc_url: string;
        max_gas_price?: string | number | undefined;
        fee_receiver_address?: string | undefined;
        signer_private_key?: string | undefined;
        entrypoint_address?: string | undefined;
        supported_assets?: {
            asset_address: string;
            asset_name: string;
            fee_bps: string | number;
            min_withdraw_amount: string | number;
        }[] | undefined;
        native_currency?: {
            symbol?: string | undefined;
            name?: string | undefined;
            decimals?: number | undefined;
        } | undefined;
    }>, "many">;
    sqlite_db_path: z.ZodEffects<z.ZodString, string, string>;
    cors_allow_all: z.ZodDefault<z.ZodBoolean>;
    allowed_domains: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
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
}, {
    sqlite_db_path: string;
    defaults: {
        fee_receiver_address: string;
        signer_private_key: string;
        entrypoint_address: string;
        quote_expiration_time: number;
    };
    chains: {
        chain_id: string | number;
        chain_name: string;
        rpc_url: string;
        max_gas_price?: string | number | undefined;
        fee_receiver_address?: string | undefined;
        signer_private_key?: string | undefined;
        entrypoint_address?: string | undefined;
        supported_assets?: {
            asset_address: string;
            asset_name: string;
            fee_bps: string | number;
            min_withdraw_amount: string | number;
        }[] | undefined;
        native_currency?: {
            symbol?: string | undefined;
            name?: string | undefined;
            decimals?: number | undefined;
        } | undefined;
    }[];
    cors_allow_all?: boolean | undefined;
    allowed_domains?: string[] | undefined;
}>>;
//# sourceMappingURL=schemas.d.ts.map