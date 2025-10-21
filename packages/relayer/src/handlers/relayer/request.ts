import { NextFunction, Response } from "express";
import { CONFIG, getChainConfig, isExceptionToken } from "../../config/index.js";
import { ConfigError, ValidationError, RelayerError } from "../../exceptions/base.exception.js";
import {
  RelayerResponse,
  WithdrawalPayload,
} from "../../interfaces/relayer/request.js";
import { web3Provider } from "../../providers/index.js";
import { privacyPoolRelayer } from "../../services/index.js";
import { ChainId, RequestMashall } from "../../types.js";
import { RelayRequest } from "../../middlewares/relayer/request.js";
import { RelayBody } from "../../schemes/relayer/request.scheme.js";

/**
 * Converts a RelayRequestBody into a WithdrawalPayload.
 *
 * @param {RelayRequestBody} body - The relay request body containing proof and withdrawal details.
 * @returns {WithdrawalPayload} - The formatted withdrawal payload.
 */
function relayRequestBodyToWithdrawalPayload(
  body: RelayBody,
): WithdrawalPayload {
  return {
    ...body,
    proof: {
      proof: {
        ...body.proof,
        protocol: "groth16",
        curve: "bn128"
      },
      publicSignals: body.publicSignals,
    },
  };
}

/**
 * Checks if a chain ID is supported.
 * 
 * @param {number} chainId - The chain ID to check.
 * @returns {boolean} - Whether the chain is supported.
 */
function isChainSupported(chainId: ChainId): boolean {
  return CONFIG.chains.some(chain => chain.chain_id === chainId);
}

/**
 * Parses and validates the withdrawal request body.
 *
 * @param {Request["body"]} body - The request body to parse.
 * @returns {{ payload: WithdrawalPayload, chainId: number }} - The validated withdrawal payload and chain ID.
 * @throws {ValidationError} - If the input data is invalid.
 * @throws {ConfigError} - If the chain is not supported.
 */
function parseWithdrawal(body: RelayRequest["body"]): { payload: WithdrawalPayload, chainId: ChainId } {

  const payload = relayRequestBodyToWithdrawalPayload(body);
  const chainId = body.chainId;

  // Check if the chain is supported early
  if (!isChainSupported(chainId)) {
    throw ValidationError.invalidInput({ message: `Chain with ID ${chainId} not supported.` });
  }
  return { payload, chainId };
}

/**
 * Express route handler for relaying requests.
 *
 * @param {Request} req - The incoming HTTP request.
 * @param {Response} res - The HTTP response object.
 * @param {NextFunction} next - The next middleware function.
 */
export async function relayRequestHandler(
  req: RelayRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { payload: withdrawalPayload, chainId } = parseWithdrawal(req.body);

    const maxGasPrice = getChainConfig(chainId)?.max_gas_price;
    const currentGasPrice = await web3Provider.getGasPrice(chainId);

    // XXX: Block extraGas for EXCEPTION_TOKENS
    if (withdrawalPayload.feeCommitment?.extraGas && isExceptionToken(withdrawalPayload.feeCommitment?.asset)) {
      throw RelayerError.assetNotSupported(`Extra gas feature not supported for ${withdrawalPayload.feeCommitment?.asset}`);
    }

    if (maxGasPrice !== undefined && currentGasPrice > maxGasPrice) {
      throw ConfigError.maxGasPrice(`Current gas price ${currentGasPrice} is higher than max price ${maxGasPrice}`);
    }

    const requestResponse: RelayerResponse =
      await privacyPoolRelayer.handleRequest(withdrawalPayload, chainId);

    res
      .status(200)
      .json(res.locals.marshalResponse(new RequestMashall(requestResponse)));
    next();
  } catch (error) {
    next(error);
  }
}
