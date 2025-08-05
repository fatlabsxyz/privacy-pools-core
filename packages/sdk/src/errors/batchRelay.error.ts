import { BaseError } from './base.error.js';

/**
 * Error thrown when batch relay operations fail
 */
export class BatchRelayError extends BaseError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BatchRelayError', message, details);
  }

  static invalidBatchSize(expected: number, actual: number): BatchRelayError {
    return new BatchRelayError(
      `Batch size mismatch: expected ${expected}, got ${actual}`,
      { expected, actual }
    );
  }

  static invalidProcessooor(expected: string, actual: string): BatchRelayError {
    return new BatchRelayError(
      `Invalid processooor address: expected ${expected}, got ${actual}`,
      { expected, actual }
    );
  }

  static contextMismatch(proofIndex: number): BatchRelayError {
    return new BatchRelayError(
      `Proof at index ${proofIndex} has different withdrawal context`,
      { proofIndex }
    );
  }

  static feeTooHigh(fee: bigint, max: bigint): BatchRelayError {
    return new BatchRelayError(
      `Relay fee ${fee} exceeds maximum ${max}`,
      { fee: fee.toString(), max: max.toString() }
    );
  }

  static emptyBatch(): BatchRelayError {
    return new BatchRelayError('Cannot create batch withdrawal with no notes');
  }

  static batchTooLarge(size: number): BatchRelayError {
    return new BatchRelayError(
      `Batch size ${size} exceeds maximum of 255`,
      { size }
    );
  }
}