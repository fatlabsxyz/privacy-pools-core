import { NextFunction, Request, Response } from "express";
import { ChainId, CONFIG, getChainConfig } from "../../config/index.js";
import { ConfigError, ValidationError } from "../../exceptions/base.exception.js";
import {
  RelayerResponse,
  WithdrawalPayload,
} from "../../interfaces/relayer/request.js";
import { starknetProvider } from "../../providers/index.js";
import { zRelayRequest } from "../../schemes/relayer/request.scheme.js";
import { privacyPoolRelayer } from "../../services/index.js";
import { RequestMashall } from "../../types.js";

/**
 * Converts a RelayRequestBody into a WithdrawalPayload.
 *
 * @param {RelayRequestBody} body - The relay request body containing proof and withdrawal details.
 * @returns {WithdrawalPayload} - The formatted withdrawal payload.
 */
function relayRequestBodyToWithdrawalPayload(
  body: ReturnType<typeof zRelayRequest['parse']>,
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
 * @param {ChainId} chainId - The chain ID to check.
 * @returns {boolean} - Whether the chain is supported.
 */
function isChainSupported(chainId: ChainId): boolean {
  //TODO this could probably be better
  if (chainId === ChainId.Starknet || chainId === ChainId.Sepolia) {
    return true;
  } else {
    return false;
  }
}

/**
 * Parses and validates the withdrawal request body.
 *
 * @param {Request["body"]} body - The request body to parse.
 * @returns {{ payload: WithdrawalPayload, chainId: ChainId }} - The validated withdrawal payload and chain ID.
 * @throws {ValidationError} - If the input data is invalid.
 * @throws {ConfigError} - If the chain is not supported.
 */
function parseWithdrawal(body: Request["body"]): { payload: WithdrawalPayload, chainId: ChainId; } {

  const { data, error, success } = zRelayRequest.safeParse(body);
  const chainId = data?.chainId as ChainId;

  if (!success) {
    throw ValidationError.invalidInput({ error, message: "Error parsing payload" });
  }

  const payload = relayRequestBodyToWithdrawalPayload(data);

  // Check if the chain is supported early
  if (!isChainSupported(chainId)) {
    throw ValidationError.invalidInput({ message: `Chain with ID ${data.chainId} not supported.` });
  }

  return { payload, chainId};

}

/**
 * Express route handler for relaying requests.
 *
 * @param {Request} req - The incoming HTTP request.
 * @param {Response} res - The HTTP response object.
 * @param {NextFunction} next - The next middleware function.
 */
export async function relayRequestHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { payload: withdrawalPayload, chainId } = parseWithdrawal(req.body);

    const maxGasPrice = getChainConfig(chainId)?.max_gas_price;
    // const currentGasPrice = await starknetProvider.getGasPrice(chainId);
    // TODO: fix gas price later
    const currentGasPrice = 1n;

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
