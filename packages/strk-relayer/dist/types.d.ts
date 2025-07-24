import { Address } from "viem/accounts";
import { RelayerResponse } from "./interfaces/relayer/request.js";
import { QuoteResponse } from "./interfaces/relayer/quote.js";
import { FeeCommitment } from "./interfaces/relayer/common.js";
export declare abstract class RelayerMarshall {
    abstract toJSON(): object;
}
export declare class DetailsMarshall extends RelayerMarshall {
    private details;
    constructor(details: {
        feeBPS: bigint;
        feeReceiverAddress: Address;
        chainId?: number;
        quoteExpirationTime: number;
        assetAddress?: Address;
        minWithdrawAmount?: bigint;
        maxGasPrice?: bigint;
    });
    toJSON(): object;
}
export declare class RequestMashall extends RelayerMarshall {
    readonly response: RelayerResponse;
    constructor(response: RelayerResponse);
    toJSON(): object;
}
export declare class QuoteMarshall extends RelayerMarshall {
    readonly response: QuoteResponse;
    constructor(response: QuoteResponse);
    addFeeCommitment(feeCommitment: FeeCommitment): void;
    toJSON(): object;
}
//# sourceMappingURL=types.d.ts.map