// import {
//   Withdrawal,
//   WithdrawalProof,
// } from "@0xbow/privacy-pools-core-sdk";
import { ChainName } from "../config/types.js";
import { WithdrawalPayload } from "../interfaces/relayer/request.js";
import { Address, Withdrawal, WithdrawalProof } from "../types.js";


export interface SdkProviderInterface {
  verifyWithdrawal(withdrawalPayload: WithdrawalProof): Promise<boolean>;
  broadcastWithdrawal(withdrawalPayload: WithdrawalPayload, chainName: ChainName): 
    Promise<{ hash: string }>;
  calculateContext(withdrawal: Withdrawal, scope: bigint): string;
  scopeData(scope: bigint, chainName: ChainName): 
    Promise<{ poolAddress: Address; assetAddress: Address }>;
}
