import dotenv from 'dotenv';
dotenv.config();

import { ApexDefiConstantProductPool } from './apex-defi-constant-product-pool';
import { ApexDefiPoolOrderedParams } from './types';

describe('ApexDefi Constant Product Pool', () => {
  describe('getSellPrice', () => {
    it('should calculate correct output for sell operation', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000', // 1000 AVAX
        reservesOut: '2000000000000000000000', // 2000 tokens
        fee: '300', // 3% fee
      };

      const srcAmount = BigInt('100000000000000000000'); // 100 AVAX
      const feeFactor = 10000;

      const result = ApexDefiConstantProductPool.getSellPrice(
        priceParams,
        srcAmount,
        feeFactor,
      );

      // Expected calculation:
      // amountInWithFee = 100 * (10000 - 300) / 10000 = 97 AVAX
      // amountOut = (2000 * 97) / (1000 + 97) = 194000 / 1097 ≈ 176.84 tokens
      expect(result).toBeGreaterThan(BigInt('176000000000000000000'));
      expect(result).toBeLessThan(BigInt('178000000000000000000'));
    });

    it('should return 0 for zero input', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000',
        reservesOut: '2000000000000000000000',
        fee: '300',
      };

      const result = ApexDefiConstantProductPool.getSellPrice(
        priceParams,
        0n,
        10000,
      );

      expect(result).toBe(0n);
    });

    it('should handle small amounts correctly', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000',
        reservesOut: '2000000000000000000000',
        fee: '300',
      };

      const srcAmount = BigInt('1000000000000000'); // 0.001 AVAX
      const result = ApexDefiConstantProductPool.getSellPrice(
        priceParams,
        srcAmount,
        10000,
      );

      expect(result).toBeGreaterThan(0n);
    });
  });

  describe('getBuyPrice', () => {
    it('should calculate correct input for buy operation', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000', // 1000 AVAX
        reservesOut: '2000000000000000000000', // 2000 tokens
        fee: '300', // 3% fee
      };

      const destAmount = BigInt('100000000000000000000'); // 100 tokens
      const feeFactor = 10000;

      const result = ApexDefiConstantProductPool.getBuyPrice(
        priceParams,
        destAmount,
        feeFactor,
      );

      // Should require more than 50 AVAX due to slippage and fees
      expect(result).toBeGreaterThan(BigInt('50000000000000000000'));
      expect(result).toBeLessThan(BigInt('60000000000000000000'));
    });

    it('should return 0 when requested amount exceeds available reserves', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000',
        reservesOut: '2000000000000000000000',
        fee: '300',
      };

      const destAmount = BigInt('3000000000000000000000'); // More than available

      const result = ApexDefiConstantProductPool.getBuyPrice(
        priceParams,
        destAmount,
        10000,
      );

      expect(result).toBe(0n);
    });
  });

  describe('getPriceImpact', () => {
    it('should calculate price impact correctly', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000',
        reservesOut: '2000000000000000000000',
        fee: '300',
      };

      const srcAmount = BigInt('100000000000000000000'); // 10% of reserves
      const priceImpact = ApexDefiConstantProductPool.getPriceImpact(
        priceParams,
        srcAmount,
        10000,
      );

      // Should have some price impact but not too high
      expect(priceImpact).toBeGreaterThan(0);
      expect(priceImpact).toBeLessThan(15); // Less than 15% impact
    });

    it('should return 0 price impact for zero amount', () => {
      const priceParams: ApexDefiPoolOrderedParams = {
        reservesIn: '1000000000000000000000',
        reservesOut: '2000000000000000000000',
        fee: '300',
      };

      const priceImpact = ApexDefiConstantProductPool.getPriceImpact(
        priceParams,
        0n,
        10000,
      );

      expect(priceImpact).toBe(0);
    });
  });
});
