import type { PublicClient, WalletClient } from "viem";
import { TransactionResponse } from "../interfaces/contracts.interface.js";

export interface ContractExecutorFactoryParams {
    walletClient: WalletClient;
    publicClient: PublicClient;
}

export const contractExecutorFactory = ({ walletClient, publicClient }: ContractExecutorFactoryParams) => async (request: any): Promise<TransactionResponse> {
    try {
      const hash = await walletClient.writeContract(request);
      return {
        hash,
        wait: async () => publicClient.waitForTransactionReceipt({ hash }),
      };
    } catch (error) {
      console.error("Transaction Execution Error:", { error, request });
      throw new Error(
        `Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }