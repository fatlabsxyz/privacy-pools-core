import type { Account, Address, PublicClient } from "viem";
import { contractExecutorFactory, ContractExecutorFactoryParams } from "../utils/contract-executor.util.js";
import { RegisterPoolPayload, TransactionResponse } from "../interfaces/contracts.interface.js";
import { IEntrypointABI } from "../abi/IEntrypoint.js";

export interface AdminContractInteractionsParams extends ContractExecutorFactoryParams {
  entryPointAddress: Address;
  account: Account;
}

export class AdminContractInteractions {
  private executeTransaction: (request: any) => Promise<TransactionResponse>;

  private entrypointAddress: Address;
  private account: Account;
  private publicClient: PublicClient;

  constructor({
    entryPointAddress,
    account,
    ...params
  }: AdminContractInteractionsParams) {
    this.executeTransaction = contractExecutorFactory(params);
    this.entrypointAddress = entryPointAddress;
    this.account = account;
    this.publicClient = params.publicClient;
  }

  async registerPool(payload: RegisterPoolPayload) {
    try {
      const {
        poolAddress,
        assetAddress,
        minimumDepositAmount,
        maxRelayFeeBPS,
        vettingFeeBPS
      } = payload;

      const { request } = await this.publicClient.simulateContract({
        address: this.entrypointAddress,
        abi: IEntrypointABI,
        functionName: "registerPool",
        args: [assetAddress, poolAddress, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS],
        account: this.account,
      } as const);

      return await this.executeTransaction(request);
    } catch (error) {
      console.error(`Register Pool Error: ${(error as Error).message}`, { error, payload });
      throw new Error(
        `Failed to register Pool: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async updateRoot(root: bigint, ipfsCID: string) {
    try {
      const { request } = await this.publicClient.simulateContract({
        address: this.entrypointAddress,
        abi: IEntrypointABI,
        functionName: 'updateRoot',
        args: [root, ipfsCID],
        account: this.account,
      });
  
      return this.executeTransaction(request);
    } catch (error) {
      console.error(`Update Root Error: ${(error as Error).message}`, { error, payload: { root, ipfsCID }});
      throw new Error(
        `Failed to update Root: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getCurrentRoot() {
    return this.publicClient.readContract({
      address: this.entrypointAddress,
      abi: IEntrypointABI,
      functionName: 'latestRoot',
      account: this.account,
    }).catch((error) => {
      console.error(`Get current Root error: ${(error as Error).message}`, { error });
      throw new Error(
        `Failed to get current Root: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    });
  }
}