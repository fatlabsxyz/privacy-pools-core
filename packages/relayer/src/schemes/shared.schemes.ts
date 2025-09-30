import { getAddress } from "viem";
import { z } from "zod";

export const zChainId = z
  .string() 
  .or(z.number())
  .pipe(z.coerce.number().positive());

export const zNonNegativeBigInt = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative());

// Address validation schema
export const zAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .length(42)
  .transform((v) => getAddress(v));

// Private key validation schema
export const zPrivateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .length(66)
  .transform((v) => v as `0x${string}`);

export const zFeeCommitment = z.object({
  expiration: z.number(),
  withdrawalData: z.string(),
  signedRelayerCommitment: z.string(),
});

export const zBatchFeeCommitment = z.object({
  expiration: z.number(),
  batchRelayData: z.string(),
  signedBatchRelayerCommitment: z.string(),
});
