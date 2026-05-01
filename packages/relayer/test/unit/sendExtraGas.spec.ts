import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock variables so vi.mock factories can reference them
const {
  mockClient,
  mockWeb3Provider,
  mockSdkProvider,
  mockAssetConfig,
  mockChainConfig,
  mockCalculateSendAmount,
  mockQuoteNativeTokenInERC20,
} = vi.hoisted(() => {
  const mockClient = {
    waitForTransactionReceipt: vi.fn(),
  };

  const mockWeb3Provider = {
    client: vi.fn().mockResolvedValue(mockClient),
    getGasPrice: vi.fn(),
    sendExtraGasTransaction: vi.fn(),
    signer: vi.fn(),
    signRelayerCommitment: vi.fn(),
    verifyRelayerCommitment: vi.fn(),
  };

  const mockSdkProvider = {
    scopeData: vi.fn(),
    verifyWithdrawal: vi.fn(),
    broadcastWithdrawal: vi.fn(),
    calculateContext: vi.fn(),
  };

  const mockAssetConfig = {
    fee_bps: 50n,
    min_withdraw_amount: 100n,
    extra_gas: true,
  };

  const mockChainConfig = {
    assetConfig: vi.fn().mockResolvedValue(mockAssetConfig),
    entrypointAddress: vi.fn(),
    feeReceiverAddress: vi.fn(),
    signerPrivateKey: vi.fn(),
    isFeeReceiverSameAsSigner: vi.fn(),
  };

  const mockCalculateSendAmount = vi.fn();
  const mockQuoteNativeTokenInERC20 = vi.fn();

  return {
    mockClient,
    mockWeb3Provider,
    mockSdkProvider,
    mockAssetConfig,
    mockChainConfig,
    mockCalculateSendAmount,
    mockQuoteNativeTokenInERC20,
  };
});

vi.mock('../../src/providers/index.js', () => ({
  db: {
    createNewRequest: vi.fn(),
    updateBroadcastedRequest: vi.fn(),
    updateFailedRequest: vi.fn(),
  },
  SdkProvider: vi.fn(() => mockSdkProvider),
  UniswapProvider: vi.fn(),
  web3Provider: mockWeb3Provider,
  uniswapProvider: {},
}));

vi.mock('../../src/logger/index.js', () => ({
  createModuleLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../../src/config/index.js', () => ({
  RelayerConfig: vi.fn(() => ({
    chain: vi.fn(() => mockChainConfig),
  })),
}));

vi.mock('../../src/services/chicken.service.js', () => ({
  ChickenService: vi.fn(() => ({
    calculateSendAmount: mockCalculateSendAmount,
  })),
}));

vi.mock('../../src/providers/quote.provider.js', () => ({
  QuoteProvider: vi.fn(() => ({
    quoteNativeTokenInERC20: mockQuoteNativeTokenInERC20,
  })),
}));

vi.mock('../../src/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils.js')>();
  return {
    ...actual,
    decodeWithdrawalData: vi.fn(),
    parseSignals: vi.fn(),
    isNative: vi.fn(),
  };
});

// Mock services/index.js fully to break circular dep
// (services/index.js does `new PrivacyPoolRelayer()` at module level)
vi.mock('../../src/services/index.js', () => ({
  quoteService: { quote: vi.fn() },
  privacyPoolRelayer: {},
  PrivacyPoolRelayer: vi.fn(),
}));

import { PrivacyPoolRelayer } from '../../src/services/privacyPoolRelayer.service.js';
import { decodeWithdrawalData, parseSignals, isNative } from '../../src/utils.js';
import type { Withdrawal, WithdrawalProof } from '@0xbow/privacy-pools-core-sdk';

const CHAIN_ID = 1 as any;
const ASSET_ADDRESS = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const RECIPIENT = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const RELAY_TX_HASH = '0xabc123' as `0x${string}`;
const SEND_TX_HASH = '0xdef456' as `0x${string}`;

const WITHDRAWAL: Withdrawal = {
  processooor: '0x0000000000000000000000000000000000000000',
  data: '0xdeadbeef' as `0x${string}`,
};

const PROOF: WithdrawalProof = {
  pi_a: ['0', '0'],
  pi_b: [['0', '0'], ['0', '0']],
  pi_c: ['0', '0'],
  publicSignals: ['0', '0', '1000000000000000000', '0', '0', '0', '0', '0'],
  protocol: 'groth16',
  curve: 'bn128',
} as any;

const SCOPE = 12345n;

function setupHappyPath() {
  mockSdkProvider.scopeData.mockResolvedValue({ assetAddress: ASSET_ADDRESS });

  (isNative as any).mockReturnValue(false);

  mockClient.waitForTransactionReceipt.mockResolvedValue({
    effectiveGasPrice: 30_000_000_000n, // 30 gwei
  });

  mockChainConfig.assetConfig.mockResolvedValue(mockAssetConfig);

  (decodeWithdrawalData as any).mockReturnValue({
    recipient: RECIPIENT,
    feeRecipient: '0x0000000000000000000000000000000000000000',
    relayFeeBPS: 500n,
  });

  (parseSignals as any).mockReturnValue({
    withdrawnValue: 1_000_000_000_000_000_000n,
  });

  mockWeb3Provider.getGasPrice.mockResolvedValue(30_000_000_000n);

  mockQuoteNativeTokenInERC20.mockResolvedValue({
    num: 1_000_000_000_000_000_000n, // 1 ETH equivalent
    den: 1_000_000_000_000_000_000n,
    path: [],
  });

  mockCalculateSendAmount.mockResolvedValue(10_000_000_000_000_000n); // 0.01 ETH

  mockWeb3Provider.sendExtraGasTransaction.mockResolvedValue(SEND_TX_HASH);
}

describe('PrivacyPoolRelayer.sendExtraGas', () => {
  let relayer: PrivacyPoolRelayer;

  beforeEach(() => {
    vi.clearAllMocks();
    relayer = new PrivacyPoolRelayer();
    setupHappyPath();
  });

  it('sends correct amount to recipient on happy path', async () => {
    const txHash = await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(txHash).toBe(SEND_TX_HASH);
    expect(mockWeb3Provider.sendExtraGasTransaction).toHaveBeenCalledWith(
      CHAIN_ID,
      RECIPIENT,
      10_000_000_000_000_000n,
    );
  });

  it('returns early for native asset without sending', async () => {
    (isNative as any).mockReturnValue(true);

    const result = await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(result).toBeUndefined();
    expect(mockWeb3Provider.sendExtraGasTransaction).not.toHaveBeenCalled();
  });

  it('waits for relay receipt to get effective gas price', async () => {
    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockClient.waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: RELAY_TX_HASH,
    });
  });

  it('passes relay gas price from receipt to calculateSendAmount', async () => {
    const relayGasPrice = 50_000_000_000n;
    mockClient.waitForTransactionReceipt.mockResolvedValue({
      effectiveGasPrice: relayGasPrice,
    });

    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockCalculateSendAmount).toHaveBeenCalledWith(
      expect.objectContaining({ relayGasPrice }),
    );
  });

  it('passes current gas price (not relay gas price) to calculateSendAmount', async () => {
    const currentGasPrice = 25_000_000_000n;
    mockWeb3Provider.getGasPrice.mockResolvedValue(currentGasPrice);
    mockClient.waitForTransactionReceipt.mockResolvedValue({
      effectiveGasPrice: 50_000_000_000n,
    });

    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockCalculateSendAmount).toHaveBeenCalledWith(
      expect.objectContaining({ gasPrice: currentGasPrice }),
    );
  });

  it('uses quote num as withdrawnValueInEther', async () => {
    const quoteNum = 500_000_000_000_000_000n; // 0.5 ETH
    mockQuoteNativeTokenInERC20.mockResolvedValue({
      num: quoteNum,
      den: 1_000_000_000_000_000_000n,
      path: [],
    });

    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockCalculateSendAmount).toHaveBeenCalledWith(
      expect.objectContaining({ withdrawnValueInEther: quoteNum }),
    );
  });

  it('uses asset fee_bps as baseFeeBPS', async () => {
    const customAssetConfig = { ...mockAssetConfig, fee_bps: 75n };
    mockChainConfig.assetConfig.mockResolvedValue(customAssetConfig);

    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockCalculateSendAmount).toHaveBeenCalledWith(
      expect.objectContaining({ baseFeeBPS: 75n }),
    );
  });

  it('uses relayFeeBPS decoded from withdrawal data', async () => {
    (decodeWithdrawalData as any).mockReturnValue({
      recipient: RECIPIENT,
      feeRecipient: '0x0000000000000000000000000000000000000000',
      relayFeeBPS: 800n,
    });

    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockCalculateSendAmount).toHaveBeenCalledWith(
      expect.objectContaining({ relayFeeBPS: 800n }),
    );
  });

  it('quotes with correct token address and withdrawn value from proof', async () => {
    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockQuoteNativeTokenInERC20).toHaveBeenCalledWith(
      CHAIN_ID,
      ASSET_ADDRESS,
      1_000_000_000_000_000_000n, // withdrawnValue from parseSignals
    );
  });

  it('propagates error when quote provider fails', async () => {
    mockQuoteNativeTokenInERC20.mockRejectedValue(new Error('quote failed'));

    await expect(
      relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH),
    ).rejects.toThrow('quote failed');
  });

  it('propagates error when calculateSendAmount throws (negative valueNet)', async () => {
    mockCalculateSendAmount.mockRejectedValue(
      new Error('extraGas valueNet is negative or zero'),
    );

    await expect(
      relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH),
    ).rejects.toThrow('extraGas valueNet is negative or zero');
  });

  it('propagates error when sendExtraGasTransaction fails', async () => {
    mockWeb3Provider.sendExtraGasTransaction.mockRejectedValue(
      new Error('insufficient funds'),
    );

    await expect(
      relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH),
    ).rejects.toThrow('insufficient funds');
  });

  it('propagates error when waitForTransactionReceipt fails', async () => {
    mockClient.waitForTransactionReceipt.mockRejectedValue(
      new Error('receipt timeout'),
    );

    await expect(
      relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH),
    ).rejects.toThrow('receipt timeout');
  });

  it('resolves scope data with correct scope and chainId', async () => {
    await relayer.sendExtraGas(SCOPE, WITHDRAWAL, PROOF, CHAIN_ID, RELAY_TX_HASH);

    expect(mockSdkProvider.scopeData).toHaveBeenCalledWith(SCOPE, CHAIN_ID);
  });
});
