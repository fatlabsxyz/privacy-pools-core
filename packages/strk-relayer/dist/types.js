export class RelayerMarshall {
}
export class DetailsMarshall extends RelayerMarshall {
    details;
    constructor(details) {
        super();
        this.details = details;
    }
    toJSON() {
        let maxGasPrice;
        if (this.details.maxGasPrice !== undefined) {
            maxGasPrice = this.details.maxGasPrice.toString(10);
        }
        else {
            maxGasPrice = null;
        }
        return {
            feeBPS: this.details.feeBPS.toString(),
            feeReceiverAddress: this.details.feeReceiverAddress.toString(),
            quoteExpirationTime: this.details.quoteExpirationTime,
            chainId: this.details.chainId,
            assetAddress: this.details.assetAddress?.toString(),
            minWithdrawAmount: this.details.minWithdrawAmount?.toString(),
            maxGasPrice
        };
    }
}
export class RequestMashall extends RelayerMarshall {
    response;
    constructor(response) {
        super();
        this.response = response;
    }
    toJSON() {
        return this.response;
    }
}
export class QuoteMarshall extends RelayerMarshall {
    response;
    constructor(response) {
        super();
        this.response = response;
    }
    addFeeCommitment(feeCommitment) {
        this.response.feeCommitment = {
            ...feeCommitment,
            amount: feeCommitment.amount.toString()
        };
    }
    toJSON() {
        const detail = Object.fromEntries(Object.entries(this.response.detail)
            .map(([k, v]) => {
            return [k, v ? { gas: v.gas.toString(), eth: v.eth.toString() } : undefined];
        }));
        return {
            baseFeeBPS: this.response.baseFeeBPS.toString(),
            feeBPS: this.response.feeBPS.toString(),
            gasPrice: this.response.gasPrice.toString(),
            feeCommitment: this.response.feeCommitment,
            detail,
        };
    }
}
//# sourceMappingURL=types.js.map