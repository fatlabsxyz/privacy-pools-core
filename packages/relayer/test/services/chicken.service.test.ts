import { describe, it, expect, beforeEach } from 'vitest';
import { ChickenService } from '../../src/services/chicken.service.js';

describe('ChickenService', () => {
  let chickenService: ChickenService;

  const baseFeeBPS = 10n; // 0.1% fee

  beforeEach(() => {
    chickenService = new ChickenService();
  });

  describe('gas unit constants', () => {

    it('should calculate extraGasTotalGasUnits correctly', () => {
      expect(chickenService.extraGasTotalGasUnits).toBe(
        chickenService.extraGasTxGasUnits + chickenService.extraGasFundGasUnits
      );
    });
  });

  describe('getFeeBPS', () => {
    const balance = 1_000_000_000_000_000_000n; // 1 ETH
    const gasPrice = 30_000_000_000n; // 30 gwei

    it('should calculate fee without extra gas', async () => {
      const nativeQuote = { num: 1n, den: 1n };
      const extraGas = false;

      const feeBPS = await chickenService.getFeeBPS(baseFeeBPS, balance, nativeQuote, gasPrice, extraGas);

      // feeBPS = baseFee + (den * 10_000 * gasPrice * relayTxGasUnits) / balance / num
      // feeBPS = 10 + (1 * 10_000 * 30_000_000_000 * 650_000) / 1_000_000_000_000_000_000 / 1
      // feeBPS = 10 + 195_000_000_000_000_000_000 / 1_000_000_000_000_000_000
      // feeBPS = 10 + 195 = 205
      expect(feeBPS).toBe(205n);
    });

    it('should calculate fee with extra gas', async () => {
      const nativeQuote = { num: 1n, den: 1n };
      const extraGas = true;

      const feeBPS = await chickenService.getFeeBPS(baseFeeBPS, balance, nativeQuote, gasPrice, extraGas);

      // totalGasUnits = relayTxGasUnits + extraGasTotalGasUnits = 650_000 + 1_320_000 = 1_970_000
      // feeBPS = 10 + (1 * 10_000 * 30_000_000_000 * 1_970_000) / 1_000_000_000_000_000_000 / 1
      // feeBPS = 10 + 591_000_000_000_000_000_000 / 1_000_000_000_000_000_000
      // feeBPS = 10 + 591 = 601
      expect(feeBPS).toBe(601n);
    });

    it('should adjust fee based on native quote ratio', async () => {
      // Quote where 1 token = 2 ETH (num=2, den=1)
      const nativeQuote = { num: 2n, den: 1n };
      const extraGas = false;

      const feeBPS = await chickenService.getFeeBPS(baseFeeBPS, balance, nativeQuote, gasPrice, extraGas);

      // feeBPS = 10 + (1 * 10_000 * 30_000_000_000 * 650_000) / 1_000_000_000_000_000_000 / 2
      // feeBPS = 10 + 97 = 107 (due to integer division)
      expect(feeBPS).toBe(107n);
    });

    it('should increase fee for tokens worth less than ETH', async () => {
      // Quote where 2 tokens = 1 ETH (num=1, den=2)
      const nativeQuote = { num: 1n, den: 2n };
      const extraGas = false;

      const feeBPS = await chickenService.getFeeBPS(baseFeeBPS, balance, nativeQuote, gasPrice, extraGas);

      // feeBPS = 10 + (2 * 10_000 * 30_000_000_000 * 650_000) / 1_000_000_000_000_000_000 / 1
      // feeBPS = 10 + 390 = 400
      expect(feeBPS).toBe(400n);
    });

    it('should scale with balance size', async () => {
      const nativeQuote = { num: 1n, den: 1n };
      const extraGas = false;
      const smallerBalance = 100_000_000_000_000_000n; // 0.1 ETH

      const feeBPS = await chickenService.getFeeBPS(baseFeeBPS, smallerBalance, nativeQuote, gasPrice, extraGas);

      // With 10x smaller balance, gas cost portion should be 10x larger
      // feeBPS = 10 + (1 * 10_000 * 30_000_000_000 * 650_000) / 100_000_000_000_000_000 / 1
      // feeBPS = 10 + 1950 = 1960
      expect(feeBPS).toBe(1960n);
    });
  });

  describe('calculateSendAmount', () => {
    it('should calculate send amount correctly', async () => {
      const params = {
        withdrawnValueInEther: 1_000_000_000_000_000_000n, // 1 ETH
        relayFeeBPS: 500n, // 5%
        baseFeeBPS: 100n, // 1%
        relayGasPrice: 30_000_000_000n, // 30 gwei
        gasPrice: 30_000_000_000n, // 30 gwei
      };

      const amount = await chickenService.calculateSendAmount(params);

      // feeGross = 1 ETH * 500 / 10_000 = 0.05 ETH = 50_000_000_000_000_000
      // relayerProfit = 1 ETH * 100 / 10_000 = 0.01 ETH = 10_000_000_000_000_000
      // relayTxGasCost = 30 gwei * 320_000 + 30 gwei * 650_000 = 9_600_000_000_000_000 + 19_500_000_000_000_000 = 29_100_000_000_000_000
      // sendTxCost = 30 gwei * 21_000 = 630_000_000_000_000
      // valueNet = 50_000_000_000_000_000 - 10_000_000_000_000_000 - 29_100_000_000_000_000 - 630_000_000_000_000
      // valueNet = 10_270_000_000_000_000
      // extraGasFundCap = 1_000_000 * 30 gwei = 30_000_000_000_000_000
      // amountToSend = min(30_000_000_000_000_000, 10_270_000_000_000_000) = 10_270_000_000_000_000
      expect(amount).toBe(10_270_000_000_000_000n);
    });

    it('should throw when gas costs exceed fee (negative valueNet)', async () => {
      const params = {
        withdrawnValueInEther: 10_000_000_000_000n, // 0.00001 ETH (very small)
        relayFeeBPS: 500n,
        baseFeeBPS: 100n,
        relayGasPrice: 1_000_000_000n, // 1 gwei
        gasPrice: 1_000_000_000n, // 1 gwei
      };

      // feeGross = 500_000_000_000, costs = 991_000_000_000 → valueNet negative
      await expect(chickenService.calculateSendAmount(params)).rejects.toThrow('extraGas valueNet is negative or zero');
    });

    it('should throw when all fees and gas are zero (valueNet = 0)', async () => {
      const params = {
        withdrawnValueInEther: 1_000_000_000_000_000_000n,
        relayFeeBPS: 0n,
        baseFeeBPS: 0n,
        relayGasPrice: 0n,
        gasPrice: 0n,
      };

      // valueNet = 0 → throws
      await expect(chickenService.calculateSendAmount(params)).rejects.toThrow('extraGas valueNet is negative or zero');
    });

    it('should cap at extraGasFundGasUnits * gasPrice', async () => {
      const params = {
        withdrawnValueInEther: 1_000_000_000_000_000_000n,
        relayFeeBPS: 1000n, // 10%
        baseFeeBPS, // 0.1%
        relayGasPrice: 50_000_000_000n, // 50 gwei (higher relay gas)
        gasPrice: 20_000_000_000n, // 20 gwei (lower current gas)
      };

      const amount = await chickenService.calculateSendAmount(params);

      // extraGasFundCap = 1_000_000 * 20 gwei = 20_000_000_000_000_000
      // valueNet is much larger, so it should hit the cap
      expect(amount).toBe(chickenService.extraGasFundGasUnits * params.gasPrice);
    });

    it('should handle different relay and current gas prices', async () => {
      const params = {
        withdrawnValueInEther: 1_000_000_000_000_000_000n,
        relayFeeBPS: 1000n, // 10%
        baseFeeBPS, // 0.1%
        relayGasPrice: 50_000_000_000n, // 50 gwei (higher relay gas)
        gasPrice: 20_000_000_000n, // 20 gwei (lower current gas)
      };

      const amount = await chickenService.calculateSendAmount(params);

      // feeGross = 1 ETH * 1000 / 10_000 = 0.1 ETH = 100_000_000_000_000_000
      // relayerProfit = 1 ETH * 10 / 10_000 = 0.001 ETH = 1_000_000_000_000_000
      // relayTxGasCost = 20 gwei * 320_000 + 50 gwei * 650_000
      //                = 6_400_000_000_000_000 + 32_500_000_000_000_000 = 38_900_000_000_000_000
      // sendTxCost = 20 gwei * 21_000 = 420_000_000_000_000
      // valueNet = 100_000_000_000_000_000 - 1_000_000_000_000_000 - 38_900_000_000_000_000 - 420_000_000_000_000
      // valueNet = 59_680_000_000_000_000
      // extraGasFundCap = 1_000_000 * 20 gwei = 20_000_000_000_000_000
      // amountToSend = min(20_000_000_000_000_000, 59_680_000_000_000_000) = 20_000_000_000_000_000 (capped)
      expect(amount).toBe(chickenService.extraGasFundGasUnits * params.gasPrice);
    });
  });

  describe('relayer profitability with extraGas', () => {

    // Simulates the full flow: quote → relay → send.
    // The relayer receives feeGross in ETH-equivalent, pays gas + amountToSend.
    // Net must always be >= relayerProfit (baseFeeBPS portion).
    async function simulateRelay(params: {
      withdrawnValueInEther: bigint,
      gasPrice: bigint,
      relayGasPrice: bigint,
      nativeQuote: { num: bigint, den: bigint },
    }) {
      const { withdrawnValueInEther, gasPrice, relayGasPrice, nativeQuote } = params;

      // 1. Quote: get the feeBPS the relayer would charge
      const feeBPS = await chickenService.getFeeBPS(baseFeeBPS, withdrawnValueInEther, nativeQuote, gasPrice, true);

      // 2. Calculate what the relayer sends to the user
      const amountToSend = await chickenService.calculateSendAmount({
        withdrawnValueInEther,
        relayFeeBPS: feeBPS,
        baseFeeBPS,
        relayGasPrice,
        gasPrice,
      });

      // 3. Compute relayer's balance sheet (all in wei)
      const feeGross = withdrawnValueInEther * feeBPS / 10_000n;
      const relayerProfit = withdrawnValueInEther * baseFeeBPS / 10_000n;
      const relayTxGasCost = gasPrice * chickenService.extraGasTxGasUnits + relayGasPrice * chickenService.relayTxGasUnits;
      const sendTxGasCost = gasPrice * 21_000n;

      const relayerNet = feeGross - relayTxGasCost - sendTxGasCost - amountToSend;

      return { feeBPS, amountToSend, feeGross, relayerProfit, relayerNet, relayTxGasCost, sendTxGasCost };
    }

    it('relayer retains at least baseFeeBPS profit — 1 ETH at 30 gwei', async () => {
      const result = await simulateRelay({
        withdrawnValueInEther: 1_000_000_000_000_000_000n, // 1 ETH
        gasPrice: 30_000_000_000n,
        relayGasPrice: 30_000_000_000n,
        nativeQuote: { num: 1n, den: 1n },
      });

      expect(result.relayerNet).toBeGreaterThanOrEqual(result.relayerProfit);
      expect(result.amountToSend).toBeGreaterThan(0n);
    });

    it('relayer retains at least baseFeeBPS profit — 10 ETH at 100 gwei', async () => {
      const result = await simulateRelay({
        withdrawnValueInEther: 10_000_000_000_000_000_000n, // 10 ETH
        gasPrice: 100_000_000_000n,
        relayGasPrice: 100_000_000_000n,
        nativeQuote: { num: 1n, den: 1n },
      });

      expect(result.relayerNet).toBeGreaterThanOrEqual(result.relayerProfit);
      expect(result.amountToSend).toBeGreaterThan(0n);
    });

    it('relayer retains at least baseFeeBPS profit — ERC20 token (1 token = 0.5 ETH)', async () => {
      const result = await simulateRelay({
        withdrawnValueInEther: 500_000_000_000_000_000n, // 0.5 ETH equivalent
        gasPrice: 20_000_000_000n,
        relayGasPrice: 20_000_000_000n,
        nativeQuote: { num: 1n, den: 2n }, // 2 tokens per 1 ETH
      });

      expect(result.relayerNet).toBeGreaterThanOrEqual(result.relayerProfit);
      expect(result.amountToSend).toBeGreaterThan(0n);
    });

    it('relayer retains at least baseFeeBPS profit — gas spike between quote and relay', async () => {
      const result = await simulateRelay({
        withdrawnValueInEther: 1_000_000_000_000_000_000n,
        gasPrice: 30_000_000_000n, // 30 gwei at send time
        relayGasPrice: 50_000_000_000n, // 50 gwei at relay time (spiked)
        nativeQuote: { num: 1n, den: 1n },
      });

      expect(result.relayerNet).toBeGreaterThanOrEqual(result.relayerProfit);
      expect(result.amountToSend).toBeGreaterThan(0n);
    });

    it('relayer profits more without extraGas than with it', async () => {
      const gasPrice = 30_000_000_000n;
      const withdrawnValueInEther = 1_000_000_000_000_000_000n;
      const nativeQuote = { num: 1n, den: 1n };

      const feeBPSWithExtra = await chickenService.getFeeBPS(baseFeeBPS, withdrawnValueInEther, nativeQuote, gasPrice, true);
      const feeBPSWithout = await chickenService.getFeeBPS(baseFeeBPS, withdrawnValueInEther, nativeQuote, gasPrice, false);

      // extraGas charges more BPS
      expect(feeBPSWithExtra).toBeGreaterThan(feeBPSWithout);

      // without extraGas: relayer keeps the full fee minus relay gas
      const feeGrossWithout = withdrawnValueInEther * feeBPSWithout / 10_000n;
      const relayGasCostOnly = gasPrice * chickenService.relayTxGasUnits;
      const netWithout = feeGrossWithout - relayGasCostOnly;

      // with extraGas: relayer keeps fee minus all gas minus amount sent
      const result = await simulateRelay({
        withdrawnValueInEther,
        gasPrice,
        relayGasPrice: gasPrice,
        nativeQuote,
      });

      // both should be profitable
      expect(netWithout).toBeGreaterThan(0n);
      expect(result.relayerNet).toBeGreaterThan(0n);
    });

    it('user receives meaningful ETH with extraGas', async () => {
      const result = await simulateRelay({
        withdrawnValueInEther: 1_000_000_000_000_000_000n, // 1 ETH
        gasPrice: 30_000_000_000n,
        relayGasPrice: 30_000_000_000n,
        nativeQuote: { num: 1n, den: 1n },
      });

      // User should receive at least 0.001 ETH (enough for a few txs)
      expect(result.amountToSend).toBeGreaterThan(1_000_000_000_000_000n);
    });
  });
});
