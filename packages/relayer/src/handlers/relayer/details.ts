import { NextFunction, Response } from "express";
import { Address } from "viem";
import { RelayerConfig } from "../../config/index.js";
import { RelayerError } from "../../exceptions/base.exception.js";
import { createModuleLogger } from "../../logger/index.js";
import { DetailsRequest } from "../../middlewares/index.js";
import { sdkProvider } from "../../providers/index.js";
import { quoteService } from "../../services/index.js";
import { ChainId, DetailsMarshall } from "../../types.js";
import { isNative } from "../../utils.js";

const logger = createModuleLogger(relayerDetailsHandler);

/**
 * The dynamic minimum is derived from the current gas price, which moves between
 * the details call and the actual relay, so it is padded to stay a useful floor.
 */
const DYNAMIC_MIN_PAD = 2n;

/** How long a computed dynamic minimum is served from cache. */
const DYNAMIC_MIN_CACHE_TTL_MS = 60_000;

const dynamicMinCache = new Map<string, { min: bigint | undefined; fetchedAt: number; }>();

/**
 * Computes the smallest withdrawal amount whose relay fee fits under the pool's
 * on-chain maxRelayFeeBPS at the current gas price, padded by DYNAMIC_MIN_PAD.
 *
 * The relay fee is baseFeeBPS plus a gas-cost component that scales with
 * 1/amount, so quoting a probe amount is enough to solve for the boundary:
 *   minAmount = probe * (probeFeeBPS - base) / (maxRelayFeeBPS - base)
 *
 * Returns undefined when the minimum cannot be computed (unregistered asset,
 * quote failure, no probe amount available, or no headroom under the cap).
 */
async function dynamicMinWithdrawAmount(
  chainId: ChainId,
  assetAddress: Address,
  baseFeeBPS: bigint,
  configuredMin: bigint,
): Promise<bigint | undefined> {
  const cacheKey = `${chainId}:${assetAddress.toLowerCase()}`;
  const cached = dynamicMinCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < DYNAMIC_MIN_CACHE_TTL_MS) {
    return cached.min;
  }

  let min: bigint | undefined;
  try {
    const { maxRelayFeeBPS, minimumDepositAmount } = await sdkProvider.getAssetConfig(chainId, assetAddress);
    const headroomBPS = maxRelayFeeBPS - baseFeeBPS;

    // ERC20 probes go through external swap quoters, which need a plausible
    // trade size; fall back through configured min, on-chain minimum deposit,
    // and (for native assets, where the quote is a no-op) a fixed 1 ETH probe.
    let probe = configuredMin > 0n ? configuredMin : minimumDepositAmount;
    if (probe === 0n && isNative(assetAddress)) {
      probe = 10n ** 18n;
    }

    if (headroomBPS > 0n && probe > 0n) {
      const { feeBPS: probeFeeBPS } = await quoteService.quoteFeeBPSNative({
        chainId,
        assetAddress,
        amountIn: probe,
        baseFeeBPS,
        extraGas: false,
      });
      const variableFeeBPS = probeFeeBPS - baseFeeBPS;
      min = DYNAMIC_MIN_PAD * ((probe * variableFeeBPS + headroomBPS - 1n) / headroomBPS);
    }
  } catch (error) {
    logger.warn("Failed to compute dynamic min withdraw amount", {
      chain_id: chainId,
      asset: assetAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }

  dynamicMinCache.set(cacheKey, { min, fetchedAt: Date.now() });
  return min;
}

/**
 * Handler for the relayer details endpoint.
 * Supports querying by chain ID and asset address.
 * Returns details about the fee structure for a specific asset on a specific chain.
 *
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export async function relayerDetailsHandler(
  req: DetailsRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const chainId = req.parsedQuery.chainId;
    const assetAddress = req.parsedQuery.assetAddress;

    const chain = new RelayerConfig().chain(chainId);

    const feeReceiverAddress = await chain.feeReceiverAddress();

    const [assetConfig, error] = await chain.assetConfig(assetAddress);

    if (error) {
      return next(RelayerError.assetNotSupported({
        message: `Asset ${assetAddress} for chain ${chainId} is not supported`
      }));
    }

    const configuredMin = assetConfig!.min_withdraw_amount;
    const dynamicMin = await dynamicMinWithdrawAmount(
      chainId,
      assetAddress,
      assetConfig!.fee_bps,
      configuredMin,
    );
    const minWithdrawAmount = dynamicMin !== undefined && dynamicMin > configuredMin
      ? dynamicMin
      : configuredMin;

    res.status(200).json(
      res.locals.marshalResponse(
        new DetailsMarshall({
          feeBPS: assetConfig!.fee_bps,
          feeReceiverAddress,
          chainId,
          maxGasPrice: await chain.max_gas_price(),
          assetAddress: assetAddress,
          minWithdrawAmount
        })
      )
    );

    next();
  } catch (error) {
    console.error(error);
    next(error);
  }
}
