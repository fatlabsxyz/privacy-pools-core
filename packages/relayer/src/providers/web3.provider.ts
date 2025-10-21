import { Chain, createPublicClient, createWalletClient, Hex, http, PublicClient, verifyTypedData, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  CONFIG,
  getSignerPrivateKey
} from "../config/index.js";
import { FeeCommitment } from "../interfaces/relayer/common.js";
import { createChainObject } from "../utils.js";
import { ChainId } from "../types.js";

interface IWeb3Provider {
  client(chainId: ChainId): PublicClient;
  getGasPrice(chainId: ChainId): Promise<bigint>;
}

const domain = (chainId: ChainId) => ({
  name: "Privacy Pools Relayer",
  version: "1",
  chainId,
} as const);

const RelayerCommitmentTypes = {
  RelayerCommitment: [
    { name: "withdrawalData", type: "bytes" },
    { name: "asset", type: "address" },
    { name: "expiration", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "extraGas", type: "bool" },
  ]
} as const;

/**
 * Class representing the provider for interacting with several chains
 */
export class Web3Provider implements IWeb3Provider {
  chains: { [key: ChainId]: Chain; };
  clients: { [key: number]: PublicClient; };
  signers: { [key: number]: WalletClient; };

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
    }));
    this.signers = Object.fromEntries(Object.entries(this.chains).map(([chainId, chain]) => {
      const account = privateKeyToAccount(getSignerPrivateKey(Number(chainId) as ChainId)); // TODO not sure why this has to be casted it should be number
      return [
        chainId,
        createWalletClient({
          account,
          chain,
          transport: http(chain.rpcUrls.default.http[0])
        })];
    }));

  }

  client(chainId: ChainId): PublicClient {
    const client = this.clients[chainId];
    if (client === undefined) {
      throw Error(`Web3ProviderError::UnsupportedChainId(${chainId})`);
    }
    else return client;
  }

  signer(chainId: number): WalletClient {
    const signer = this.signers[chainId];
    if (signer === undefined) {
      throw Error(`Web3ProviderError::UnsupportedChainId(${chainId})`);
    }
    else return signer;
  }

  async getGasPrice(chainId: ChainId): Promise<bigint> {
    return await this.client(chainId).getGasPrice();
  }

  async signRelayerCommitment(chainId: ChainId, commitment: Omit<FeeCommitment, 'signedRelayerCommitment'>) {
    const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as Hex);
    const { withdrawalData, expiration, extraGas, amount, asset } = commitment;
    return signer.signTypedData({
      domain: domain(chainId),
      types: RelayerCommitmentTypes,
      primaryType: 'RelayerCommitment',
      message: {
        withdrawalData,
        asset,
        amount,
        extraGas,
        expiration: BigInt(expiration)
      }
    });
  }

  async verifyRelayerCommitment(chainId: ChainId, commitment: FeeCommitment): Promise<boolean> {
    const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as Hex);
    const { withdrawalData, asset, expiration, amount, extraGas, signedRelayerCommitment } = commitment;
    return verifyTypedData({
      address: signer.address,
      domain: domain(chainId),
      types: RelayerCommitmentTypes,
      primaryType: 'RelayerCommitment',
      message: {
        withdrawalData,
        asset,
        amount,
        extraGas,
        expiration: BigInt(expiration)
      },
      signature: signedRelayerCommitment
    });
  }

}
