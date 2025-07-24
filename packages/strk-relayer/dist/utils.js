import { ContractFunctionExecutionError, ContractFunctionRevertedError, decodeAbiParameters, encodeAbiParameters } from "viem";
import { ValidationError, WithdrawalValidationError, } from "./exceptions/base.exception.js";
import { FeeDataAbi } from "./types/abi.types.js";
import { getFeeReceiverAddress, getSignerPrivateKey } from "./config/index.js";
import { privateKeyToAccount } from "viem/accounts";
export function decodeWithdrawalData(data) {
    try {
        const [{ recipient, feeRecipient, relayFeeBPS }] = decodeAbiParameters(FeeDataAbi, data);
        return { recipient, feeRecipient, relayFeeBPS };
    }
    catch (e) {
        const error = e;
        throw WithdrawalValidationError.invalidWithdrawalAbi({
            name: error.name,
            message: error.message,
        });
    }
}
export function encodeWithdrawalData(withdrawalData) {
    try {
        return encodeAbiParameters(FeeDataAbi, [withdrawalData]);
    }
    catch (e) {
        const error = e;
        throw WithdrawalValidationError.invalidWithdrawalAbi({
            name: error.name,
            message: error.message,
        });
    }
}
export function parseSignals(signals) {
    const badSignals = signals
        .map((x, i) => (x === undefined ? i : null))
        .filter((i) => i !== null);
    if (badSignals.length > 0) {
        throw ValidationError.invalidInput({
            details: `Signals ${badSignals.join(", ")} are undefined`,
        });
    }
    /// XXX: beware this signal distribution is based on how the circuits were compiled with circomkit, first 2 are the public outputs, next are the public inputs
    return {
        newCommitmentHash: BigInt(signals[0]), // Hash of new commitment
        existingNullifierHash: BigInt(signals[1]), // Hash of the existing commitment nullifier
        withdrawnValue: BigInt(signals[2]),
        stateRoot: BigInt(signals[3]),
        stateTreeDepth: BigInt(signals[4]),
        ASPRoot: BigInt(signals[5]),
        ASPTreeDepth: BigInt(signals[6]),
        context: BigInt(signals[7]),
    };
}
/**
 * Creates a Chain object for the given chain configuration
 *
 * @param {object} chainConfig - The chain configuration
 * @returns {Chain} - The Chain object
 */
export function createChainObject(chainConfig) {
    return {
        id: chainConfig.chain_id,
        name: chainConfig.chain_name,
        nativeCurrency: chainConfig.native_currency || {
            name: "Ether",
            symbol: "ETH",
            decimals: 18
        },
        rpcUrls: {
            default: { http: [chainConfig.rpc_url] },
            public: { http: [chainConfig.rpc_url] },
        },
    };
}
export function isViemError(error) {
    const viemErrorNames = [
        ContractFunctionExecutionError.prototype.constructor.name,
        ContractFunctionRevertedError.prototype.constructor.name,
    ];
    return viemErrorNames.includes(error?.constructor?.name || "");
}
export function isFeeReceiverSameAsSigner(chainId) {
    const feeReceiverAddress = getFeeReceiverAddress(chainId);
    const signerAddress = privateKeyToAccount(getSignerPrivateKey(chainId)).address;
    return feeReceiverAddress.toLowerCase() === signerAddress.toLowerCase();
}
export function isNative(asset) {
    return asset.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}
//# sourceMappingURL=utils.js.map