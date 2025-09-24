import { z } from "zod";

export const zFeeCommitment = z.object({
  expiration: z.number(),
  withdrawalData: z.string(),
  signedRelayerCommitment: z.string(),
});
