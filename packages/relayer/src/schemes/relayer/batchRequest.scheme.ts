import { Ajv } from "ajv";
import { BatchRelayRequestBody } from "../../interfaces/relayer/batchRequest.js";

const ajv = new Ajv();

// Schema for proof payload
const proofPayloadSchema = {
  type: "object",
  properties: {
    pi_a: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 2,
    },
    pi_b: {
      type: "array",
      items: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 2,
      },
      minItems: 2,
      maxItems: 2,
    },
    pi_c: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ["pi_a", "pi_b", "pi_c"],
  additionalProperties: false,
};

// Schema for individual proof in the array
const batchProofSchema = {
  type: "object",
  properties: {
    publicSignals: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
    },
    proof: proofPayloadSchema,
  },
  required: ["publicSignals", "proof"],
  additionalProperties: false,
};

// Schema for withdrawal
const withdrawalSchema = {
  type: "object",
  properties: {
    processooor: { type: "string" },
    data: { type: "string" },
  },
  required: ["processooor", "data"],
  additionalProperties: false,
};

// Schema for fee commitment (optional)
const feeCommitmentSchema = {
  type: "object",
  properties: {
    relayFeeBPS: { type: "number" },
    expiresAt: { type: "number" },
    signature: { type: "string" },
  },
  required: ["relayFeeBPS", "expiresAt"],
  additionalProperties: false,
};

// Main schema for batch relay request body  
const batchRelayRequestBodySchema = {
  type: "object",
  properties: {
    withdrawal: withdrawalSchema,
    proofs: {
      type: "array",
      items: batchProofSchema,
      minItems: 1,
      maxItems: 255, // Max batch size
    },
    poolAddress: { type: "string" },
    chainId: {
      oneOf: [
        { type: "string" },
        { type: "number" },
      ],
    },
    feeCommitment: feeCommitmentSchema,
  },
  required: ["withdrawal", "proofs", "poolAddress", "chainId"],
  additionalProperties: false,
};

// Compile and export the validation function
export const validateBatchRelayRequestBody = ajv.compile<BatchRelayRequestBody>(
  batchRelayRequestBodySchema
);