import { NextFunction, Request, Response } from "express";
import { ChainId, getAssetConfig, getFeeReceiverAddress, getQuoteExpirationTime, getSignerPrivateKey } from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { starknetProvider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { Address, Hex, QuoteMarshall } from "../../types.js";
import { encodeWithdrawalData, getAddress, isFeeReceiverSameAsSigner, isNative, privateKeyToAccount } from "../../utils.js";
import { QuoteFee } from "../../services/quote.service.js";
import { FeeCommitment } from "../../interfaces/relayer/common.js";

export async function relayQuoteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  const chainId = req.body.chainId! as ChainId;
  const amountIn = BigInt(req.body.amount!.toString());
  const asset = getAddress(req.body.asset!.toString());
  let extraGas = Boolean(req.body.extraGas);

  const config = getAssetConfig(chainId, asset);
  if (config === undefined)
    return next(QuoterError.assetNotSupported(`Asset ${asset} for chain ${chainId} is not supported`));

  if (isNative(asset)) {
    extraGas = false;
  }

  let quote: QuoteFee;
  try {
    quote = await quoteService.quoteFeeBPSNative({
      chainId, amountIn, assetAddress: asset, baseFeeBPS: config.fee_bps, extraGas: extraGas
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
    baseFeeBPS: config.fee_bps,
    feeBPS,
    gasPrice,
    detail,
  });

  if (recipient) {
    let feeReceiverAddress: Address;
    const finalFeeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
    if (extraGas) {
      const pkey = getSignerPrivateKey(chainId) as Address;
      const signer = privateKeyToAccount(pkey);
      if (isFeeReceiverSameAsSigner(chainId)) {
        feeReceiverAddress = finalFeeReceiverAddress;
      } else {
        feeReceiverAddress = signer.address as Address;
      }
    } else {
      feeReceiverAddress = finalFeeReceiverAddress;
    }
    const withdrawalData: Hex = encodeWithdrawalData({
      feeRecipient: getAddress(feeReceiverAddress) as Address,
      recipient,
      relayFeeBPS: feeBPS
    });
    const expiration = Number(new Date()) + getQuoteExpirationTime();
    const relayerCommitment = { withdrawalData, expiration, asset, amount: amountIn, extraGas } as FeeCommitment;
    const signedRelayerCommitment = starknetProvider.signRelayerCommitment(chainId, relayerCommitment) as Hex;
    quoteResponse.addFeeCommitment({ expiration, asset, withdrawalData, signedRelayerCommitment, extraGas, amount: amountIn });
  }

  res
    .status(200)
    .json(res.locals.marshalResponse(quoteResponse));

}
