import type { PublicClient, WalletClient } from "viem";

export class AdminContractInteractions {
  constructor(
    private walletClient: WalletClient,
    private publicClient: PublicClient,
  ) { }

  registerPool(asset: StarknetAddress, pool: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint): Promise<Call>;
  registerPool(asset: StarknetAddress, pool: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint, options: OptionModeSimulate): Promise<SimulateTransaction>;
  registerPool(asset: StarknetAddress, pool: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async registerPool(asset: StarknetAddress, pool: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint, options?: OptionModes) {
    const call = this.entrypoint.populate("registerPool", [asset, pool, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

  updateRoot(root: bigint, ipfsCID: string): Promise<Call>;
  updateRoot(root: bigint, ipfsCID: string, options: OptionModeSimulate): Promise<SimulateTransaction>;
  updateRoot(root: bigint, ipfsCID: string, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async updateRoot(root: bigint, ipfsCID: string, options?: OptionModes) {
    _assertIpfsCID(ipfsCID);
    const call = this.entrypoint.populate("updateRoot", [root, ipfsCID]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

  removePool(asset: StarknetAddress): Promise<Call>;
  removePool(asset: StarknetAddress, options: OptionModeSimulate): Promise<SimulateTransaction>;
  removePool(asset: StarknetAddress, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async removePool(asset: StarknetAddress, options?: OptionModes) {
    const call = this.entrypoint.populate("removePool", [asset]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

  updatePoolConfiguration(asset: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint): Promise<Call>;
  updatePoolConfiguration(asset: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint, options: OptionModeSimulate): Promise<SimulateTransaction>;
  updatePoolConfiguration(asset: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async updatePoolConfiguration(asset: StarknetAddress, minimumDepositAmount: bigint, vettingFeeBPS: bigint, maxRelayFeeBPS: bigint, options?: OptionModes) {
    const call = this.entrypoint.populate("updatePoolConfiguration", [asset, minimumDepositAmount, vettingFeeBPS, maxRelayFeeBPS]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

  windDownPool(pool: StarknetAddress): Promise<Call>;
  windDownPool(pool: StarknetAddress, options: OptionModeSimulate): Promise<SimulateTransaction>;
  windDownPool(pool: StarknetAddress, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async windDownPool(pool: StarknetAddress, options?: OptionModes) {
    const call = this.entrypoint.populate("windDownPool", [pool]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

  withdrawFees(asset: StarknetAddress, recipient: StarknetAddress): Promise<Call>;
  withdrawFees(asset: StarknetAddress, recipient: StarknetAddress, options: OptionModeSimulate): Promise<SimulateTransaction>;
  withdrawFees(asset: StarknetAddress, recipient: StarknetAddress, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async withdrawFees(asset: StarknetAddress, recipient: StarknetAddress, options?: OptionModes) {
    const call = this.entrypoint.populate("withdrawFees", [asset, recipient]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

  upgrade(newClassHash: string): Promise<Call>;
  upgrade(newClassHash: string, options: OptionModeSimulate): Promise<SimulateTransaction>;
  upgrade(newClassHash: string, options: OptionModeExecute): Promise<InvokeFunctionResponse>;
  async upgrade(newClassHash: string, options?: OptionModes) {
    const call = this.entrypoint.populate("upgrade", [newClassHash]);
    return _intentOptionWrapper(call, options && { ...options, account: this.contractService.providerOrAccount });
  }

}