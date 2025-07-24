/**
 * Unified error codes for the Relayer.
 */
export declare enum ErrorCode {
    UNKNOWN = "UNKNOWN",
    INVALID_INPUT = "INVALID_INPUT",
    INVALID_DATA = "INVALID_DATA",
    INVALID_ABI = "INVALID_ABI",
    PROCESSOOOR_MISMATCH = "PROCESSOOOR_MISMATCH",
    FEE_RECEIVER_MISMATCH = "FEE_RECEIVER_MISMATCH",
    FEE_MISMATCH = "FEE_MISMATCH",
    FEE_TOO_LOW = "FEE_TOO_LOW",
    CONTEXT_MISMATCH = "CONTEXT_MISMATCH",
    RELAYER_COMMITMENT_REJECTED = "RELAYER_COMMITMENT_REJECTED",
    INSUFFICIENT_WITHDRAWN_VALUE = "INSUFFICIENT_WITHDRAWN_VALUE",
    ASSET_NOT_SUPPORTED = "ASSET_NOT_SUPPORTED",
    INVALID_CONFIG = "INVALID_CONFIG",
    FEE_BPS_OUT_OF_BOUNDS = "FEE_BPS_OUT_OF_BOUNDS",
    CHAIN_NOT_SUPPORTED = "CHAIN_NOT_SUPPORTED",
    MAX_GAS_PRICE = "MAX_GAS_PRICE",
    INVALID_PROOF = "INVALID_PROOF",
    CONTRACT_ERROR = "CONTRACT_ERROR",
    TRANSACTION_ERROR = "TRANSACTION_ERROR",
    SDK_ERROR = "SDK_ERROR",
    QUOTE_ERROR = "QUOTE_ERROR"
}
/**
 * Base error class for the Relayer.
 * All other error classes should extend this.
 */
export declare class RelayerError extends Error {
    readonly code: ErrorCode;
    readonly details?: (Record<string, unknown> | string) | undefined;
    constructor(message: string, code?: ErrorCode, details?: (Record<string, unknown> | string) | undefined);
    /**
     * Creates a JSON representation of the error.
     */
    toJSON(): Record<string, unknown>;
    toPrettyString(): string;
    static unknown(message?: string): RelayerError;
    static assetNotSupported(details?: Record<string, unknown> | string): RelayerError;
}
export declare class ValidationError extends RelayerError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    /**
     * Creates an error for input validation failures.
     */
    static invalidInput(details?: Record<string, unknown>): ValidationError;
    static invalidQuerystring(details?: Record<string, unknown>): ValidationError;
}
export declare class ZkError extends RelayerError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown>);
    /**
     * Creates an error for input validation failures.
     */
    static invalidProof(details?: Record<string, unknown>): ZkError;
}
export declare class ConfigError extends RelayerError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown> | string);
    /**
     * Creates an error for input validation failures.
     */
    static default(details?: Record<string, unknown> | string): ConfigError;
    /**
     * Creates an error for gas price spikes
     */
    static maxGasPrice(details?: Record<string, unknown> | string): ConfigError;
}
export declare class WithdrawalValidationError extends RelayerError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown> | string);
    static invalidWithdrawalAbi(details?: Record<string, unknown>): WithdrawalValidationError;
    static processooorMismatch(details?: string): WithdrawalValidationError;
    static feeReceiverMismatch(details: string): WithdrawalValidationError;
    static feeTooLow(details: string): WithdrawalValidationError;
    static feeMismatch(details: string): WithdrawalValidationError;
    static relayerCommitmentRejected(details: string): WithdrawalValidationError;
    static contextMismatch(details: string): WithdrawalValidationError;
    static withdrawnValueTooSmall(details: string): WithdrawalValidationError;
    static assetNotSupported(details: string): WithdrawalValidationError;
}
export declare class SdkError extends RelayerError {
    constructor(message: string, details?: Record<string, unknown> | string);
    static scopeDataError(error: Error): SdkError;
}
export declare class BlockchainError extends RelayerError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown> | string);
    static txError(details?: Record<string, unknown> | string): BlockchainError;
}
export declare class QuoterError extends RelayerError {
    constructor(message: string, code?: ErrorCode, details?: Record<string, unknown> | string);
    static assetNotSupported(details?: Record<string, unknown> | string): QuoterError;
}
//# sourceMappingURL=base.exception.d.ts.map