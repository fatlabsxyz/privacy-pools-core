import { NextFunction, Response } from "express";
import { Address, getAddress } from "viem";
import { isExceptionToken, RelayerConfig } from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteMarshall } from "../../types.js";
import { encodeWithdrawalData, isNative } from "../../utils.js";
import { privateKeyToAccount } from "viem/accounts";
import { QuoteFee } from "../../services/quote.service.js";
import { QuoteRequest } from "../../middlewares/index.js";

// const TIME_20_SECS = 20 * 1000;
const TIME_60_SECS = 60 * 1000;

const EXPIRATION_TIME = TIME_60_SECS;

export async function relayQuoteHandler(
  req: QuoteRequest,
  res: Response,
  next: NextFunction,
) {

  const chainId = req.body.chainId;
  const amountIn = req.body.amount;
  const asset = req.body.asset;
  let extraGas = Boolean(req.body.extraGas);

  
  const chain = new RelayerConfig().chain(chainId)
  const [assetConfig, error]= await chain.assetConfig(asset);
  if (error)
    return next(QuoterError.assetNotSupported(`Asset ${asset} for chain ${chainId} is not supported`));

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
      chainId, amountIn, assetAddress: asset, baseFeeBPS: assetConfig!.fee_bps, extraGas: extraGas
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
    baseFeeBPS: assetConfig!.fee_bps,
    feeBPS,
    gasPrice,
    detail,
  });

  if (recipient) {
    let feeReceiverAddress: Address;
    const finalFeeReceiverAddress = await chain.feeReceiverAddress();
    if (extraGas) {
      const pkey = await chain.signerPrivateKey();
      const signer = privateKeyToAccount(pkey);
      if (await chain.isFeeReceiverSameAsSigner()) {
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
  }

  res
    .status(200)
    .json(res.locals.marshalResponse(quoteResponse));

}
