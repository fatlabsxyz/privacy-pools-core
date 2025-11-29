import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConfigError } from "../exceptions/base.exception.js";
import { PrivateKey, ChainId } from "../types.js";
import { JSONStringifyBigInt } from "../utils.js";
import { UpdateConfigBody, DeleteConfigBody, zConfig, zRawConfig, zRawChainConfig } from "./schemas.js";
import { AssetConfig, RawChainConfig, RawConfig, SafeConfig } from "./types.js";
import { Address, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

class ConfigReader {

  constructor(readonly filePath: string) {
  }

  /**
   * Reads the configuration file from the path specified in the CONFIG_PATH environment variable
   * or from the default path ./config.json.
   * 
   * @returns {Record<string, unknown>} The raw configuration object
   * @throws {ConfigError} If the configuration file is not found
   */
  async readConfig(): Promise<Record<string, unknown>> {
    try {
      await access(this.filePath);
    } catch {
      console.warn("No config.json found for relayer.");
      throw ConfigError.default("No config.json found for relayer.");
    }
    const fileContent = await readFile(this.filePath, { encoding: "utf-8" });
    return JSON.parse(fileContent);
  }

  async parseConfig(): Promise<RawConfig> {
    const rawConfig = await this.readConfig();

    const config = zRawConfig.parse(rawConfig);

    return config; 
  }

  /**
   * Gets the latest chain configuration list
   * 
   * @returns {Promise<ChainConfig[]>} The parsed chain configuration list object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async chainConfigList(): Promise<RawChainConfig[]> {
    const config = await this.parseConfig();
    return config.chains;
  }

}

class ChainConfig extends ConfigReader {

  constructor(filePath: string, readonly chainId: number) {
    super(filePath);
  }

  /**
   * Gets the latest chain configuration for a specific chain
   * 
   * @returns {Promise<ChainConfig>} The parsed chain configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async config(): Promise<RawChainConfig> {
    const config = await this.parseConfig();
    const result = config.chains.find(chain => chain.chain_id === this.chainId);
    if (result === undefined) {
      throw ConfigError.default(`ChainConfig for chain_id: ${this.chainId} not found`);
    }
    return result; 
  }

  /**
   * Gets the latest fee reciever address for a specific chain
   * 
   * @returns {Promise<Address>} The parsed chain configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async feeReceiverAddress(): Promise<Address> {
    const { fee_receiver_address: configFeeRecieverAddress } = await this.config();
    const envFeeRecieverAddress = process.env["FEE_RECIEVER_ADDRESS"];

    const error: string[] = [];
    if (!envFeeRecieverAddress && !configFeeRecieverAddress) {
      error.push(`No feeRecieverAddress found on ${this.filePath}`);
    }

    const fee_receiver_address: Address = envFeeRecieverAddress
      ? (console.warn("Using ENV fee_reciever_address"), getAddress(envFeeRecieverAddress))
      : (console.warn("Using config.json fee_reciever_address"), configFeeRecieverAddress!);

    const cr = new ConfigReader(this.filePath);
    const config = await cr.parseConfig();
    const def = config.defaults!;

    const chainFeeReceiver = fee_receiver_address ?? def.fee_receiver_address;

    if (!chainFeeReceiver) {
      throw ConfigError.default(`fee_reciever_address for chain_id: ${this.chainId} not found`);
    }

    return chainFeeReceiver;
  }

  /**
   * Gets the effective signer private key for a chain.
   * 
   * @returns {PrivateKey} The signer private key
   * @throws {ConfigError} If the configuration is not initialized
   */
  async signerPrivateKey(): Promise<PrivateKey> {
    const { signer_private_key: configSignerPrivateKey } = await this.config();
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"];

    const error: string[] = [];
    if (!envSignerPrivateKey && !configSignerPrivateKey) {
      error.push(`No feeRecieverAddress found on ${this.filePath}`);
    }

    const signer_private_key: Address = envSignerPrivateKey
      ? (console.warn("Using ENV signer_private_key"), getAddress(envSignerPrivateKey))
      : (console.warn("Using config.json signer_private_key"), configSignerPrivateKey!);

    const cr = new ConfigReader(this.filePath);
    const config = await cr.parseConfig();
    const def = config.defaults!;

    const chainSignerKey = signer_private_key ?? def.signer_private_key;

    if (!chainSignerKey) {
      throw ConfigError.default(`signer_private_key for chain_id: ${this.chainId} not found`);
    }
    return chainSignerKey; 
  }

  /**
   * Gets the effective entrypoint address for a chain.
   * 
   * @returns {Address} The entrypoint address
   */
  async entrypointAddress(): Promise<Address> {
    const { entrypoint_address } = await this.config();
    const cr = new ConfigReader(this.filePath);
    const config = await cr.parseConfig();
    const def = config.defaults!;

    const entrypointAddress = entrypoint_address ?? def.entrypoint_address;


    if (!entrypointAddress) {
      throw ConfigError.default(`entrypoint_address for chain_id: ${this.chainId} not found`);
    }
    return entrypointAddress; 
  }

  async isFeeReceiverSameAsSigner(): Promise<boolean> {
    const feeReceiverAddress = await this.feeReceiverAddress();
    const pkey = await this.signerPrivateKey();

    const signerAddress = privateKeyToAccount(pkey).address;
    return feeReceiverAddress.toLowerCase() === signerAddress.toLowerCase();
  }

  /**
   * Gets the asset configuration for a specific asset address on a specific chain.
   * 
   * @param {Address} assetAddress - The asset address
   * @returns {Promise<[AssetConfig, undefined] | [undefined, string]>} The asset configuration or error message
   */
  async assetConfig(assetAddress: Address): Promise<[Readonly<AssetConfig>, undefined] | [undefined, string]> {
    const chainConfig = await this.config();

    console.debug(`getting config for: ${assetAddress} on chain ${this.chainId}`);

    if (!chainConfig.supported_assets) {
      const err = "No supported assets found in config";
      console.error(err);
      return [undefined, err];
    }

    const assetConfig = chainConfig.supported_assets.find(
      asset => asset.asset_address === assetAddress
    );

    if (assetConfig === undefined) {
      const err = `Asset not supported: ${assetAddress} on chain ${this.chainId}`;
      console.warn(err);
      return [undefined, err];
    }

    return [assetConfig, undefined];
  }

  /**
   * Checks if a chain ID is supported.
   * 
   * @param {number} chainId - The chain ID to check.
   * @returns {Promise<boolean>} - Whether the chain is supported.
   */
  async isChainSupported(chainId: ChainId): Promise<boolean> {
    const chains = await this.chainConfigList();
    return chains.some(chain => chain.chain_id === chainId);
  }


}

export class RelayerConfig {

  private configPathString: string;
  private configBackupPath: string | undefined = undefined;

  constructor() {
    this.configPathString = resolve(process.env["CONFIG_PATH"] || "./config.json");
    if (process.env["BACKUP_CONFIG_PATH"]) {
      this.configBackupPath = resolve(process.env["BACKUP_CONFIG_PATH"]);
    }
  }

  /**
   * Gets full configuration
   * 
   * @returns {Promise<RawConfig>} The raw configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  fullConfig(): Promise<RawConfig> {
    const cr = new ConfigReader(this.configPathString)
    return cr.parseConfig();
  }

  /**
   * Gets chain configuration for a specific chain
   * 
   * @param {ChainId} chainId - The chain ID
   * @returns {ReadOnly<ChainConfig>} The parsed chain configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  chain(chainId: ChainId): ChainConfig {
    return new ChainConfig(this.configPathString, chainId);
  }

  /**
   * Update configuration values and save a copy of old config.
   * 
   * @param {UpdateConfigBody} values - The chain config updates 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
  async updateConfig(values: UpdateConfigBody): Promise<SafeConfig> {
    const oldChainConfig = await this.fullConfig();

    const newChainConfig = this.mergeConfig(oldChainConfig, values);

    if (!this.isConfigEqual(oldChainConfig, newChainConfig)) {
      await this.saveConfig(oldChainConfig, newChainConfig);
    }
    return this.safeishConfig(newChainConfig);
  }

  /**
   * Delete assets from configuration and save a copy of old config.
   * 
   * @param {DeleteConfigBody} values - The chain_id and asset_addresses to delete 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
  async deleteConfig(values: DeleteConfigBody): Promise<SafeConfig> {    
    const oldConfig = await this.fullConfig();
    const result = { ...oldConfig };
        
    const chainIndex = result.chains.findIndex(chain => chain.chain_id === values.chain_id);
    
    if (chainIndex === -1) {
      throw new ConfigError(`Chain with ID ${values.chain_id} not found in configuration`);
    }

    const assetAddressesToDelete = Array.isArray(values.asset_addresses) 
      ? values.asset_addresses 
      : [values.asset_addresses];

    const existingChain = result.chains[chainIndex];
    
    const updatedAssets = (existingChain!.supported_assets || []).filter(
      asset => !assetAddressesToDelete.includes(asset.asset_address)
    );

    const updatedChain = {
      ...existingChain,
      supported_assets: updatedAssets
    };
    
    const validatedChain = zRawConfig.parse(updatedChain);
    result.chains[chainIndex] = validatedChain as any; // TODO SORRY BEZZE

    const newConfig = zConfig.parse(result);

    if (!this.isConfigEqual(oldConfig, newConfig)) {
      await this.saveConfig(oldConfig, newConfig);
    }
    return this.safeishConfig(newConfig);
  }

  /**
   * Saves config by backing up the old config and writing the new one
   * 
   * @param {Config} oldConfig - The old config to backup
   * @param {Config} newConfig - The new config to write
   * @returns {Promise<void>}
   */
  private async saveConfig(oldConfig: RawConfig, newConfig: RawConfig): Promise<void> {
    await this.writeConfigBackup(oldConfig, 'backup-config');
    await this.writeConfig(newConfig);
  }

  /**
   * Writes config to disk, excluding sensitive fields if env vars are set
   * 
   * @param {Config} config - The config to write
   * @returns {Promise<void>}
   */
  private async writeConfig(config: RawConfig): Promise<void> { 
    await writeFile(resolve(this.configPathString), this.checkConfigVariables(config));
    console.log('writeConfig completed for path:', this.configPathString);
  }

  /**
   * Writes a backup of the config to the backup directory if configured.
   * 
   * @param {Config} config - The config to backup
   * @param {string} backupFileName - The backup file name (without timestamp and extension)
   * @returns {Promise<void>}
   */
  private async writeConfigBackup(config: RawConfig, backupFileName: string): Promise<void> {
    if (!this.configBackupPath) {
      return; // no backup path configured, skip backup
    }
    
    const timestamp = Number(new Date());
    const fullBackupFileName = `${timestamp}-${backupFileName}.json`;
    const backupPath = resolve(this.configBackupPath, fullBackupFileName);
    await writeFile(backupPath, this.checkConfigVariables(config));
    console.info(`Config backup saved to: ${backupPath}`);
  }

  /** 
   *  Checks if env secrets are set, and if they are inside a chain config, removes them.
   * */
  private checkConfigVariables(config: RawConfig): string {

    const chainConfigToWrite: Partial<RawChainConfig>[] = [...config.chains];

    // check which sensitive fields should be excluded due to env vars
    const envFeeReceiverAddress = process.env["FEE_RECIEVER_ADDRESS"];
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"];

    // remove sensitive fields from config if env vars are set
    config.chains.forEach((c,i) => {
      const chainValue = chainConfigToWrite[i]
      if ( chainValue !== undefined) { 
        if (envFeeReceiverAddress === c.fee_receiver_address) {
          delete chainValue.fee_receiver_address;
        }
        if (envSignerPrivateKey === c.signer_private_key) {
          delete chainValue.signer_private_key;
        }
      }
    })

    const configToWrite = {...config, chains: chainConfigToWrite}

    return JSONStringifyBigInt(configToWrite);
  }

  /**
   * Remove sensitive values from config defaults object and all chain configurations
   *
   * @param {Config} config - The config value 
   * @returns {SafeConfig} The relayer configuration with secrets removed
   */
  private safeishConfig(config: RawConfig): SafeConfig {
    const {
      defaults,
      chains,
      ...safeConfig
    } = config;
    
    const safeDefaults = defaults ? {
      entrypoint_address: defaults.entrypoint_address
    } : undefined;
    
    const safeChains = chains.map(chain => {
      const {
        fee_receiver_address: _reciever,
        signer_private_key: _pkey,
        ...safeChain
      } = chain;
      return safeChain;
    });
    
    return { 
      ...safeConfig, 
      defaults: safeDefaults,
      chains: safeChains
    };
  }

  private isConfigEqual(previous: RawConfig, current: RawConfig): boolean {
    return Object.keys(previous).every((key) => {
      const prev = previous[key as keyof RawConfig];
      const curr = current[key as keyof RawConfig];
      if (Array.isArray(prev) && Array.isArray(curr)) {
        if (prev.length !== curr.length)
          return false;
        return prev.every((value, index) => value === curr[index]);
      } else if ((!Array.isArray(prev)) && (!Array.isArray(curr))) {
        return prev === curr;
      }
      else {
        const errorLog = `Unexpected config value found for when comparing key ${key}:= ${prev} vs ${curr}`;
        console.error(errorLog);
        throw ConfigError.default(errorLog);
      }
    });
  }

  private mergeConfig(existing: RawConfig, updates: UpdateConfigBody): RawConfig {
    if (!updates.chain_id) {
      throw new ConfigError("chain_id is required for config updates");
    }

    const result = { ...existing };
    const chainIndex = result.chains.findIndex(chain => chain.chain_id === updates.chain_id);
    
    if (chainIndex === -1) {
      throw new ConfigError(`Chain with ID ${updates.chain_id} not found in configuration`);
    }

    const existingChain = result.chains[chainIndex];
    const updatedChain = { ...existingChain };

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;

      if (key === 'supported_assets' && Array.isArray(value)) {
        // merge assets by asset_address, replacing existing values or adding new assets
        const existingAssets = existingChain!.supported_assets || [];
        const updatedAssets = [...existingAssets];

        (value as AssetConfig[]).forEach(newAsset => {
          const existingIndex = updatedAssets.findIndex(
            asset => asset.asset_address === newAsset.asset_address
          );
          if (existingIndex >= 0) {
            updatedAssets[existingIndex] = newAsset;
          } else {
            updatedAssets.push(newAsset);
          }
        });

        updatedChain.supported_assets = updatedAssets;
      } else if (key !== 'chain_id') {
        (updatedChain as any)[key] = value;
      }
    }

    const validatedChain = zRawConfig.parse(updatedChain);
    result.chains[chainIndex] = validatedChain as any; // TODO SORRY BEZZE

    return result;
  }
}
