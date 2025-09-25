import { z } from "zod";
import { zChainId, zFeeCommitment } from "../shared.schemes.js";

const zWithdrawal = z.object({
  processooor: z.string(),
  data: z.string(),
});


const zPublicSignals = z.array(z.string()).length(8);

const zProof = z.object({
  protocol: z.string().optional(),
  curve: z.string().optional(),
  pi_a: z.array(z.string()).min(1),
  pi_b: z.array(z.array(z.string()).min(1)).min(1),
  pi_c: z.array(z.string()).min(1),
});

const zRelayRequestSchema = z.object({
  withdrawal: zWithdrawal,
  publicSignals: zPublicSignals,
  proof: zProof,
  scope: z.string(),
  chainId: zChainId,
  feeCommitment: zFeeCommitment.optional(),
});

export const validateRelayRequestBody = (data: unknown) => {
  const result = zRelayRequestSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
