import { Address, Chain, BaseError as ViemError } from "viem";
import { RelayRequestBody, WithdrawPublicSignals } from "./interfaces/relayer/request.js";
interface WithdrawalData {
    recipient: Address;
    feeRecipient: Address;
    relayFeeBPS: bigint;
}
export declare function decodeWithdrawalData(data: `0x${string}`): WithdrawalData;
export declare function encodeWithdrawalData(withdrawalData: WithdrawalData): `0x${string}`;
export declare function parseSignals(signals: RelayRequestBody["publicSignals"]): WithdrawPublicSignals;
/**
 * Creates a Chain object for the given chain configuration
 *
 * @param {object} chainConfig - The chain configuration
 * @returns {Chain} - The Chain object
 */
export declare function createChainObject(chainConfig: {
    chain_id: number;
    chain_name: string;
    rpc_url: string;
    native_currency?: {
        name: string;
        symbol: string;
        decimals: number;
    };
}): Chain;
export declare function isViemError(error: unknown): error is ViemError;
export declare function isFeeReceiverSameAsSigner(chainId: number): boolean;
export declare function isNative(asset: `0x${string}`): boolean;
export {};
//# sourceMappingURL=utils.d.ts.map