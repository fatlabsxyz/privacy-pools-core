import { ChainName, ChainConfig} from "../config/types.js";
import { getChainConfig } from "../config/index.js";
import { Account, RpcProvider, CallData, CallDetails, Call, BigNumberish } from 'starknet';
import { FeeCommitment } from "../interfaces/relayer/common.js";

interface Provider {
  client(chainName: ChainName): RpcProvider;
  estimateFee(chainName: ChainName, tx: TxData): Promise<bigint>;
}

type ChainProperties = {
  config: ChainConfig,
  client: RpcProvider,
  wallet: Account,  
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
  chains: Map<ChainName, ChainProperties>; 
  
  constructor () {

    this.chains = new Map([
        chainExpand(ChainName.Starknet),
        chainExpand(ChainName.Sepolia)
      ]);

  }

  client(chainName: ChainName): RpcProvider {
    const config = getChainConfig(chainName); 
    const nodeUrl = config.rpc_url;
    const provider = new RpcProvider({ nodeUrl });
    return provider;
  }

  signer(chainName: ChainName): Account {
    return this.chains.get(chainName)!.wallet;
  }

  async estimateFee(chainName: ChainName, tx: TxData): Promise<bigint> {
    const chain = this.chains.get(chainName)!;
    let account = chain.wallet;

    const transaction = {
      contractAddress: chain.config.entrypoint_address!,
      entrypoint: tx.func,
      calldata: CallData.compile( tx.rawCalls ),
    };
    const fee = await account.estimateFee(transaction);

    return fee.suggestedMaxFee;
  }

  signRelayerCommitment(chainName: ChainName, feeCommitment: FeeCommitment): boolean {
  //TODO: implement this
    return true;
  }

  verifyRelayerCommitment(chainName: ChainName, feeCommitment: FeeCommitment): boolean {
  //TODO: implement this
    return true;
  }
}

 const chainExpand = (chain: ChainName): [ChainName, ChainProperties] => {
  const config: ChainConfig = getChainConfig(chain) as ChainConfig; 
  const client: RpcProvider = new RpcProvider({ nodeUrl: config.rpc_url });
  const wallet: Account = new Account(client, config.fee_receiver_address, config.signer_private_key);
  // TODO: WALLET IS PROBABLY NOT CORRECT i feel like it should be another addr and privkey
  return [chain, {config, client, wallet}]
}
