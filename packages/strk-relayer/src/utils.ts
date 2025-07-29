// import {
//   Address,
//   Chain,
//   ChainConfig,
//   ContractFunctionExecutionError,
//   ContractFunctionRevertedError,
//   decodeAbiParameters, DecodeAbiParametersErrorType,
//   encodeAbiParameters,
//   EncodeAbiParametersErrorType,
//   BaseError as ViemError
// } from "viem";
import {
  ValidationError,
  WithdrawalValidationError,
} from "./exceptions/base.exception.js";
import {
  RelayRequestBody,
  WithdrawPublicSignals,
} from "./interfaces/relayer/request.js";
import { FeeDataAbi } from "./types/abi.types.js";
import { ChainConfig, ChainId, getFeeReceiverAddress, getSignerPrivateKey } from "./config/index.js";
import { privateKeyToAccount } from "viem/accounts";
import { Address } from "./types.js";

interface WithdrawalData {
  recipient: Address,
  feeRecipient: Address,
  relayFeeBPS: bigint;
}

export function decodeWithdrawalData(data: `0x${string}`): WithdrawalData {
  try {
    const [{ recipient, feeRecipient, relayFeeBPS }] = decodeAbiParameters(
      FeeDataAbi,
      data,
    );
    return { recipient, feeRecipient, relayFeeBPS };
  } catch (e) {
    const error = { name: "name", message:"message" }; //TODO: fix this later (as DecodeAbiParametersErrorType)
    throw WithdrawalValidationError.invalidWithdrawalAbi({
      name: error.name,
      message: error.message,
    });
  }
}

export function encodeWithdrawalData(withdrawalData: WithdrawalData): Address {
  // try {
  //   // TODO: should encode the abi params into a string instead of array of withdrawalData 
  //   return encodeAbiParameters(FeeDataAbi, [withdrawalData]);
  // } catch (e) {
  //   const error = { name: "name", message:"message" }; //TODO: fix this later (as EncodeAbiParametersErrorType)
  //
  //   throw WithdrawalValidationError.invalidWithdrawalAbi({
  //     name: error.name,
  //     message: error.message
  //   });
  // }

}

export function parseSignals(
  signals: RelayRequestBody["publicSignals"],
): WithdrawPublicSignals {
  const badSignals = signals
    .map((x, i) => (x === undefined ? i : null))
    .filter((i) => i !== null);
  if (badSignals.length > 0) {
    throw ValidationError.invalidInput({
      details: `Signals ${badSignals.join(", ")} are undefined`,
    });
  }
  /// XXX: beware this signal distribution is based on how the circuits were compiled with circomkit, first 2 are the public outputs, next are the public inputs
  return {
    newCommitmentHash: BigInt(signals[0]!), // Hash of new commitment
    existingNullifierHash: BigInt(signals[1]!), // Hash of the existing commitment nullifier
    withdrawnValue: BigInt(signals[2]!),
    stateRoot: BigInt(signals[3]!),
    stateTreeDepth: BigInt(signals[4]!),
    ASPRoot: BigInt(signals[5]!),
    ASPTreeDepth: BigInt(signals[6]!),
    context: BigInt(signals[7]!),
  };
}


// TODO this seems to be used by Viem, might not need it
//

/**
 * Creates a Chain object for the given chain configuration
 * 
 * @param {object} chainConfig - The chain configuration
 * @returns {Chain} - The Chain object
 */
// export function createChainObject(chainConfig: ChainConfig): Chain {
//   return {
//     name: chainConfig.chain_name,
//     nativeCurrency: chainConfig.native_currency!, //TODO check this later, it should be set by zod
//     rpcUrls: {
//       default: { http: [chainConfig.rpc_url] },
//       public: { http: [chainConfig.rpc_url] },
//     },
//   };
// }

// export function isViemError(error: unknown): error is ViemError {
//   const viemErrorNames = [
//     ContractFunctionExecutionError.prototype.constructor.name,
//     ContractFunctionRevertedError.prototype.constructor.name,
//   ];
//   return viemErrorNames.includes(error?.constructor?.name || "");
// }

export function isFeeReceiverSameAsSigner(chain: ChainId) {
  const feeReceiverAddress = getFeeReceiverAddress(chain);
  const signerAddress = privateKeyToAccount(getSignerPrivateKey(chain) as Address).address;
  // TODO check how I can convert a pkey to an account in starkjs

  return feeReceiverAddress.toLowerCase() === signerAddress.toLowerCase();
}

export function isNative(asset: Address) {
  return asset.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}
