import { getAddress } from "viem";
import { getAssetConfig, getFeeReceiverAddress, getQuoteExpirationTime, getSignerPrivateKey } from "../../config/index.js";
import { QuoterError } from "../../exceptions/base.exception.js";
import { web3Provider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { QuoteMarshall } from "../../types.js";
import { encodeWithdrawalData, isFeeReceiverSameAsSigner, isNative } from "../../utils.js";
import { privateKeyToAccount } from "viem/accounts";
export async function relayQuoteHandler(req, res, next) {
    const chainId = Number(req.body.chainId);
    const amountIn = BigInt(req.body.amount.toString());
    const asset = getAddress(req.body.asset.toString());
    let extraGas = Boolean(req.body.extraGas);
    const config = getAssetConfig(chainId, asset);
    if (config === undefined)
        return next(QuoterError.assetNotSupported(`Asset ${asset} for chain ${chainId} is not supported`));
    if (isNative(asset)) {
        extraGas = false;
    }
    let quote;
    try {
        quote = await quoteService.quoteFeeBPSNative({
            chainId, amountIn, assetAddress: asset, baseFeeBPS: config.fee_bps, extraGas: extraGas
        });
    }
    catch (e) {
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
        let feeReceiverAddress;
        const finalFeeReceiverAddress = getAddress(getFeeReceiverAddress(chainId));
        if (extraGas) {
            const signer = privateKeyToAccount(getSignerPrivateKey(chainId));
            if (isFeeReceiverSameAsSigner(chainId)) {
                feeReceiverAddress = finalFeeReceiverAddress;
            }
            else {
                feeReceiverAddress = signer.address;
            }
        }
        else {
            feeReceiverAddress = finalFeeReceiverAddress;
        }
        const withdrawalData = encodeWithdrawalData({
            feeRecipient: getAddress(feeReceiverAddress),
            recipient,
            relayFeeBPS: feeBPS
        });
        const expiration = Number(new Date()) + getQuoteExpirationTime();
        const relayerCommitment = { withdrawalData, expiration, asset, amount: amountIn, extraGas };
        const signedRelayerCommitment = await web3Provider.signRelayerCommitment(chainId, relayerCommitment);
        quoteResponse.addFeeCommitment({ expiration, asset, withdrawalData, signedRelayerCommitment, extraGas, amount: amountIn });
    }
    res
        .status(200)
        .json(res.locals.marshalResponse(quoteResponse));
}
//# sourceMappingURL=quote.js.map