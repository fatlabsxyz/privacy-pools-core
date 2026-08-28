import { NextFunction, Response } from "express";
import { Address, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  isExceptionToken,
  RelayerConfig
} from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { createModuleLogger } from "../../logger/index.js";
import { QuoteRequest } from "../../middlewares/index.js";
import { sdkProvider, web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteFee } from "../../services/quote.service.js";
import { QuoteMarshall } from "../../types.js";
import {
  encodeWithdrawalData,
  isNative
} from "../../utils.js";

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

    const chain = new RelayerConfig().chain(chainId);
    const [assetConfig, _] = await chain.assetConfig(asset);
    if (assetConfig === undefined)
      return next(QuoterError.assetNotSupported(`Asset ${asset} for chain ${chainId} is not supported`));

    if (isNative(asset)) {
      extraGas = false;
    }

    // XXX: Block extraGas for EXCEPTION_TOKENS
    if (extraGas && isExceptionToken(asset)) {
      return next(
        QuoterError.extraGasNotSupported(
          `Extra gas feature not supported for ${asset}`,
        ),
      );
    } else if (extraGas && chainId == 42161) {
      return next(
        QuoterError.extraGasNotSupported(
          `Extra gas feature not supported for chain 42161`,
        ),
      );
    }

    let quote: QuoteFee;
    try {
      quote = await quoteService.quoteFeeBPSNative({
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
      extraGasFundAmount,
      relayTxCost,
      extraGasTxCost
    } = quote;

    // The Entrypoint reverts any relay whose fee exceeds the pool's maxRelayFeeBPS,
    // so refuse to quote (and sign a commitment for) a fee that can never be relayed.
    const { maxRelayFeeBPS } = await sdkProvider.getAssetConfig(chainId, asset);
    if (feeBPS > maxRelayFeeBPS) {
      // The variable part of the fee scales with 1/amount, so the smallest amount
      // that fits under the pool cap at the current gas price is:
      //   amountIn * (feeBPS - base) / (maxRelayFeeBPS - base)
      const variableFeeBPS = feeBPS - assetConfig.fee_bps;
      const headroomBPS = maxRelayFeeBPS - assetConfig.fee_bps;
      const suggestedMinAmount = headroomBPS > 0n
        ? (amountIn * variableFeeBPS + headroomBPS - 1n) / headroomBPS
        : undefined;
      logger.warn("Quoted fee exceeds pool's max relay fee", {
        chain_id: chainId,
        asset,
        amount_in: amountIn.toString(),
        fee_bps: feeBPS.toString(),
        max_relay_fee_bps: maxRelayFeeBPS.toString(),
        suggested_min_amount: suggestedMinAmount?.toString(),
      });
      return next(
        QuoterError.feeExceedsPoolMax({
          message: `Quoted fee ${feeBPS} BPS exceeds pool maximum ${maxRelayFeeBPS} BPS for asset ${asset}; increase the withdrawal amount`,
          feeBPS: feeBPS.toString(),
          maxRelayFeeBPS: maxRelayFeeBPS.toString(),
          // Smallest withdrawal that fits under the cap at the current gas price;
          // gas moves between quotes, so treat it as a floor, not a guarantee.
          suggestedMinAmount: suggestedMinAmount?.toString(),
        }),
      );
    }

    const recipient = req.body.recipient
      ? getAddress(req.body.recipient.toString())
      : undefined;
    const detail = {
      relayTxCost: { gas: relayTxCost, eth: relayTxCost * gasPrice },
      extraGasFundAmount: extraGasFundAmount
        ? { gas: extraGasFundAmount, eth: extraGasFundAmount * gasPrice }
        : undefined,
      extraGasTxCost: extraGasTxCost
        ? { gas: extraGasTxCost, eth: extraGasTxCost * gasPrice }
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
        value_out: quote.out!,
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
    console.error(error);
    next(error);
  }
}
