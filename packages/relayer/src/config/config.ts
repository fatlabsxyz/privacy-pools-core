import { readFile, writeFile } from "node:fs/promises";
import { existsSync, watchFile, unwatchFile } from "node:fs";
import { resolve } from "node:path";
import { ConfigError } from "../exceptions/base.exception.js";
import { AssetConfig, ChainId, Config } from "./types.js";
import { UpdateConfigBody, zConfig } from "./config.schema.js";
import { PrivateKey, Resultish } from "../types.js";
import { StarknetAddress, toAddress } from "@fatsolutions/privacy-pools-core-starknet-sdk";
import { JSONStringifyBigInt } from "../utils.js";
import { BehaviorSubject, Subject, debounceTime, switchMap, Subscription, Observable } from "rxjs";

export class RelayerConfig {
  private static configSubject = new BehaviorSubject<ParsedConfig | null>(null);
  private static instance: RelayerConfig | null = null;
  private configPathString = process.env["CONFIG_PATH"] || "./config.json";
  private fileChangeSubject = new Subject<void>();
  private watcherSubscription: Subscription | null = null;

  private constructor(){
    this.setupFileWatcher();
  }

  /**
   * Initialize the configuration - call this once at startup
   * 
   * @throws {ConfigError} If the configuration file is not found
   */
  static async initialize(): Promise<void> {
    if (RelayerConfig.instance) {
      return; // Already initialized
    }

    RelayerConfig.instance = new RelayerConfig();
    const parsedConfig = await RelayerConfig.instance.getParsedConfigFile();
    RelayerConfig.configSubject.next(parsedConfig);
  }

  /**
   * Gets the current configuration synchronously
   * 
   * @returns {ParsedConfig} The parsed configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  static getConfig(): Readonly<ParsedConfig> {
    const config = RelayerConfig.configSubject.value;
    if (!config) {
      throw new ConfigError("Configuration not initialized. Call RelayerConfig.initialize() first.");
    }
    return config;
  }


  /**
   * Gets the asset configuration for a specific asset address.
   * 
   * @param {StarknetAddress} assetAddress - The asset address
   * @returns {AssetConfig} The asset configuration, or undefined if not found
   */
  static getAssetConfig(assetAddress: StarknetAddress): Resultish<Readonly<AssetConfig>, string> {
    const chainConfig = RelayerConfig.getConfig();
    const err = `Asset not supported: ${assetAddress} on chain ${chainConfig.chain_id}`;

    logger.debug(`getting config for: ${assetAddress}`);

    if (!chainConfig.supported_assets) {
      logger.error("No supported assets found in config");
      return [undefined, err];
    }

    const assetConfig = chainConfig.supported_assets.find(
      asset => asset.asset_address === assetAddress
    );

    logger.debug(`config getter successful for: ${assetConfig}`);

    if (assetConfig === undefined) {
      logger.warn(err);

      return [undefined, err];
    }

    return [assetConfig, undefined];
  }



  /**
   * Update configuration values and save a copy of old config.
   * 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
  static async updateConfig(values: UpdateConfigBody): Promise<VariableConfig> {
    if (!RelayerConfig.instance) {
      throw new ConfigError("Configuration not initialized. Call RelayerConfig.initialize() first.");
    }

    const stringifiedValues = JSONStringifyBigInt(values);
    let config = RelayerConfig.getConfig();
    const stringifiedLegacyConfig = JSONStringifyBigInt(config);
    
    // handle chain_id and chain_name consistency
    if (values.chain_name || values.chain_id) {
      const newChainName = values.chain_name || config.chain_name;
      const expectedChainId = RelayerConfig.instance.validateChainId(newChainName);
      
      if (values.chain_name && !values.chain_id) {
        // auto-set chain_id when only chain_name is provided
        values.chain_id = expectedChainId;
      } else if (values.chain_id) {
        // validate provided chain_id matches chain_name
        const newChainId = values.chain_id;
        if (newChainId !== expectedChainId) {
          throw new ConfigError(`Chain ID mismatch: chain_name "${newChainName}" requires chain_id "${expectedChainId}", but got "${newChainId}"`);
        }
      }
    } 
    
    if (stringifiedLegacyConfig !== stringifiedValues) {
      logger.info(`UPDATED CONFIG: ${stringifiedValues}`)
      
      // save backup of old config values with timestamp
      const timestamp = Number(new Date());
      const backupPath = resolve(`${timestamp}-backup-config.json`);
      await writeFile(backupPath, stringifiedLegacyConfig);
      logger.info(`Config backup saved to: ${backupPath}`);
      
      // actually merge the values
      config = RelayerConfig.instance.mergeConfig(config, values);
    }

    const potentialNewConfig = JSONStringifyBigInt(config);
    if (stringifiedLegacyConfig !== potentialNewConfig) {
      // save the merged config values
      await writeFile(RelayerConfig.instance.configPathString, potentialNewConfig);
      
      // update the BehaviorSubject with the new config
      RelayerConfig.configSubject.next(config);
    }
    return config;
  }
  
  // Next are all the private methods...

  private mergeConfig(existing: ParsedConfig, updates: UpdateConfigBody): ParsedConfig {
    const result = { ...existing };
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      
      if (key === 'supported_assets' && Array.isArray(value)) {
        // merge assets by asset_address, replacing existing values or adding new assets
        const existingAssets = existing.supported_assets || [];
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
        
        result.supported_assets = updatedAssets;
      } else if (key === 'allowed_domains' && Array.isArray(value)) {
        // merge domains, avoiding duplicates
        const existingDomains = existing.allowed_domains || [];
        const uniqueDomains = new Set([...existingDomains, ...(value as string[])]);
        result.allowed_domains = Array.from(uniqueDomains);
      } else {
        // and for primitive values, just replace them
        (result as any)[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Gets the full relayer configuration from disk, fully parsed.
   * 
   * @returns {ParsedConfig} The relayer configuration
   */
  private async getParsedConfigFile(): Promise<ParsedConfig> {
    const configFile = await this.readConfigFile();
    logger.debug("raw configFile: ", configFile);

    let {chain_id, chain_name, 
        rpc_url, entrypoint_address,
        quote_expiration_time,
        max_gas_price, supported_assets,
        cors_allow_all, allowed_domains,
        fee_receiver_address: configFeeRecieverAddress, 
        signer_address: configSignerAddress,
        signer_private_key: configSignerPrivateKey}: RawConfig = zConfig.parse(configFile);
  
    const envFeeRecieverAddress = process.env["FEE_RECIEVER_ADDRESS"];
    const envSignerAddress = process.env["SIGNER_ADDRESS"];
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"];

    let error: string[] = [];
    if (!envFeeRecieverAddress && !configFeeRecieverAddress) {
      error.push(`No feeRecieverAddress found on ${this.configPathString}`);
    }
    if (!envSignerPrivateKey && !configSignerPrivateKey) {
      error.push(`No signerPrivateKey found on ${this.configPathString}`);
    }
    if (!envSignerAddress && !configSignerAddress) {
      error.push(`No signerAddress found on ${this.configPathString}`);
    }
    if (error.length > 0) {
      throw ConfigError.default(error.join(", "));
    }

    const fee_receiver_address: StarknetAddress  = envFeeRecieverAddress 
      ? (logger.warn("Using ENV fee_reciever_address"), toAddress(envFeeRecieverAddress))
      : (logger.warn("Using config.json fee_reciever_address"), configFeeRecieverAddress!);

    const signer_private_key: PrivateKey = envSignerPrivateKey
      ? (logger.warn("Using ENV signer_private_key"), envSignerPrivateKey as PrivateKey)
      : (logger.warn("Using config.json signer_private_key"), configSignerPrivateKey!);

    const signer_address: StarknetAddress = envSignerAddress
      ? (logger.warn("Using ENV signer_address"), toAddress(envSignerAddress))
      : (logger.warn("Using config.json signer_address"), configSignerAddress!);


    const parsedConfig: ParsedConfig = {
        chain_id: chain_id || this.validateChainId(chain_name),
        chain_name,
        rpc_url,
        entrypoint_address,
        quote_expiration_time,
        max_gas_price,
        supported_assets,
        cors_allow_all,
        allowed_domains,
        fee_receiver_address,
        signer_address,
        signer_private_key
    };

    logger.debug("parsed config: ", JSONStringifyBigInt(parsedConfig));

    return parsedConfig;
  }

  private validateChainId(chainName: ChainId | string): ChainId {
    if ( chainName === "sn_main" || chainName === (ChainId.Starknet as string)) {
      return ChainId.Starknet;
    } else if (chainName === "sn_sepolia" || chainName === (ChainId.Sepolia as string)) {
      return ChainId.Sepolia;
    } else {
      throw ConfigError.default(`${chainName}: invalid chain name.`)
    }
  }

  /**
   * Reads the configuration file from the path specified in the CONFIG_PATH environment variable
   * or from the default path ./config.json.
   * 
   * @returns {Record<string, unknown>} The parsed configuration object
   * @throws {ConfigError} If the configuration file is not found
   */
  private async readConfigFile(): Promise<Record<string, unknown>> {
    logger.debug("reading config file");

    if (!existsSync(this.configPathString)) {
      logger.warn("No config.json found for relayer.");
      throw ConfigError.default("No config.json found for relayer.");
    }
    const fileContent = await readFile(resolve(this.configPathString), { encoding: "utf-8" });
    return JSON.parse(fileContent);
  }



  /**
   * Sets up file watcher using RxJS observables to detect config file changes
   */
  private setupFileWatcher() {
    const configPath = resolve(this.configPathString);
    
    logger.info(`Setting up file watcher for config: ${configPath}`);
    
    watchFile(configPath, { interval: 1000 }, () => {
      logger.debug("Config file change detected");
      this.fileChangeSubject.next();
    });

    // set up RxJS observable stream with debouncing
    this.watcherSubscription = this.fileChangeSubject
      .pipe(
        debounceTime(300),
        switchMap(() => {
          logger.info("Reloading config due to file change");
          return this.reloadConfigFromDisk();
        })
      )
      .subscribe({
        next: (newConfig) => {
          logger.info("Config successfully reloaded from disk");
        },
        error: (error) => {
          logger.error("FATAL: Config reload failed, terminating process:", error);
          process.exit(1);
        }
      });
  }

  /**
   * Reloads configuration from disk and updates the current instance
   */
  private async reloadConfigFromDisk(): Promise<ParsedConfig> {
    try {
      const newConfig = await this.getParsedConfigFile();
      // Update the BehaviorSubject with the new config
      RelayerConfig.configSubject.next(newConfig);
      return newConfig;
    } catch (error) {
      logger.error("Failed to reload config from disk:", error);
      throw error;
    }
  }

  /**
   * Stops the file watcher and cleans up resources
   */
  stopWatcher() {
    if (this.watcherSubscription) {
      this.watcherSubscription.unsubscribe();
      this.watcherSubscription = null;
    }
    
    unwatchFile(resolve(this.configPathString));
    this.fileChangeSubject.complete();
    
    logger.info("Config file watcher stopped");
  }
}
