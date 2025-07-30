import { ChainId, ChainConfig} from "../config/types.js";
import { getChainConfig } from "../config/index.js";
import { Account, RpcProvider, CallData, CallDetails, Call, BigNumberish } from 'starknet';
import { FeeCommitment } from "../interfaces/relayer/common.js";
import { Address } from "../types.js";

interface Provider {
  client(chainId: ChainId): RpcProvider;
  estimateFee(chainId: ChainId, tx: TxData): Promise<bigint>;
}

type ChainProperties = {
  config: ChainConfig,
  client: RpcProvider,
  account: Account,  
}

/// this is probably going to be handled by the 
enum PpFunction { 
  Test = "test_func",
}

/// Transaction data for inferrable chain call on Provider class implementation.
type TxData = {
  func: PpFunction,         // Function name in smart contract
  rawCalls: BigNumberish[], //TODO check if this dubious type is correct
}

/// Class that represens both Starknet and Sepolia chains
export class StarknetProvider implements Provider {
  chains: Map<ChainId, ChainProperties>; 
  
  constructor () {

    this.chains = new Map([
        chainExpand(ChainId.Starknet),
        chainExpand(ChainId.Sepolia)
      ]);

  }

  client(chainId: ChainId): RpcProvider {
    const config = getChainConfig(chainId); 
    const nodeUrl = config.rpc_url;
    const provider = new RpcProvider({ nodeUrl });
    return provider;
  }

  signer(chainId: ChainId): Account {
    return this.chains.get(chainId)!.account;
  }

 async estimateFee(chainId: ChainId, tx: TxData): Promise<bigint> {
    const chain = this.chains.get(chainId)!;
    let account = chain.account;

    const transaction = {
      contractAddress: chain.config.entrypoint_address!,
      entrypoint: tx.func,
      calldata: CallData.compile( tx.rawCalls ),
    };
    const fee = await account.estimateFee(transaction);

    return fee.suggestedMaxFee;
  }

  signRelayerCommitment(chainId: ChainId, feeCommitment: FeeCommitment): boolean {
  //TODO: implement this
    return true;
  }

  verifyRelayerCommitment(chainId: ChainId, feeCommitment: FeeCommitment): boolean {
  //TODO: implement this
    return true;
  }
}

const chainConfig = (chainId: ChainId): [ChainConfig, RpcProvider] => {
  const config: ChainConfig = getChainConfig(chainId) as ChainConfig; 
  const client: RpcProvider = new RpcProvider({ nodeUrl: config.rpc_url });
  return [config, client];
}


const chainExpand = (chainId: ChainId): [ChainId, ChainProperties] => { 
  const [config, client] = chainConfig(chainId);
  const account: Account = new Account(client, config.fee_receiver_address, config.signer_private_key);
  // TODO: This might not be CORRECT
  return [chainId, {config, client, account}]
}

export function keysToAccount(privateKey: Address, publicKey: Address, chainId: ChainId): Account {
  const [config, client] = chainConfig(chainId);
  const account: Account = new Account(
    client, 
    publicKey,
    privateKey
  ); 
  return account;
}
