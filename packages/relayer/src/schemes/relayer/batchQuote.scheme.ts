import { Ajv, JSONSchemaType } from "ajv";
import { BatchRelayQuoteRequest } from "../../interfaces/relayer/batchRequest.js";

// AJV schema for validation
const ajv = new Ajv();

const batchQuoteSchema: JSONSchemaType<BatchRelayQuoteRequest> = {
  type: "object",
  properties: {
    batchSize: { type: "number" },
    totalAmount: { type: "string" },
    chainId: { type: ["string", "number"] },
    recipient: { type: "string", nullable: true },
    feeCommitment: {
      type: "object",
      properties: {
        expiration: { type: "number" },
        withdrawalData: { type: "string" },
        signedRelayerCommitment: { type: "string" },
      },
      required: ["expiration", "withdrawalData", "signedRelayerCommitment"],
      nullable: true,
    },
  },
  required: ["batchSize", "totalAmount", "chainId"],
  additionalProperties: false,
} as const;

export const validateBatchRelayQuoteBody = ajv.compile(batchQuoteSchema);