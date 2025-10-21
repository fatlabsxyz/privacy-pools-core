import { NextFunction, Response } from "express";
import { DetailsMarshall } from "../../types.js";
import { CONFIG, getAssetConfig, getChainConfig } from "../../config/index.js";
import { ValidationError } from "../../exceptions/base.exception.js";
import { DetailsRequest } from "../../middlewares/index.js";

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
  req: DetailsRequest,
  res: Response,
  next: NextFunction,
) {
  // Get query parameters
  const chainId = req.parsedQuery.chainId;
  const assetAddress = req.parsedQuery.assetAddress;

  // Get chain configuration
  const chainConfig = getChainConfig(chainId);

  // Get fee receiver address for this chain
  const feeReceiverAddress = chainConfig.fee_receiver_address || CONFIG.defaults.fee_receiver_address;

  // Get asset configuration  
  const assetConfig = getAssetConfig(chainId, assetAddress);

  if (!assetConfig) {
    throw ValidationError.invalidInput({
      message: `Asset ${assetAddress} not supported on chain ${chainId}`
    });
  }

  // Return details for the specific asset
  res.status(200).json(
    res.locals.marshalResponse(
      new DetailsMarshall({
        feeBPS: assetConfig.fee_bps,
        feeReceiverAddress: feeReceiverAddress,
        chainId,
        maxGasPrice: chainConfig.max_gas_price,
        assetAddress: assetAddress,
        minWithdrawAmount: assetConfig.min_withdraw_amount
      })
    )
  );

  next();
}
