import { Chain, createPublicClient, Hex, http, PublicClient, verifyTypedData } from "viem";
import {
  CONFIG,
  getSignerPrivateKey
} from "../config/index.js";
import { createChainObject } from "../utils.js";
import { privateKeyToAccount } from "viem/accounts";
import { FeeCommitment } from "../interfaces/relayer/common.js";

interface IWeb3Provider {
  client(chainId: number): PublicClient;
  getGasPrice(chainId: number): Promise<bigint>;
  estimateContractGas(chainId: number, contractAddress: string, functionName: string, args: readonly unknown[]): Promise<bigint>;
}

const domain = (chainId: number) => ({
  name: "Privacy Pools Relayer",
  version: "1",
  chainId,
} as const)

const RelayerCommitmentTypes = {
  RelayerCommitment: [
    { name: "withdrawalData", type: "bytes" },
    { name: "expiration", type: "uint256" },
  ]
} as const;

/**
 * Class representing the provider for interacting with several chains
 */
export class Web3Provider implements IWeb3Provider {
  chains: { [key: number]: Chain };
  clients: { [key: number]: PublicClient };

  constructor() {
    this.chains = Object.fromEntries(CONFIG.chains.map(chainConfig => {
      return [chainConfig.chain_id, createChainObject(chainConfig)];
    }));
    this.clients = Object.fromEntries(Object.entries(this.chains).map(([chainId, chain]) => {
      return [
        chainId,
        createPublicClient({
          chain,
          transport: http(chain.rpcUrls.default.http[0])
        })];
    }))
  }

  client(chainId: number): PublicClient {
    const client = this.clients[chainId];
    if (client === undefined) {
      throw Error(`Web3ProviderError::UnsupportedChainId(${chainId})`)
    }
    else return client
  }

  async getGasPrice(chainId: number): Promise<bigint> {
    return await this.client(chainId).getGasPrice()
  }

  async signRelayerCommitment(chainId: number, commitment: Omit<FeeCommitment, 'signedRelayerCommitment'>) {
    const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as Hex);
    const { withdrawalData, expiration } = commitment;
    return signer.signTypedData({
      domain: domain(chainId),
      types: RelayerCommitmentTypes,
      primaryType: 'RelayerCommitment',
      message: {
        withdrawalData,
        expiration: BigInt(expiration)
      }
    })
  }

  async verifyRelayerCommitment(chainId: number, commitment: FeeCommitment): Promise<boolean> {
    const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as Hex);
    const { withdrawalData, expiration, signedRelayerCommitment } = commitment;
    return verifyTypedData({
      address: signer.address,
      domain: domain(chainId),
      types: RelayerCommitmentTypes,
      primaryType: 'RelayerCommitment',
      message: {
        withdrawalData,
        expiration: BigInt(expiration)
      },
      signature: signedRelayerCommitment
    })
  }

  /**
   * Estimate gas for a contract function call using the actual contract simulation.
   * This provides real gas costs instead of hardcoded estimates.
   * 
   * @param chainId - The chain ID
   * @param contractAddress - The contract address to call
   * @param functionName - The function name to call
   * @param args - The function arguments
   * @returns Promise<bigint> - The estimated gas amount
   */
  async estimateContractGas(
    chainId: number, 
    contractAddress: string, 
    functionName: string, 
    args: readonly unknown[]
  ): Promise<bigint> {
    const client = this.client(chainId);
    
    // For BatchRelayer contract gas estimation, we need the ABI
    // This is a simplified ABI containing just the batchRelay function
    const batchRelayerABI = [
      {
        name: 'batchRelay',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: '_pool', type: 'address' },
          { name: '_withdrawal', type: 'tuple', components: [
            { name: 'processooor', type: 'address' },
            { name: 'data', type: 'bytes' }
          ]},
          { name: '_proofs', type: 'tuple[]', components: [
            { name: 'pA', type: 'uint256[2]' },
            { name: 'pB', type: 'uint256[2][2]' },
            { name: 'pC', type: 'uint256[2]' },
            { name: 'pubSignals', type: 'uint256[8]' }
          ]}
        ]
      }
    ];

    try {
      // Estimate gas for the contract call
      const gasEstimate = await client.estimateContractGas({
        address: contractAddress as `0x${string}`,
        abi: batchRelayerABI,
        functionName: functionName,
        args: args,
        account: privateKeyToAccount(getSignerPrivateKey(chainId) as Hex).address
      });

      return gasEstimate;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`Contract gas estimation failed for ${functionName} on chain ${chainId}: ${errorMessage}`);
      throw new Error(`Gas estimation failed: ${errorMessage}`);
    }
  }

}
