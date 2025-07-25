import { RelayerResponse } from "./interfaces/relayer/request.js";
import { QuoteResponse } from "./interfaces/relayer/quote.js";
import { FeeCommitment } from "./interfaces/relayer/common.js";


// -------- idk where to put these yet --------
/// Ethereum address
export type Address = `0x${string}` & { length: 66 };

/// Hashed value
export type Hash = bigint & {
    readonly __brand: unique symbol;
};
export type Withdrawal = String;
export type SdkWithdrawal = String;
export type WithdrawalProof = String;
export type WithdrawalPayload = {
  readonly proof: WithdrawalProof;
  readonly withdrawal: SdkWithdrawal;
  readonly scope: bigint;
  readonly feeCommitment?: FeeCommitment;
};
export class ContractInteractionsService {
  relay(proof: WithdrawalProof, withdrawal: SdkWithdrawal, scope: bigint): Hash {
    return 1n as Hash;
  }
}
export type StarknetPrivacyPoolSDK = String;

// -------- idk where to put these yet --------


export abstract class RelayerMarshall {
  abstract toJSON(): object;
}

export class DetailsMarshall extends RelayerMarshall {
  constructor(private details: {
    feeBPS: bigint,
    feeReceiverAddress: Address,
    chainId?: number,
    quoteExpirationTime: number,
    assetAddress?: Address,
    minWithdrawAmount?: bigint,
    maxGasPrice?: bigint,
  }) {
    super();
  }
  override toJSON(): object {

    let maxGasPrice: string | null;
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
  constructor(readonly response: RelayerResponse) {
    super();
  }
  override toJSON(): object {
    return this.response;
  }
}

export class QuoteMarshall extends RelayerMarshall {
  constructor(readonly response: QuoteResponse) {
    super();
  }

  addFeeCommitment(feeCommitment: FeeCommitment) {
    this.response.feeCommitment = {
      ...feeCommitment,
      amount: feeCommitment.amount.toString()
    };
  }

  override toJSON(): object {
    const detail = Object.fromEntries(
      Object.entries(this.response.detail)
        .map(([k, v]) => {
          return [k, v ? { gas: v.gas.toString(), eth: v.eth.toString() } : undefined];
        })
    );
    return {
      baseFeeBPS: this.response.baseFeeBPS.toString(),
      feeBPS: this.response.feeBPS.toString(),
      gasPrice: this.response.gasPrice.toString(),
      feeCommitment: this.response.feeCommitment,
      detail,
    };
  }
}
