import {
  Address,
  Withdrawal,
  WithdrawalProof,
  BatchRelayResult,
} from "@0xbow/privacy-pools-core-sdk";
import { WithdrawalPayload } from "../interfaces/relayer/request.js";
import { BatchWithdrawalPayload } from "../interfaces/relayer/batchRequest.js";

export interface SdkProviderInterface {
  verifyWithdrawal(withdrawalPayload: WithdrawalProof): Promise<boolean>;
  broadcastWithdrawal(
    withdrawalPayload: WithdrawalPayload,
    chainId: number,
  ): Promise<{ hash: string }>;
  calculateContext(withdrawal: Withdrawal, scope: bigint): string;
  scopeData(
    scope: bigint,
    chainId: number,
  ): Promise<{ poolAddress: Address; assetAddress: Address }>;
  executeBatchRelay(
    batchRelayerAddress: Address,
    payload: BatchWithdrawalPayload,
  ): Promise<BatchRelayResult>;
}
