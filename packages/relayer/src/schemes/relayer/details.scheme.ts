import { z } from "zod";
import { zAddress, zChainId } from "../shared.schemes.js";

const zDetailsRequestSchema = z.object({
  chainId: zChainId,
  assetAddress: zAddress,
});

export const validateDetailsQuerystring = (data: unknown) => {
  const result = zDetailsRequestSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
