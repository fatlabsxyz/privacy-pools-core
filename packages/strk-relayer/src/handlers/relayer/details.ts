import { NextFunction, Request, Response } from "express";
import { Address, DetailsMarshall } from "../../types.js";
import { ChainId, CONFIG, getAssetConfig, getChainConfig, getQuoteExpirationTime } from "../../config/index.js";
import { ValidationError } from "../../exceptions/base.exception.js";
import { getAddress, parseChainId } from "../../utils.js";

/**
 * Handler for the relayer details endpoint.
 * Supports querying by chain ID and asset address.
 * Returns details about the fee structure for a specific asset on a specific chain.
 * 
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export function relayerDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Get query parameters
  const chainId = parseChainId(req.query.chainId as string);
  const assetAddressParam = req.query.assetAddress as Address;

  // Validate asset address format
  let normalizedAssetAddress: Address;
  try {
    normalizedAssetAddress = getAddress(assetAddressParam);
  } catch {
    throw ValidationError.invalidInput({ message: "Invalid asset address format" });
  }

  // Get chain configuration
  const chainConfig = getChainConfig(chainId);

  // Get fee receiver address for this chain
  const feeReceiverAddress = chainConfig.fee_receiver_address || CONFIG.defaults.fee_receiver_address;

  // Get asset configuration  
  const assetConfig = getAssetConfig(chainId, normalizedAssetAddress);

  if (!assetConfig) {
    throw ValidationError.invalidInput({
      message: `Asset ${normalizedAssetAddress} not supported on chain ${chainId}`
    });
  }

  // Return details for the specific asset
  res.status(200).json(
    res.locals.marshalResponse(
      new DetailsMarshall({
        feeBPS: assetConfig.fee_bps,
        feeReceiverAddress: getAddress(feeReceiverAddress),
        chainId: chainId,
        quoteExpirationTime: getQuoteExpirationTime(),
        maxGasPrice: chainConfig.max_gas_price,
        assetAddress: normalizedAssetAddress as Address,
        minWithdrawAmount: assetConfig.min_withdraw_amount
      })
    )
  );

  next();
}

