import { encodeAbiParameters, decodeAbiParameters, type Address, type Hex } from "viem";

/**
 * Interface for batch relay data
 */
export interface BatchRelayData {
  recipient: Address;
  feeRecipient: Address;
  relayFeeBPS: bigint;
  batchSize: number;
}

/**
 * Encodes batch relay data for use in withdrawal.data field
 * @param data Batch relay data containing recipient, fee recipient, relay fee BPS, and batch size
 * @returns Encoded hex string
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
 * Decodes batch relay data from hex string
 * @param encodedData Hex string containing encoded batch relay data
 * @returns Decoded batch relay data
 */
export function decodeBatchRelayData(encodedData: Hex | string): BatchRelayData {
  const decoded = decodeAbiParameters(
    [
      { name: 'recipient', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'relayFeeBPS', type: 'uint256' },
      { name: 'batchSize', type: 'uint8' }
    ],
    encodedData as Hex
  );
  
  return {
    recipient: decoded[0] as Address,
    feeRecipient: decoded[1] as Address,
    relayFeeBPS: decoded[2] as bigint,
    batchSize: Number(decoded[3])
  };
}

/**
 * Calculates the fee and amount after fees for a batch withdrawal
 * @param totalAmount Total amount being withdrawn
 * @param relayFeeBPS Relay fee in basis points (1 BPS = 0.01%)
 * @returns Object containing fee and amount after fees
 */
export function calculateBatchFees(totalAmount: bigint, relayFeeBPS: bigint): {
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

/**
 * Validates batch relay data
 * @param data Batch relay data to validate
 * @throws Error if validation fails
 */
export function validateBatchRelayData(data: BatchRelayData): void {
  if (data.relayFeeBPS > 10000n) {
    throw new Error(`Relay fee BPS ${data.relayFeeBPS} exceeds maximum (10000)`);
  }
  
  if (data.batchSize < 1 || data.batchSize > 255) {
    throw new Error(`Batch size ${data.batchSize} must be between 1 and 255`);
  }
  
  if (!data.recipient || data.recipient === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid recipient address');
  }
  
  if (!data.feeRecipient || data.feeRecipient === '0x0000000000000000000000000000000000000000') {
    throw new Error('Invalid fee recipient address');
  }
}