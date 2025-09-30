/**
 * Utility functions for batch relay operations
 * Extracted from BatchRelayService for reusability and testability
 * All logic kept identical to original implementation
 */

import { parseSignals } from "../utils.js";
import { ContractWithdrawProof } from "../interfaces/relayer/batchRequest.js";

// Constants (moved from batchRelay.service.ts)
export const BASE_GAS_UNITS = 160500n;
export const GAS_UNITS_PER_NOTE = 650000n;
export const GAS_PRICE_BUFFER = 20n;

/**
 * Calculate gas units needed for a batch relay operation
 * Original: BatchRelayService.calculateBatchGasUnits()
 */
export function calculateBatchGasUnits(batchSize: number): bigint {
  const baseGasUnits = BASE_GAS_UNITS;
  const notesGasUnits = GAS_UNITS_PER_NOTE * BigInt(batchSize);

  return baseGasUnits + notesGasUnits;
}

/**
 * Calculate total withdrawal amounts from proofs
 * Original: BatchRelayService.calculateTotalAmount()
 */
export function calculateTotalAmountFromProofs(proofs: ContractWithdrawProof[]): bigint {
  let totalAmount = 0n;

  for (const proof of proofs) {
    const signals = parseSignals(proof.pubSignals);
    const amount = signals.withdrawnValue;
    totalAmount += amount;
  }

  return totalAmount;
}
