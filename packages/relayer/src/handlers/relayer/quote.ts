import { NextFunction, Response } from "express";
import { Address, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  RelayerConfig
} from "../../config/index.js";
import { QuoteRequest } from "../../middlewares/index.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteFee } from "../../services/quote.service.js";
import { QuoteMarshall } from "../../types.js";
import {
  encodeWithdrawalData,
  isNative
} from "../../utils.js";
import { createModuleLogger } from "../../logger/index.js";

// const TIME_20_SECS = 20 * 1000;
const TIME_60_SECS = 60 * 1000;

const logger = createModuleLogger(relayQuoteHandler);
const EXPIRATION_TIME = TIME_60_SECS;

export async function relayQuoteHandler(
  req: QuoteRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const chainId = req.body.chainId;
    const amountIn = req.body.amount;
    const asset = req.body.asset;
    let extraGas = Boolean(req.body.extraGas);
    const recipient = req.body.recipient ? req.body.recipient : undefined;
 
    logger.info("Quote generated", {
        chainId,
        amountIn,
        asset,
        extraGas,
        recipient
    });

    const chain = new RelayerConfig().chain(chainId);
    const assetConfig = await chain.assetConfig(asset);

    if (isNative(asset)) {
      extraGas = false;
    }

    let quote: QuoteFee;
    try {
      quote = await quoteService.quote({
        chainId,
        amountIn,
        assetAddress: asset,
        baseFeeBPS: assetConfig.fee_bps,
        extraGas,
      });
    } catch (e) {
      logger.error('Quote service error', { error: e, chainId, asset, amountIn: amountIn.toString() });
      return next(e);
    }

    const {
      feeBPS,
      gasPrice,
      relayTxGasUnits,
      extraGasTxGasUnits,
      extraGasFundGasUnits,
      out: value_out
    } = quote;

    const detail = {
      relayTxCost: { gas: relayTxGasUnits, eth: relayTxGasUnits * gasPrice },
      extraGasFundAmount: extraGasFundGasUnits
        ? { gas: extraGasFundGasUnits, eth: extraGasFundGasUnits * gasPrice }
        : undefined,
      extraGasTxCost: extraGasTxGasUnits
        ? { gas: extraGasTxGasUnits, eth: extraGasTxGasUnits * gasPrice }
        : undefined,
    };

    const quoteResponse = new QuoteMarshall({
      baseFeeBPS: assetConfig.fee_bps,
      feeBPS,
      gasPrice,
      detail,
    });

    if (recipient) {
      let feeReceiverAddress: Address;
      const finalFeeReceiverAddress = await chain.feeReceiverAddress();
      if (extraGas) {
        const signer = privateKeyToAccount(await chain.signerPrivateKey());
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
        relayFeeBPS: feeBPS,
      });
      const expiration = Number(new Date()) + EXPIRATION_TIME;
      const relayerCommitment = {
        withdrawalData,
        expiration,
        asset,
        amount: amountIn,
        extraGas,
      };
      const signedRelayerCommitment = await web3Provider.signRelayerCommitment(
        chainId,
        relayerCommitment,
      );

      quoteResponse.addFeeCommitment({
        expiration,
        asset,
        withdrawalData,
        signedRelayerCommitment,
        extraGas,
        amount: amountIn,
      });
    }

    const logPayload = {
      quote_request: {
        chain_id: chainId,
        asset,
        gas_price: gasPrice,
        value_in: amountIn,
        value_out,
        detail,
        fee_bps: feeBPS,
        base_fee_bps: assetConfig.fee_bps
      },
    };

    logger.info("Quote generated", logPayload);

    if (feeBPS >= assetConfig.fee_bps * 2n) {
      logger.warn(
        "Generated quote might be too high for requested amount",
        logPayload
      );
    }

    res.status(200).json(res.locals.marshalResponse(quoteResponse));
  } catch (error) {
    next(error);
  }
}
