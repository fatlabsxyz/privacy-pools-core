/**
 * Provides an interface to interact with the Privacy Pool SDK.
 */

import {
  calculateContext,
  Circuits,
  ContractInteractionsService,
  PrivacyPoolSDK,
  Withdrawal,
  SDKError,
  type Hash,
} from "@0xbow/privacy-pools-core-sdk";
import { Address, createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// BatchRelayer ABI is now available through the SDK
import {
  CONFIG,
  getBatchRelayerAddress
} from "../config/index.js";
import { WithdrawalPayload } from "../interfaces/relayer/request.js";
import { ContractWithdrawProof, BatchWithdrawalPayload } from "../interfaces/relayer/batchRequest.js";
import { RelayerError, SdkError, ConfigError } from "../exceptions/base.exception.js";
import { SdkProviderInterface } from "../types/sdk.types.js";
import type {
  BatchRelayResult,
  BatchWithdrawalService,
  BatchWithdrawalPayload as SdkBatchWithdrawalPayload,
  WithdrawalProof
} from "@0xbow/privacy-pools-core-sdk";
import type { Groth16Proof, PublicSignals } from "snarkjs";
import { createChainObject } from "../utils.js";

/**
 * Class representing the SDK provider for interacting with Privacy Pool SDK.
 */
export class SdkProvider implements SdkProviderInterface {
  /** Instance of the PrivacyPoolSDK. */
  private sdk: PrivacyPoolSDK;

  /** Map of chain ID to contract interactions service */
  private contractsByChain: Map<number, { contracts: ContractInteractionsService, batch: BatchWithdrawalService }>;

  /**
   * Initializes a new instance of the SDK provider.
   */
  constructor() {
    this.sdk = new PrivacyPoolSDK(new Circuits({ browser: false }));
    this.contractsByChain = new Map();

    // Initialize contract instances for all supported chains
    CONFIG.chains.forEach(chainConfig => {
      try {
        // Create chain object
        const chain = createChainObject(chainConfig);

        // Get entrypoint address and signer private key
        const entrypointAddress = chainConfig.entrypoint_address || CONFIG.defaults.entrypoint_address;
        const signerPrivateKey = chainConfig.signer_private_key || CONFIG.defaults.signer_private_key;

        const batchRelayerAddress = getBatchRelayerAddress(chain.id);

        // Create contract instance
        const contracts = this.sdk.createContractInstance(
          chainConfig.rpc_url,
          chain,
          entrypointAddress,
          signerPrivateKey,
        );

        const batch = contracts.batch(batchRelayerAddress);
        this.contractsByChain.set(chainConfig.chain_id, { contracts, batch });
      } catch (error) {
        console.error(`Error initializing chain ${chainConfig.chain_id}: ${error}`);
      }
    });

    if (this.contractsByChain.size === 0) {
      throw new Error("No chains were successfully initialized");
    }
  }

  /**
   * Gets the contract interactions service for a specific chain.
   * 
   * @param {number} chainId - The chain ID.
   * @returns {ContractInteractionsService} - The contract interactions service for the specified chain.
   * @throws {RelayerError} - If the chain is not supported.
   */
  private getContractsForChain(chainId: number): ContractInteractionsService {
    const contractManager = this.contractsByChain.get(chainId);
    if (!contractManager) {
      throw ConfigError.default(`Chain with ID ${chainId} not supported.`);
    }

    return contractManager.contracts;
  }


  private getBatchContractInstanceForChain(chainId: number): BatchWithdrawalService {
    const contractManager = this.contractsByChain.get(chainId);
    if (!contractManager) {
      throw ConfigError.default(`Chain with ID ${chainId} not supported.`);
    }

    return contractManager.batch;
  }

  /**
   * Verifies a withdrawal proof.
   *
   * @param {WithdrawalProof} withdrawalPayload - The withdrawal proof payload.
   * @returns {Promise<boolean>} - A promise resolving to a boolean indicating verification success.
   */
  async verifyWithdrawal(withdrawalPayload: WithdrawalProof): Promise<boolean> {
    return await this.sdk.verifyWithdrawal(withdrawalPayload);
  }

  /**
   * Verifies multiple withdrawal proofs for a batch withdrawal.
   *
   * @param {WithdrawalProof[]} proofs - Array of withdrawal proofs to verify.
   * @returns {Promise<boolean>} - A promise resolving to true if all proofs are valid, false otherwise.
   */
  async verifyBatchWithdrawal(proofs: WithdrawalProof[]): Promise<boolean> {
    return await this.sdk.verifyBatchWithdrawal(proofs);
  }

  /**
   * Broadcasts a withdrawal transaction.
   *
   * @param {WithdrawalPayload} withdrawalPayload - The withdrawal payload.
   * @param {number} chainId - The chain ID to broadcast on.
   * @returns {Promise<{ hash: string }>} - A promise resolving to an object containing the transaction hash.
   */
  async broadcastWithdrawal(
    withdrawalPayload: WithdrawalPayload,
    chainId: number,
  ): Promise<{ hash: string }> {
    const contracts = this.getContractsForChain(chainId);
    return contracts.relay(
      withdrawalPayload.withdrawal,
      withdrawalPayload.proof,
      withdrawalPayload.scope as Hash,
    );
  }

  /**
   * Calculates the context for a withdrawal.
   *
   * @param {Withdrawal} withdrawal - The withdrawal object.
   * @param {bigint} scope - The scope value.
   * @returns {string} - The calculated context.
   */
  calculateContext(withdrawal: Withdrawal, scope: bigint): string {
    return calculateContext(withdrawal, scope as Hash);
  }

  /**
   * Calculates the context for a withdrawal using the pool's actual scope.
   * This matches the contract's context calculation: keccak256(abi.encode(_withdrawal, SCOPE)) % SNARK_SCALAR_FIELD
   *
   * @param {Withdrawal} withdrawal - The withdrawal object.
   * @param {Address} poolAddress - The pool address to get the scope from.
   * @param {number} chainId - The chain ID.
   * @returns {Promise<string>} - The calculated context matching the contract.
   */
  async calculateContextForPool(
    withdrawal: Withdrawal,
    poolAddress: Address,
    chainId: number
  ): Promise<string> {
    try {
      const contracts = this.getContractsForChain(chainId);

      // Get the pool's SCOPE value from the contract
      const poolScope = await contracts.getScope(poolAddress);

      // Calculate context using the same formula as the contract:
      // keccak256(abi.encode(_withdrawal, SCOPE)) % SNARK_SCALAR_FIELD
      return calculateContext(withdrawal, poolScope as Hash);
    } catch (error) {
      if (error instanceof SDKError) {
        throw SdkError.scopeDataError(error);
      } else {
        throw RelayerError.unknown(JSON.stringify(error));
      }
    }
  }

  /**
   * Converts a scope value to an asset address.
   *
   * @param {bigint} scope - The scope value.
   * @param {number} chainId - The chain ID.
   * @returns {Promise<{ poolAddress: Address; assetAddress: Address; }>} - A promise resolving to the asset address.
   */
  async scopeData(
    scope: bigint,
    chainId: number,
  ): Promise<{ poolAddress: Address; assetAddress: Address }> {
    try {
      const contracts = this.getContractsForChain(chainId);
      const data = await contracts.getScopeData(scope);
      return data;
    } catch (error) {
      if (error instanceof SDKError) {
        throw SdkError.scopeDataError(error);
      } else {
        throw RelayerError.unknown(JSON.stringify(error));
      }
    }
  }


  /**
   * Converts relayer's ContractWithdrawProof to SDK's WithdrawalProof format
   */
  private convertContractProofToSdkProof(contractProof: ContractWithdrawProof): WithdrawalProof {
    // Convert contract proof format (pA, pB, pC) to Groth16Proof format (pi_a, pi_b, pi_c)
    const groth16Proof: Groth16Proof = {
      pi_a: contractProof.pA,
      pi_b: contractProof.pB,
      pi_c: contractProof.pC,
      protocol: "groth16",
      curve: "bn128"
    };

    // PublicSignals are already strings, so use them directly
    const publicSignals: PublicSignals = contractProof.pubSignals;

    return {
      proof: groth16Proof,
      publicSignals
    };
  }

  /**
   * Converts relayer's BatchWithdrawalPayload to SDK's BatchWithdrawalPayload format
   * NOTE: The SDK's formatProof method expects proofs with nested .proof structure
   * We need to convert from the flattened relayer format to the nested SDK format
   */
  private convertToSdkPayload(payload: BatchWithdrawalPayload): SdkBatchWithdrawalPayload {

    if (!payload.proofs || !Array.isArray(payload.proofs)) {
      throw new Error("Invalid payload: proofs must be an array");
    }

    const convertedProofs = payload.proofs.map((proof, index) => {

      if (!proof) {
        throw new Error(`Proof ${index + 1} is undefined`);
      }

      if (!proof.pA || !proof.pB || !proof.pC || !proof.pubSignals) {
        throw new Error(`Proof ${index + 1} is missing required fields: pA=${!!proof.pA}, pB=${!!proof.pB}, pC=${!!proof.pC}, pubSignals=${!!proof.pubSignals}`);
      }

      // Convert from relayer's flattened format (pA, pB, pC, pubSignals) 
      // to SDK's nested format (proof.pi_a, proof.pi_b, proof.pi_c, publicSignals)
      return {
        proof: {
          pi_a: proof.pA,
          pi_b: proof.pB,
          pi_c: proof.pC,
          protocol: "groth16" as const,
          curve: "bn128" as const
        },
        publicSignals: proof.pubSignals
      };
    });

    return {
      withdrawal: payload.withdrawal,
      poolAddress: payload.poolAddress as Address,
      proofs: convertedProofs
    };
  }

  /**
   * Executes a batch relay transaction using the SDK.
   * Delegates contract execution to the SDK with already-proven payload.
   *
   * @param {Address} batchRelayerAddress - The address of the batch relayer contract.
   * @param {BatchWithdrawalPayload} payload - BatchWithdrawalPayload with proven proofs
   * @returns {Promise<BatchRelayResult>} - A promise resolving to the batch relay result.
   */
  async broadcastBatchRelay(
    payload: BatchWithdrawalPayload,
    chainId: number
  ): Promise<BatchRelayResult> {
    try {
      // Convert relayer payload to SDK payload format
      const sdkPayload = this.convertToSdkPayload(payload);

      // XXX: aca no le paso chainId, fijarse la init de contract instance en el constructor. 
      const batch = this.getBatchContractInstanceForChain(chainId);

      const result = await batch.batchRelay(getAddress(payload.poolAddress), payload.withdrawal, sdkPayload.proofs);


      if (!result) {
        throw new Error("SDK batch withdrawal service returned undefined result");
      }


      // Return the SDK result directly - it already matches BatchRelayResult interface
      return result;

    } catch (error) {
      if (error instanceof SDKError) {
        throw SdkError.batchRelayError(error);
      } else {
        throw RelayerError.unknown(JSON.stringify(error));
      }
    }
  }
}
