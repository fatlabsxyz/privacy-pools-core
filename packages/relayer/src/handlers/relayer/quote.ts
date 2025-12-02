import { NextFunction, Request, Response } from "express";
import { Address, getAddress } from "viem";
import { getAssetConfig, getFeeReceiverAddress, getSignerPrivateKey, isExceptionToken } from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteMarshall } from "../../types.js";
import { encodeWithdrawalData, isFeeReceiverSameAsSigner, isNative, JSONStringifyBigInt } from "../../utils.js";
import { privateKeyToAccount } from "viem/accounts";
import { QuoteFee } from "../../services/quote.service.js";
import logger from "../../logger/index.js";

// const TIME_20_SECS = 20 * 1000;
const TIME_60_SECS = 60 * 1000;

const EXPIRATION_TIME = TIME_60_SECS;

export async function relayQuoteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  const chainId = Number(req.body.chainId!);
  const amountIn = BigInt(req.body.amount!.toString());
  const asset = getAddress(req.body.asset!.toString());
  let extraGas = Boolean(req.body.extraGas);

  const config = getAssetConfig(chainId, asset);
  if (config === undefined)
    return next(QuoterError.assetNotSupported(`Asset ${asset} for chain ${chainId} is not supported`));

  const baseFeeBPS = config.fee_bps!;

  if (isNative(asset)) {
    extraGas = false;
  }

  // XXX: Block extraGas for EXCEPTION_TOKENS
  if (extraGas && isExceptionToken(asset)) {
    return next(QuoterError.assetNotSupported(`Extra gas feature not supported for ${asset}`));
  }

  let quote: QuoteFee;
  try {
    quote = await quoteService.quoteFeeBPSNative({
      chainId, amountIn, assetAddress: asset, baseFeeBPS, extraGas: extraGas
    });
  } catch (e) {
    return next(e);
  }

  const { feeBPS, gasPrice, extraGasFundAmount, relayTxCost, extraGasTxCost } = quote;

  const recipient = req.body.recipient ? getAddress(req.body.recipient.toString()) : undefined;
  const detail = {
    relayTxCost: { gas: relayTxCost, eth: relayTxCost * gasPrice },
    extraGasFundAmount: extraGasFundAmount ? { gas: extraGasFundAmount, eth: extraGasFundAmount * gasPrice } : undefined,
    extraGasTxCost: extraGasTxCost ? { gas: extraGasTxCost, eth: extraGasTxCost * gasPrice } : undefined,
  };

  const quoteResponse = new QuoteMarshall({
    baseFeeBPS,
    feeBPS,
    gasPrice,
    detail,
  });

  if (recipient) {
    let feeReceiverAddress: `0x${string}`;
    const finalFeeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
    if (extraGas) {
      const signer = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);
      if (isFeeReceiverSameAsSigner(chainId)) {
        feeReceiverAddress = finalFeeReceiverAddress;
      } else {
        feeReceiverAddress = signer.address;
      }
    } else {
      feeReceiverAddress = finalFeeReceiverAddress;
    }
    const withdrawalData = encodeWithdrawalData({
      feeRecipient: getAddress(feeReceiverAddress),
      recipient,
      relayFeeBPS: feeBPS
    });
    const expiration = Number(new Date()) + EXPIRATION_TIME;
    const relayerCommitment = { withdrawalData, expiration, asset, amount: amountIn, extraGas };
    const signedRelayerCommitment = await web3Provider.signRelayerCommitment(chainId, relayerCommitment);
    quoteResponse.addFeeCommitment({ expiration, asset, withdrawalData, signedRelayerCommitment, extraGas, amount: amountIn });

    
    if (feeBPS >= baseFeeBPS * 2n) {
      logger.warn(`{quote: {"message": "fee_bps of ${feeBPS} is greater than double of base_fee_bps ( ${baseFeeBPS * 2n})"}}`);
    }

    logger.info(`{quoteRequest: ${
      serializeLog(
        asset,
        gasPrice,
        amountIn,
        quote.out!,
        detail,
        feeBPS,
        baseFeeBPS
      )}}`
    );
  }

  res
    .status(200)
    .json(res.locals.marshalResponse(quoteResponse));

}

function serializeLog(
  asset: Address, 
  gas_price: bigint, 
  value_in: bigint,
  value_out: bigint,
  detail: object,
  fee_bps: bigint, 
  base_fee_bps: bigint 
  ): string {

  return JSONStringifyBigInt({
    asset, 
    gas_price, 
    value_in, 
    value_out, 
    detail, 
    fee_bps, 
    base_fee_bps
  })
}
