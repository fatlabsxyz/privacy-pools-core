// import {
//   Withdrawal,
//   WithdrawalProof,
// } from "@0xbow/privacy-pools-core-sdk";
import { ChainId } from "../config/types.js";
import { WithdrawalPayload } from "../interfaces/relayer/request.js";
import { Address, Hash, Withdrawal, WithdrawalProof } from "../types.js";


export interface SdkProviderInterface {
  verifyWithdrawal(withdrawalPayload: WithdrawalProof): Promise<boolean>;
  broadcastWithdrawal(withdrawalPayload: WithdrawalPayload, chainId: ChainId): 
    Promise<{ hash: Hash }>;
  calculateContext(withdrawal: Withdrawal, scope: bigint): string;
  scopeData(scope: bigint, chainId: ChainId): 
    Promise<{ poolAddress: Address; assetAddress: Address }>;
}
