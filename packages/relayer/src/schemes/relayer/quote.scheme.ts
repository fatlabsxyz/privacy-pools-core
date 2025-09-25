import { z } from "zod";
import { zAddress, zChainId, zNonNegativeBigInt } from "../shared.schemes.js";

const zQuoteSchema = z.object({
  chainId: zChainId,
  amount: zNonNegativeBigInt,
  asset: zAddress,
  recipient: zAddress.optional(),
});

export const validateQuoteBody = (data: unknown) => {
  const result = zQuoteSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
