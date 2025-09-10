import { NextFunction, Request, Response } from "express";
import { getAddress } from "viem";
import { getAssetConfig, getFeeReceiverAddress } from "../../config/index.js";
import { QuoterError, ValidationError } from "../../exceptions/base.exception.js";
import { web3Provider } from "../../providers/index.js";
import { batchRelayService } from "../../services/index.js";
import { encodeBatchRelayData } from "../../utils/batchRelayEncoder.js";
import { BatchQuoteMarshall } from "../../types.js";
import { 
  BatchRelayQuoteRequest, 
  BatchRelayQuoteResponse 
} from "../../interfaces/relayer/batchRequest.js";

const TIME_20_SECS = 20 * 1000;

/**
 * Handler for batch relay quote requests
 * Provides fee quotes for batch withdrawals
 */
export async function batchRelayQuoteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body as BatchRelayQuoteRequest;
    const chainId = Number(body.chainId);
    const batchSize = Number(body.batchSize);
    const totalAmount = BigInt(body.totalAmount);
    
    // Validate batch size
    if (batchSize < 1 || batchSize > 255) {
      return next(ValidationError.invalidInput({
        message: "Invalid batch size. Must be between 1 and 255"
      }));
    }
    
    // Validate total amount
    if (totalAmount <= 0n) {
      return next(ValidationError.invalidInput({
        message: "Invalid total amount. Must be greater than 0"
      }));
    }
    
    // Get asset address - for batch, we assume native ETH
    // In future, this could be passed in the request
    const assetAddress = getAddress("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
    
    const config = getAssetConfig(chainId, assetAddress);
    if (config === undefined) {
      return next(QuoterError.assetNotSupported(`Asset ${assetAddress} for chain ${chainId} is not supported`));
    }
    
    // Calculate the fee BPS needed for this batch
    // This will be the same BPS applied to all withdrawals in the batch
    const feeBPS = await batchRelayService.calculateBatchFeeBPS(
      chainId,
      totalAmount,
      batchSize
    );
    
    // Calculate estimated fee (same BPS applied to total amount)
    const estimatedFee = (totalAmount * BigInt(feeBPS)) / 10000n;
    
    // Calculate estimated gas units for display (no pricing applied)
    const estimatedGasUnits = batchRelayService.calculateBatchGasUnits(batchSize);
    
    // Create expiration timestamp
    const expiresAt = Date.now() + TIME_20_SECS;
    
    // Build response
    const response: BatchRelayQuoteResponse = {
      relayFeeBPS: feeBPS,
      estimatedFee: estimatedFee.toString(),
      estimatedGas: estimatedGasUnits.toString(),
      expiresAt,
    };
    
    // If recipient is provided, create a fee commitment
    const recipient = req.body.recipient ? getAddress(req.body.recipient.toString()) : undefined;
    
    if (recipient) {
      const feeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
      
      // Encode batch relay data with the calculated fee BPS
      const batchRelayData = encodeBatchRelayData({
        recipient,
        feeRecipient: feeReceiverAddress,
        relayFeeBPS: BigInt(feeBPS),
        batchSize,
        totalValue: totalAmount
      });
      
      const relayerCommitment = { 
        withdrawalData: batchRelayData, 
        expiration: expiresAt 
      };
      
      const signedRelayerCommitment = await web3Provider.signRelayerCommitment(
        chainId, 
        relayerCommitment
      );
      
      response.feeCommitment = {
        withdrawalData: batchRelayData,
        expiration: expiresAt,
        signedRelayerCommitment
      };
    }
    
    res
      .status(200)
      .json(res.locals.marshalResponse(new BatchQuoteMarshall(response)));
    
  } catch (error) {
    next(error);
  }
}