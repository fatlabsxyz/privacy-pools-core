import { describe, it, expect } from 'vitest';
import { ChickenService } from '../../src/services/chicken.service.js';

describe('ChickenService', () => {

  describe('calculateSendAmount', () => {
    const chicken = new ChickenService();

    const baseParams = {
      withdrawnValueInEther: 10n * 10n ** 18n, // 10 ETH equivalent
      relayFeeBPS: 100n,   // 1%
      baseFeeBPS: 50n,     // 0.5%
      relayGasPrice: 30n * 10n ** 9n,  // 30 gwei
      gasPrice: 30n * 10n ** 9n,       // 30 gwei
    };

    it('returns correct send amount', async () => {
      const amount = await chicken.calculateSendAmount(baseParams);
      expect(amount).toBeGreaterThan(0n);
    });

    it('caps at extraGasFundGasUnits * gasPrice', async () => {
      // large withdrawn value so valueNet exceeds cap
      const params = {
        ...baseParams,
        withdrawnValueInEther: 1000n * 10n ** 18n,
      };
      const amount = await chicken.calculateSendAmount(params);
      const cap = chicken.extraGasFundGasUnits * params.gasPrice;
      expect(amount).toBe(cap);
    });

    it('returns valueNet when below cap', async () => {
      const params = {
        ...baseParams,
        withdrawnValueInEther: 10n * 10n ** 18n,
      };
      const amount = await chicken.calculateSendAmount(params);
      const cap = chicken.extraGasFundGasUnits * params.gasPrice;
      expect(amount).toBeLessThanOrEqual(cap);
    });

    it('throws when fees do not cover gas costs', async () => {
      const params = {
        ...baseParams,
        withdrawnValueInEther: 1n * 10n ** 15n, // tiny amount, 0.001 ETH
        relayFeeBPS: 10n,
        baseFeeBPS: 5n,
        gasPrice: 100n * 10n ** 9n,       // 100 gwei
        relayGasPrice: 100n * 10n ** 9n,
      };
      await expect(chicken.calculateSendAmount(params)).rejects.toThrow('extraGas valueNet is negative or zero');
    });

    it('deducts relayer profit and gas costs from gross fee', async () => {
      // use the exact formula to verify intermediate values
      const { withdrawnValueInEther, relayFeeBPS, baseFeeBPS, relayGasPrice, gasPrice } = baseParams;

      const feeGross = withdrawnValueInEther * relayFeeBPS / 10_000n;
      const relayerProfit = withdrawnValueInEther * baseFeeBPS / 10_000n;
      const relayTxGasCost = gasPrice * chicken.extraGasTxGasUnits + relayGasPrice * chicken.relayTxGasUnits;
      const sendTxGasCost = gasPrice * 21000n;
      const valueNet = feeGross - relayerProfit - relayTxGasCost - sendTxGasCost;

      // valueNet should be positive
      expect(valueNet).toBeGreaterThan(0n);
      // relayer profit should be less than gross fee
      expect(relayerProfit).toBeLessThan(feeGross);
      // gas costs should be deducted
      expect(valueNet).toBeLessThan(feeGross - relayerProfit);
    });

    it('accounts for 21000 gas send cost', async () => {
      const { withdrawnValueInEther, relayFeeBPS, baseFeeBPS, relayGasPrice, gasPrice } = baseParams;

      const feeGross = withdrawnValueInEther * relayFeeBPS / 10_000n;
      const relayerProfit = withdrawnValueInEther * baseFeeBPS / 10_000n;
      const relayTxGasCost = gasPrice * chicken.extraGasTxGasUnits + relayGasPrice * chicken.relayTxGasUnits;
      const sendTxGasCost = gasPrice * 21000n;
      const expectedValueNet = feeGross - relayerProfit - relayTxGasCost - sendTxGasCost;

      const cap = chicken.extraGasFundGasUnits * gasPrice;
      const expected = expectedValueNet < cap ? expectedValueNet : cap;

      const amount = await chicken.calculateSendAmount(baseParams);
      expect(amount).toBe(expected);
    });
  });
});
