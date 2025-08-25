import { NextFunction, Request, Response } from "express";
import { getAddress } from "viem";
import {
  BatchRelayRequestBody,
  BatchWithdrawalPayload,
} from "../../interfaces/relayer/batchRequest.js";
import { RelayerResponse } from "../../interfaces/relayer/request.js";
import { ValidationError, ConfigError } from "../../exceptions/base.exception.js";
import { getChainConfig } from "../../config/index.js";
import { web3Provider } from "../../providers/index.js";
import { batchRelayService } from "../../services/index.js";
import { BatchRequestMarshall } from "../../types.js";
import { WithdrawalProof } from "@0xbow/privacy-pools-core-sdk";

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
  
  // Parse chain ID
  const chainId = typeof batchBody.chainId === 'string' 
    ? parseInt(batchBody.chainId, 10) 
    : batchBody.chainId;
    
  if (isNaN(chainId)) {
    throw ValidationError.invalidInput({ 
      message: "Invalid chain ID format" 
    });
  }
  
  // Convert proofs to SDK format
  const sdkProofs: WithdrawalProof[] = batchBody.proofs.map(proof => ({
    proof: {
      pi_a: proof.proof.pi_a,
      pi_b: proof.proof.pi_b,
      pi_c: proof.proof.pi_c,
      protocol: "groth16",
      curve: "bn128",
    },
    publicSignals: proof.publicSignals
  }));
  
  // Build the batch withdrawal payload
  const payload: BatchWithdrawalPayload = {
    withdrawal: {
      processooor: getAddress(batchBody.withdrawal.processooor),
      data: batchBody.withdrawal.data as `0x${string}`,
    },
    proofs: sdkProofs,
    poolAddress: getAddress(batchBody.poolAddress),
    feeCommitment: batchBody.feeCommitment
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
    
    // Check gas price (same as regular request handler)
    const maxGasPrice = getChainConfig(chainId)?.max_gas_price;
    const currentGasPrice = await web3Provider.getGasPrice(chainId);
    if (maxGasPrice !== undefined && currentGasPrice > maxGasPrice) {
      throw ConfigError.maxGasPrice(`Current gas price ${currentGasPrice} is higher than max price ${maxGasPrice}`)
    }

    const requestResponse: RelayerResponse = 
      await batchRelayService.handleBatchRequest(batchPayload, chainId);

    res
      .status(200)
      .json(res.locals.marshalResponse(new BatchRequestMarshall(requestResponse)));
    next();
  } catch (error) {
    next(error);
  }
}