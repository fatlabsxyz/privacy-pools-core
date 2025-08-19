import { encodeAbiParameters, decodeAbiParameters, type Hex, type Address } from 'viem';
import type { BatchRelayData } from '../types/withdrawal.js';

/**
 * Encodes BatchRelayData for use in withdrawal.data field
 * @param data - The BatchRelayData to encode
 * @returns Hex-encoded data
 */
export function encodeBatchRelayData(data: BatchRelayData): Hex {
  return encodeAbiParameters(
    [
      { name: 'recipient', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'relayFeeBPS', type: 'uint256' },
      { name: 'batchSize', type: 'uint8' }
    ],
    [
      data.recipient,
      data.feeRecipient,
      data.relayFeeBPS,
      data.batchSize
    ]
  );
}

/**
 * Decodes BatchRelayData from withdrawal.data field
 * @param data - Hex-encoded data to decode
 * @returns Decoded BatchRelayData
 */
export function decodeBatchRelayData(data: Hex): BatchRelayData {
  const decoded = decodeAbiParameters(
    [
      { name: 'recipient', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'relayFeeBPS', type: 'uint256' },
      { name: 'batchSize', type: 'uint8' }
    ],
    data
  );
  
  return {
    recipient: decoded[0] as Address,
    feeRecipient: decoded[1] as Address,
    relayFeeBPS: decoded[2] as bigint,
    batchSize: Number(decoded[3])
  };
}

/**
 * Validates BatchRelayData parameters
 * @param data - The BatchRelayData to validate
 * @throws Error if validation fails
 */
export function validateBatchRelayData(data: BatchRelayData): void {
  if (data.recipient === '0x0000000000000000000000000000000000000000') {
    throw new Error('BatchRelayData: recipient cannot be zero address');
  }
  
  if (data.feeRecipient === '0x0000000000000000000000000000000000000000') {
    throw new Error('BatchRelayData: feeRecipient cannot be zero address');
  }
  
  if (data.relayFeeBPS > 10000n) {
    throw new Error('BatchRelayData: relayFeeBPS cannot exceed 10000 (100%)');
  }
  
  if (data.batchSize === 0) {
    throw new Error('BatchRelayData: batchSize must be greater than 0');
  }
  
  if (data.batchSize > 255) {
    throw new Error('BatchRelayData: batchSize cannot exceed 255');
  }
}

/**
 * Calculates fee amounts for a batch withdrawal
 * @param totalAmount - Total amount being withdrawn
 * @param relayFeeBPS - Fee in basis points
 * @returns Object containing fee and amount after fees
 */
export function calculateBatchFees(
  totalAmount: bigint,
  relayFeeBPS: bigint
): {
  fee: bigint;
  amountAfterFees: bigint;
} {
  const fee = (totalAmount * relayFeeBPS) / 10000n;
  const amountAfterFees = totalAmount - fee;
  
  return {
    fee,
    amountAfterFees
  };
}