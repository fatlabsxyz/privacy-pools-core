/**
 * Unified error codes for the Relayer.
 */
export var ErrorCode;
(function (ErrorCode) {
    // Base errors
    ErrorCode["UNKNOWN"] = "UNKNOWN";
    ErrorCode["INVALID_INPUT"] = "INVALID_INPUT";
    // Withdrawal data assertions
    ErrorCode["INVALID_DATA"] = "INVALID_DATA";
    ErrorCode["INVALID_ABI"] = "INVALID_ABI";
    ErrorCode["PROCESSOOOR_MISMATCH"] = "PROCESSOOOR_MISMATCH";
    ErrorCode["FEE_RECEIVER_MISMATCH"] = "FEE_RECEIVER_MISMATCH";
    ErrorCode["FEE_MISMATCH"] = "FEE_MISMATCH";
    ErrorCode["FEE_TOO_LOW"] = "FEE_TOO_LOW";
    ErrorCode["CONTEXT_MISMATCH"] = "CONTEXT_MISMATCH";
    ErrorCode["RELAYER_COMMITMENT_REJECTED"] = "RELAYER_COMMITMENT_REJECTED";
    ErrorCode["INSUFFICIENT_WITHDRAWN_VALUE"] = "INSUFFICIENT_WITHDRAWN_VALUE";
    ErrorCode["ASSET_NOT_SUPPORTED"] = "ASSET_NOT_SUPPORTED";
    // Config errors
    ErrorCode["INVALID_CONFIG"] = "INVALID_CONFIG";
    ErrorCode["FEE_BPS_OUT_OF_BOUNDS"] = "FEE_BPS_OUT_OF_BOUNDS";
    ErrorCode["CHAIN_NOT_SUPPORTED"] = "CHAIN_NOT_SUPPORTED";
    ErrorCode["MAX_GAS_PRICE"] = "MAX_GAS_PRICE";
    // Proof errors
    ErrorCode["INVALID_PROOF"] = "INVALID_PROOF";
    // Contract errors
    ErrorCode["CONTRACT_ERROR"] = "CONTRACT_ERROR";
    ErrorCode["TRANSACTION_ERROR"] = "TRANSACTION_ERROR";
    // SDK error. Wrapper for sdk's native errors
    ErrorCode["SDK_ERROR"] = "SDK_ERROR";
    // Quote errors
    ErrorCode["QUOTE_ERROR"] = "QUOTE_ERROR";
})(ErrorCode || (ErrorCode = {}));
/**
 * Base error class for the Relayer.
 * All other error classes should extend this.
 */
export class RelayerError extends Error {
    code;
    details;
    constructor(message, code = ErrorCode.UNKNOWN, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = this.constructor.name;
        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
    }
    /**
     * Creates a JSON representation of the error.
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
        };
    }
    toPrettyString() {
        let details;
        if (typeof this.details === "object") {
            details = JSON.stringify(this.details);
        }
        else if (typeof this.details === "string") {
            details = this.details;
        }
        else {
            details = "";
        }
        return `${this.name}::${this.code}(${this.message}, ${details})`;
    }
    static unknown(message) {
        return new RelayerError(message || "", ErrorCode.UNKNOWN);
    }
    static assetNotSupported(details) {
        return new RelayerError("Asset is not supported", ErrorCode.ASSET_NOT_SUPPORTED, details);
    }
}
export class ValidationError extends RelayerError {
    constructor(message, code = ErrorCode.INVALID_INPUT, details) {
        super(message, code, details);
        this.name = this.constructor.name;
    }
    /**
     * Creates an error for input validation failures.
     */
    static invalidInput(details) {
        return new ValidationError("Failed to parse request payload", ErrorCode.INVALID_INPUT, details);
    }
    static invalidQuerystring(details) {
        return new ValidationError("Failed to parse request parameters", ErrorCode.INVALID_INPUT, details);
    }
}
export class ZkError extends RelayerError {
    constructor(message, code = ErrorCode.INVALID_PROOF, details) {
        super(message, code, details);
        this.name = this.constructor.name;
    }
    /**
     * Creates an error for input validation failures.
     */
    static invalidProof(details) {
        return new ZkError("Invalid proof", ErrorCode.INVALID_PROOF, details);
    }
}
export class ConfigError extends RelayerError {
    constructor(message, code = ErrorCode.INVALID_CONFIG, details) {
        super(message, code, details);
        this.name = this.constructor.name;
    }
    /**
     * Creates an error for input validation failures.
     */
    static default(details) {
        return new ConfigError("Invalid config", ErrorCode.INVALID_CONFIG, details);
    }
    /**
     * Creates an error for gas price spikes
     */
    static maxGasPrice(details) {
        return new ConfigError("Gas price too high", ErrorCode.MAX_GAS_PRICE, details);
    }
}
export class WithdrawalValidationError extends RelayerError {
    constructor(message, code = ErrorCode.INVALID_DATA, details) {
        super(message, code, details);
        this.name = this.constructor.name;
    }
    static invalidWithdrawalAbi(details) {
        return new WithdrawalValidationError("Failed to parse withdrawal data", ErrorCode.INVALID_ABI, details);
    }
    static processooorMismatch(details) {
        return new WithdrawalValidationError("Processooor must be the Entrypoint when relaying", ErrorCode.PROCESSOOOR_MISMATCH, details);
    }
    static feeReceiverMismatch(details) {
        return new WithdrawalValidationError("Fee receiver does not match relayer", ErrorCode.FEE_RECEIVER_MISMATCH, details);
    }
    static feeTooLow(details) {
        return new WithdrawalValidationError("Fee is lower than required by relayer", ErrorCode.FEE_TOO_LOW, details);
    }
    static feeMismatch(details) {
        return new WithdrawalValidationError("Fee does not match relayer fee", ErrorCode.FEE_MISMATCH, details);
    }
    static relayerCommitmentRejected(details) {
        return new WithdrawalValidationError("Relayer commitment is too old or invalid", ErrorCode.RELAYER_COMMITMENT_REJECTED, details);
    }
    static contextMismatch(details) {
        return new WithdrawalValidationError("Context does not match public signal", ErrorCode.CONTEXT_MISMATCH, details);
    }
    static withdrawnValueTooSmall(details) {
        return new WithdrawalValidationError("Withdrawn value is too small", ErrorCode.INSUFFICIENT_WITHDRAWN_VALUE, details);
    }
    static assetNotSupported(details) {
        return new WithdrawalValidationError("Asset not supported on this chain", ErrorCode.ASSET_NOT_SUPPORTED, details);
    }
}
export class SdkError extends RelayerError {
    constructor(message, details) {
        super(message, ErrorCode.SDK_ERROR, details);
        this.name = this.constructor.name;
    }
    static scopeDataError(error) {
        return new SdkError(`SdkError: SCOPE_DATA_ERROR ${error.message}`);
    }
}
export class BlockchainError extends RelayerError {
    constructor(message, code = ErrorCode.CONTRACT_ERROR, details) {
        super(message, code, details);
        this.name = this.constructor.name;
    }
    static txError(details) {
        return new BlockchainError("Transaction failed", ErrorCode.TRANSACTION_ERROR, details);
    }
}
export class QuoterError extends RelayerError {
    constructor(message, code = ErrorCode.QUOTE_ERROR, details) {
        super(message, code, details);
        this.name = this.constructor.name;
    }
    static assetNotSupported(details) {
        return new QuoterError("Asset is not supported", ErrorCode.ASSET_NOT_SUPPORTED, details);
    }
}
//# sourceMappingURL=base.exception.js.map