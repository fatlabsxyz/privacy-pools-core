import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAccount, mockChain, mockSendTransaction } = vi.hoisted(() => {
  const mockAccount = { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' };
  const mockChain = { id: 1, name: 'mainnet' };
  const mockSendTransaction = vi.fn();
  return { mockAccount, mockChain, mockSendTransaction };
});

vi.mock('../../src/config/index.js', () => ({
  RelayerConfig: vi.fn(() => ({
    chain: vi.fn(() => ({
      signerPrivateKey: vi.fn().mockResolvedValue('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'),
    })),
  })),
}));

vi.mock('../../src/utils.js', () => ({
  createChainObjectFromBrandedChainId: vi.fn().mockResolvedValue({
    id: 1,
    name: 'mainnet',
    rpcUrls: { default: { http: ['http://localhost:8545'] } },
  }),
}));

vi.mock('../../src/logger/index.js', () => ({
  createModuleLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: vi.fn(),
    createWalletClient: vi.fn(() => ({
      account: mockAccount,
      chain: mockChain,
      sendTransaction: mockSendTransaction,
    })),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => mockAccount),
}));

import { Web3Provider } from '../../src/providers/web3.provider.js';
import { createWalletClient } from 'viem';
import type { ChainId } from '../../src/types.js';

const CHAIN_ID = 1 as ChainId;
const RECIPIENT = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const SEND_AMOUNT = 10_000_000_000_000_000n; // 0.01 ETH
const TX_HASH = '0xabc123def456' as `0x${string}`;

describe('Web3Provider.sendExtraGasTransaction', () => {
  let provider: Web3Provider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new Web3Provider();
    mockSendTransaction.mockResolvedValue(TX_HASH);

    // Reset createWalletClient to return signer with account
    (createWalletClient as any).mockReturnValue({
      account: mockAccount,
      chain: mockChain,
      sendTransaction: mockSendTransaction,
    });
  });

  it('sends transaction with correct params', async () => {
    const hash = await provider.sendExtraGasTransaction(CHAIN_ID, RECIPIENT, SEND_AMOUNT);

    expect(hash).toBe(TX_HASH);
    expect(mockSendTransaction).toHaveBeenCalledWith({
      to: RECIPIENT,
      value: SEND_AMOUNT,
      account: mockAccount,
      chain: mockChain,
    });
  });

  it('returns transaction hash', async () => {
    const hash = await provider.sendExtraGasTransaction(CHAIN_ID, RECIPIENT, SEND_AMOUNT);
    expect(hash).toBe(TX_HASH);
  });

  it('throws when signer has no account', async () => {
    (createWalletClient as any).mockReturnValue({
      account: undefined,
      chain: mockChain,
      sendTransaction: mockSendTransaction,
    });

    await expect(
      provider.sendExtraGasTransaction(CHAIN_ID, RECIPIENT, SEND_AMOUNT),
    ).rejects.toThrow('Send error: Signer account not found');

    expect(mockSendTransaction).not.toHaveBeenCalled();
  });

  it('propagates sendTransaction error', async () => {
    mockSendTransaction.mockRejectedValue(new Error('nonce too low'));

    await expect(
      provider.sendExtraGasTransaction(CHAIN_ID, RECIPIENT, SEND_AMOUNT),
    ).rejects.toThrow('nonce too low');
  });

  it('sends zero value without error', async () => {
    // Edge case: calculateSendAmount shouldn't return 0, but provider shouldn't block it
    await provider.sendExtraGasTransaction(CHAIN_ID, RECIPIENT, 0n);

    expect(mockSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ value: 0n }),
    );
  });

  it('passes through large values correctly', async () => {
    const largeAmount = 100_000_000_000_000_000_000n; // 100 ETH
    await provider.sendExtraGasTransaction(CHAIN_ID, RECIPIENT, largeAmount);

    expect(mockSendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ value: largeAmount }),
    );
  });
});
