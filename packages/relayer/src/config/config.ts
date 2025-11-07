import { access, readFile, writeFile } from "node:fs/promises";
import { PathLike, WatchEventType, watch } from "node:fs";
import { resolve } from "node:path";

import { Observable, firstValueFrom, take, map, debounceTime, share, shareReplay, startWith, switchMap, catchError, lastValueFrom, of} from "rxjs";
import { ConfigError } from "../exceptions/base.exception.js";
import { PrivateKey, ChainId } from "../types.js";
import { JSONStringifyBigInt } from "../utils.js";
import { UpdateConfigBody, DeleteConfigBody, zConfig } from "./schemas.js";
import { AssetConfig, ChainConfig, Config } from "./types.js";
import { Address, getAddress } from "viem";


export const watchObsFn = (path: PathLike) => 
  new Observable<WatchEventType>((subscriber) => {
    const watcher = watch(path, (event) => subscriber.next(event));
    return () => {
      watcher.close();
    };
});

export class RelayerConfig {
  private configPathString: string;
  private configBackupPath: string | undefined = undefined;

  public readonly watcher$: Observable<Config>;

  constructor() {
    this.configPathString = resolve(process.env["CONFIG_PATH"] || "./config.json");
    if (process.env["BACKUP_CONFIG_PATH"]) {
      this.configBackupPath = resolve(process.env["BACKUP_CONFIG_PATH"]);
    }
    this.watcher$ = this.createConfigWatcher();
    this.watcher$.subscribe((v)=>{console.info("config updated", this.safeishConfig(v))});
  }

  /**
   * Gets the latest configuration
   * 
   * @returns {ReadOnly<Config>} The parsed configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  getConfig(): Promise<Readonly<Config>> {
    return firstValueFrom(this.watcher$);
  }

  /**
   * Gets the latest configuration
   * 
   * @returns {ReadOnly<Config>} The parsed configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async getChainConfig(chainId: ChainId): Promise<Readonly<ChainConfig>> {
    const config = await this.getConfig();
    return this.getChainConfigFromConfigObject(config, chainId);
  }

  /**
   * Gets the asset configuration for a specific asset address on a specific chain.
   * 
   * @param {ChainId} chainId - The chain ID
   * @param {Address} assetAddress - The asset address
   * @returns {Promise<[AssetConfig, undefined] | [undefined, string]>} The asset configuration or error message
   */
  async getAssetConfig(chainId: ChainId, assetAddress: Address): Promise<[Readonly<AssetConfig>, undefined] | [undefined, string]> {
    const config = await this.getConfig();
    const chainConfig = this.getChainConfigFromConfigObject(config, chainId);

    console.debug(`getting config for: ${assetAddress} on chain ${chainId}`);

    if (!chainConfig.supported_assets) {
      const err = "No supported assets found in config";
      console.error(err);
      return [undefined, err];
    }

    const assetConfig = chainConfig.supported_assets.find(
      asset => asset.asset_address === assetAddress
    );

    if (assetConfig === undefined) {
      const err = `Asset not supported: ${assetAddress} on chain ${chainId}`;
      console.warn(err);
      return [undefined, err];
    }

    return [assetConfig, undefined];
  }

  /**
   * Update configuration values and save a copy of old config.
   * 
   * @param {UpdateConfigBody} values - The config updates 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
    updateConfig(values: UpdateConfigBody): Observable<Config> {
    return this.watcher$.pipe(
      take(1), // very important to avoid infinite loops 
      map((config) => {
      const newConfig = this.mergeConfig(config, values);

      return {oldConfig: config, newConfig };
      }),
      switchMap(async ({oldConfig, newConfig}) => {
        if (!this.isConfigEqual(oldConfig, newConfig)) {

          // save backup of old config values
          await this.writeConfigBackup(oldConfig, 'backup-config');

          // save the merged config values
          await this.writeConfig(newConfig);

        }
        return this.safeishConfig(newConfig);
      })
    )
  }

  /**
   * Delete assets from configuration and save a copy of old config.
   * 
   * @param {DeleteConfigBody} values - The chain_id and asset_addresses to delete 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
  deleteConfig(values: DeleteConfigBody): Observable<Config> {
    return this.watcher$.pipe(
      take(1), // very important to avoid infinite loops 
      map((config) => {
        const oldConfig = config;
        const result = { ...oldConfig };
        
        // Find the chain to delete from
        const chainIndex = result.chains.findIndex(chain => chain.chain_id === values.chain_id);
        
        if (chainIndex === -1) {
          throw new ConfigError(`Chain with ID ${values.chain_id} not found in configuration`);
        }

        // normalize asset_addresses to array
        const assetAddressesToDelete = Array.isArray(values.asset_addresses) 
          ? values.asset_addresses 
          : [values.asset_addresses];

        const existingChain = result.chains[chainIndex];
        
        // Filter out the assets to be deleted from this specific chain
        const updatedAssets = (existingChain!.supported_assets || []).filter(
          asset => !assetAddressesToDelete.includes(asset.asset_address)
        );

        // Update the chain with filtered assets
        const updatedChain = {
          ...existingChain,
          supported_assets: updatedAssets
        };
        
        // Update the specific chain in the chains array
        result.chains[chainIndex] = updatedChain as ChainConfig;

        return {oldConfig, newConfig: result};
      }),
      switchMap(async ({oldConfig, newConfig}) => {
        if (!this.isConfigEqual(oldConfig, newConfig)) {

          // save backup of old config values
          await this.writeConfigBackup(oldConfig, 'backup-config');

          // save the merged config values
          await this.writeConfig(newConfig);

        }
        return this.safeishConfig(newConfig);
      })
    )
  }

  /**
   * Writes config to disk, excluding sensitive fields if env vars are set
   * 
   * @param {Config} config - The config to write
   * @returns {Promise<void>}
   */
  private async writeConfig(config: Config): Promise<void> {
    console.log('writeConfig called for path:', this.configPathString);
    await writeFile(this.configPathString, this.checkConfigVariables(config));
    console.log('writeConfig completed for path:', this.configPathString);
  }

  /**
   * Writes a backup of the config to the backup directory if configured.
   * 
   * @param {Config} config - The config to backup
   * @param {string} backupFileName - The backup file name (without timestamp and extension)
   * @returns {Promise<void>}
   */
  private async writeConfigBackup(config: Config, backupFileName: string): Promise<void> {
    if (!this.configBackupPath) {
      return; // No backup path configured, skip backup
    }
    
    const timestamp = Number(new Date());
    const fullBackupFileName = `${timestamp}-${backupFileName}.json`;
    const backupPath = resolve(this.configBackupPath, fullBackupFileName);
    await writeFile(backupPath, this.checkConfigVariables(config));
    console.info(`Config backup saved to: ${backupPath}`);
  }

  private checkConfigVariables(config: Config): string {
    const configToWrite = { ...config } as any;

    // Check which sensitive fields should be excluded due to env vars
    const envFeeReceiverAddress = process.env["FEE_RECIEVER_ADDRESS"];
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"];

    // Remove sensitive fields from config if env vars are set
    if (envFeeReceiverAddress) {
      delete (configToWrite).fee_receiver_address;
    }
    if (envSignerPrivateKey) {
      delete (configToWrite).signer_private_key;
    }

    console.log('checkConfigVariables - after deletion:', {
      hasFeeReceiver: !!configToWrite.fee_receiver_address,
      hasPrivateKey: !!configToWrite.signer_private_key
    });

    return JSONStringifyBigInt(configToWrite);
  }

  /**
   * Remove sensitive values from config defaults object and all chain configurations
   *
   * @param {Config} config - The config value 
   * @returns {Config} The relayer configuration with secrets removed
   */
  private safeishConfig(config: Config): Config {
    const {
      defaults,
      chains,
      ...safeConfig
    } = config;
    
    // Remove sensitive fields from defaults
    const safeDefaults = defaults ? {
      entrypoint_address: defaults.entrypoint_address
    } : undefined;
    
    // Remove sensitive fields from each chain
    const safeChains = chains.map(chain => {
      const {
        fee_receiver_address,
        signer_private_key,
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

  private createConfigWatcher(): Observable<Config> {
    return watchObsFn(this.configPathString)
      .pipe(share())
      .pipe(
        debounceTime(1000),
        startWith('change'),       
        switchMap(() => this.readConfigFile()),
        catchError((error) => {
          console.error('read config error', error);
          throw error
        }),
        switchMap((rawConfig) => this.parseConfig(rawConfig)),
        catchError((error) => {
          console.error('parse config error', error);
          throw error
        }),
        shareReplay(),
      );
  }

  private isConfigEqual(previous: Config, current: Config): boolean {
    return Object.keys(previous).every((key) => {
      const prev = previous[key as keyof Config];
      const curr = current[key as keyof Config];
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

  private getChainConfigFromConfigObject(config: Config, chainId: ChainId): ChainConfig {
    const result = config.chains.find(chain => chain.chain_id === chainId);
    if (result === undefined) {
      throw ConfigError.default(`ChainConfig for chain_id: ${chainId} not found`);
    }
    return result; 
  }

  private mergeConfig(existing: Config, updates: UpdateConfigBody): Config {
    // Require chain_id since all UpdateConfigBody properties are chain-specific
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

    // Update the specific chain in the chains array
    result.chains[chainIndex] = updatedChain as ChainConfig;

    return result;
  }

  /**
   * Converts raw relayer config into a ParsedConfig object.
   * 
   * @returns {Config} The relayer configuration
   */
  private async parseConfig(configFile: Record<string, unknown>): Promise<Config> {

    const {
      cors_allow_all, allowed_domains, sqlite_db_path, 
      defaults,
      chains,
    }: Config = zConfig.parse(configFile);

    const {
        fee_receiver_address: configFeeRecieverAddress,
        signer_private_key: configSignerPrivateKey,
        entrypoint_address
      } = defaults!;

    const envFeeRecieverAddress = process.env["FEE_RECIEVER_ADDRESS"];
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"];

    const error: string[] = [];
    if (!envFeeRecieverAddress && !configFeeRecieverAddress) {
      error.push(`No feeRecieverAddress found on ${this.configPathString}`);
    }
    if (!envSignerPrivateKey && !configSignerPrivateKey) {
      error.push(`No signerPrivateKey found on ${this.configPathString}`);
    }
    if (error.length > 0) {
      throw ConfigError.default(error.join(", "));
    }

    const fee_receiver_address: Address = envFeeRecieverAddress
      ? (console.warn("Using ENV fee_reciever_address"), getAddress(envFeeRecieverAddress))
      : (console.warn("Using config.json fee_reciever_address"), configFeeRecieverAddress!);

    const signer_private_key: PrivateKey = envSignerPrivateKey
      ? (console.warn("Using ENV signer_private_key"), envSignerPrivateKey as PrivateKey)
      : (console.warn("Using config.json signer_private_key"), configSignerPrivateKey!);

    const parsedConfig: Config = {
      defaults: {
        fee_receiver_address,
        entrypoint_address,
        signer_private_key
      },
      chains,
      cors_allow_all,
      allowed_domains,
      sqlite_db_path
    };

    return parsedConfig;
  }

  /**
   * Reads the configuration file from the path specified in the CONFIG_PATH environment variable
   * or from the default path ./config.json.
   * 
   * @returns {Record<string, unknown>} The parsed configuration object
   * @throws {ConfigError} If the configuration file is not found
   */
  private async readConfigFile(): Promise<Record<string, unknown>> {
    try {
      await access(this.configPathString);
    } catch {
      console.warn("No config.json found for relayer.");
      throw ConfigError.default("No config.json found for relayer.");
    }
    const fileContent = await readFile(this.configPathString, { encoding: "utf-8" });
    return JSON.parse(fileContent);
  }

}
