import { NextFunction, Request, Response } from "express";
import { getAddress } from "viem";
import {
  BatchRelayRequestBody,
  BatchWithdrawalPayload,
  ContractWithdrawProof,
} from "../../interfaces/relayer/batchRequest.js";
import { RelayerResponse } from "../../interfaces/relayer/request.js";
import { ValidationError, ConfigError, WithdrawalValidationError } from "../../exceptions/base.exception.js";
import { getChainConfig } from "../../config/index.js";
import { web3Provider } from "../../providers/index.js";
import { batchRelayService } from "../../services/index.js";
import { BatchRequestMarshall } from "../../types.js";
import { BatchFeeCommitment } from "../../interfaces/relayer/common.js";
import { decodeBatchRelayData, BatchRelayData } from "../../utils/batchRelayEncoder.js";

/**
 * Checks if a batch fee commitment has expired.
 * @param batchFeeCommitment - The batch fee commitment to check
 * @returns true if expired, false otherwise
 */
function commitmentExpired(batchFeeCommitment: BatchFeeCommitment): boolean {
  return batchFeeCommitment.expiration < Number(new Date());
}

/**
 * Validates the signature of a batch fee commitment.
 * @param chainId - The chain ID
 * @param batchFeeCommitment - The batch fee commitment to validate
 * @returns Promise<boolean> - true if valid, false otherwise
 */
async function validBatchFeeCommitment(chainId: number, batchFeeCommitment: BatchFeeCommitment): Promise<boolean> {
  return web3Provider.verifyBatchRelayerCommitment(chainId, batchFeeCommitment);
}

/**
 * Validates and decodes the batch fee commitment.
 * This function should only be called when a commitment is provided.
 * @param chainId - The chain ID
 * @param batchFeeCommitment - The batch fee commitment to validate
 * @returns The decoded BatchRelayData
 * @throws {WithdrawalValidationError} - If validation fails
 */
async function validateAndDecodeBatchCommitment(
  chainId: number,
  batchFeeCommitment: BatchFeeCommitment
): Promise<BatchRelayData> {
  // Check if fee commitment has expired
  if (commitmentExpired(batchFeeCommitment)) {
    throw WithdrawalValidationError.relayerCommitmentRejected(
      `Batch relay fee commitment expired, please quote again`,
    );
  }

  // Verify signature
  if (!await validBatchFeeCommitment(chainId, batchFeeCommitment)) {
    throw WithdrawalValidationError.relayerCommitmentRejected(
      `Invalid batch relayer commitment signature`,
    );
  }

  // Decode and return the signed batch relay data
  return decodeBatchRelayData(batchFeeCommitment.batchRelayData);
}

/**
 * Parses and validates the batch withdrawal request body.
 * 
 * @param {Request["body"]} body - The request body to parse.
 * @returns {{ payload: BatchWithdrawalPayload, chainId: number }} - The validated batch payload and chain ID.
 * @throws {ValidationError} - If the input data is invalid.
 */
function parseBatchWithdrawal(body: Request["body"]): { payload: BatchWithdrawalPayload, chainId: number } {
  const batchBody = body as BatchRelayRequestBody;
  
  // Validate required fields
  if (!batchBody.withdrawal || !batchBody.proofs || !batchBody.poolAddress) {
    throw ValidationError.invalidInput({
      message: "Invalid request: missing required fields"
    });
  }
  
  // Validate batch size
  if (batchBody.proofs.length === 0) {
    throw ValidationError.invalidInput({
      message: "Invalid request: empty proofs array"
    });
  }
  
  if (batchBody.proofs.length > 255) {
    throw ValidationError.invalidInput({
      message: "Invalid request: batch size exceeds maximum of 255"
    });
  }
 
  // TODO ChainId is automatically set to sepolia even though we call it with id 1
  // this happens only if sepolia is configured, should investigate
  // Parse chain ID
  const chainId = typeof batchBody.chainId === 'string' 
    ? parseInt(batchBody.chainId, 10) 
    : batchBody.chainId;
    
  if (isNaN(chainId)) {
    throw ValidationError.invalidInput({ 
      message: "Invalid chain ID format" 
    });
  }
  
  // Convert proofs to match ProofLib.WithdrawProof structure EXACTLY
  const contractProofs: ContractWithdrawProof[] = batchBody.proofs.map((proof, index) => {
    
    // Validate we have exactly 8 public signals (required by contract)
    if (!proof || !proof.publicSignals || proof.publicSignals.length !== 8) {
      throw ValidationError.invalidInput({
        message: `Proof must have exactly 8 public signals, got ${proof?.publicSignals?.length || 'undefined'}`
      });
    }

    return {
      // Contract expects pA, pB, pC (NOT pi_a, pi_b, pi_c)
      pA: [proof.proof.pi_a?.[0] || '0', proof.proof.pi_a?.[1] || '0'] as [string, string],
      pB: [
        [proof.proof.pi_b?.[0]?.[0] || '0', proof.proof.pi_b?.[0]?.[1] || '0'], 
        [proof.proof.pi_b?.[1]?.[0] || '0', proof.proof.pi_b?.[1]?.[1] || '0']
      ] as [[string, string], [string, string]],
      pC: [proof.proof.pi_c?.[0] || '0', proof.proof.pi_c?.[1] || '0'] as [string, string],
      // Contract expects exactly uint256[8] pubSignals
      pubSignals: [
        proof.publicSignals[0], // newCommitmentHash
        proof.publicSignals[1], // existingNullifierHash  
        proof.publicSignals[2], // withdrawnValue
        proof.publicSignals[3], // stateRoot
        proof.publicSignals[4], // stateTreeDepth
        proof.publicSignals[5], // ASPRoot
        proof.publicSignals[6], // ASPTreeDepth
        proof.publicSignals[7]  // context
      ] as [string, string, string, string, string, string, string, string]
    };
  });
  
  // Build the batch withdrawal payload
  const payload: BatchWithdrawalPayload = {
    withdrawal: {
      processooor: getAddress(batchBody.withdrawal.processooor),
      data: batchBody.withdrawal.data as `0x${string}`,
    },
    proofs: contractProofs,
    originalProofs: batchBody.proofs, // Keep original proofs for verification
    poolAddress: getAddress(batchBody.poolAddress),
    batchFeeCommitment: batchBody.batchFeeCommitment
  };

  return { payload, chainId };
}

/**
 * Express route handler for batch relay requests.
 *
 * @param {Request} req - The incoming HTTP request.
 * @param {Response} res - The HTTP response object.
 * @param {NextFunction} next - The next middleware function.
 */
export async function batchRelayRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { payload: batchPayload, chainId } = parseBatchWithdrawal(req.body);

    // Validate and decode batch fee commitment (only if provided)
    let signedBatchData: BatchRelayData | undefined;
    if (batchPayload.batchFeeCommitment) {
      signedBatchData = await validateAndDecodeBatchCommitment(chainId, batchPayload.batchFeeCommitment);
    }

    // Check gas price
    const maxGasPrice = getChainConfig(chainId)?.max_gas_price;
    const currentGasPrice = await web3Provider.getGasPrice(chainId);
    if (maxGasPrice !== undefined && currentGasPrice > maxGasPrice) {
      throw ConfigError.maxGasPrice(`Current gas price ${currentGasPrice} is higher than max price ${maxGasPrice}`)
    }

    const requestResponse: RelayerResponse =
      await batchRelayService.handleBatchRequest(batchPayload, chainId, signedBatchData);

    res
      .status(200)
      .json(res.locals.marshalResponse(new BatchRequestMarshall(requestResponse)));
    next();
  } catch (error) {
    console.error("Batch request error:", error);
    next(error);
  }
}
