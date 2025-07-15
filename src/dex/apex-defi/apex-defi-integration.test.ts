import { ApexDefi } from './apex-defi';
import { Network, SwapSide } from '../../constants';
import { ApexDefiConstantProductPool } from './apex-defi-pool';
import { ApexDefiPoolOrderedParams } from './types';

const dexKey = 'ApexDefi';

describe('ApexDefi Unit Tests', function () {
  describe('ApexDefiConstantProductPool', () => {
    const mockPoolParams: ApexDefiPoolOrderedParams = {
      tokenIn: '0xA0b86a33E6441b7178bAE62C7E27c13C1CDD7545',
      tokenOut: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      reserveIn: '1000000000000000000000', // 1000 tokens with 18 decimals
      reserveOut: '1000000000', // 1000 tokens with 6 decimals (like USDT)
      fee: 300, // 0.3% fee
      decimalsIn: 18,
      decimalsOut: 6,
    };

    it('should calculate sell price correctly', () => {
      const inputAmount = BigInt('1000000000000000000'); // 1 token
      const feeFactor = 10000;

      const outputAmount = ApexDefiConstantProductPool.getSellPrice(
        mockPoolParams,
        inputAmount,
        feeFactor,
      );

      expect(outputAmount).toBeGreaterThan(0n);
      console.log(`Input: ${inputAmount}, Output: ${outputAmount}`);
    });

    it('should calculate buy price correctly', () => {
      const outputAmount = BigInt('1000000'); // 1 USDT (6 decimals)
      const feeFactor = 10000;

      const inputAmount = ApexDefiConstantProductPool.getBuyPrice(
        mockPoolParams,
        outputAmount,
        feeFactor,
      );

      expect(inputAmount).toBeGreaterThan(0n);
      console.log(
        `Desired output: ${outputAmount}, Required input: ${inputAmount}`,
      );
    });

    it('should return 0 for insufficient liquidity', () => {
      const largeOutputAmount = BigInt(mockPoolParams.reserveOut); // Try to withdraw all reserves
      const feeFactor = 10000;

      const inputAmount = ApexDefiConstantProductPool.getBuyPrice(
        mockPoolParams,
        largeOutputAmount,
        feeFactor,
      );

      expect(inputAmount).toBe(0n);
    });

    it('should return 0 for zero reserves', () => {
      const zeroReserveParams = {
        ...mockPoolParams,
        reserveIn: '0',
        reserveOut: '0',
      };

      const inputAmount = BigInt('1000000000000000000');
      const feeFactor = 10000;

      const outputAmount = ApexDefiConstantProductPool.getSellPrice(
        zeroReserveParams,
        inputAmount,
        feeFactor,
      );

      expect(outputAmount).toBe(0n);
    });
  });

  describe('ApexDefi Configuration', () => {
    it('should have valid configuration for supported networks', () => {
      // Test that static dexKeysWithNetwork is properly defined
      expect(ApexDefi.dexKeysWithNetwork).toBeDefined();
      expect(Array.isArray(ApexDefi.dexKeysWithNetwork)).toBe(true);

      if (ApexDefi.dexKeysWithNetwork.length > 0) {
        const firstConfig = ApexDefi.dexKeysWithNetwork[0];
        expect(firstConfig).toHaveProperty('key');
        expect(firstConfig).toHaveProperty('networks');
        expect(Array.isArray(firstConfig.networks)).toBe(true);
      }
    });
  });

  describe('Gas and Adapter Configuration', () => {
    // Mock minimal dependencies for testing basic functionality
    const mockDexHelper = {
      getLogger: () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      }),
      config: {
        data: {
          uniswapV2ExchangeRouterAddress:
            '0x0000000000000000000000000000000000000000',
        },
      },
      multiContract: {},
      web3Provider: {},
      cache: {},
      httpRequest: {},
    } as any;

    it('should return correct gas cost for calldata', () => {
      const apexDefi = new ApexDefi(Network.MAINNET, dexKey, mockDexHelper);

      const mockPoolPrices = {
        prices: [BigInt('1000000')],
        unit: BigInt('1000000'),
        data: {
          router: '0x0000000000000000000000000000000000000000',
          pools: [],
          feeFactor: 9970,
        },
        poolAddresses: ['0x0000000000000000000000000000000000000000'],
        exchange: dexKey,
        gasCost: 150000,
        poolIdentifier: 'test_pool',
      };

      const gasCost = apexDefi.getCalldataGasCost(mockPoolPrices);
      expect(typeof gasCost).toBe('number');
      expect(gasCost).toBeGreaterThan(0);
    });

    it('should return adapters for different swap sides', () => {
      const apexDefi = new ApexDefi(Network.MAINNET, dexKey, mockDexHelper);

      const sellAdapters = apexDefi.getAdapters(SwapSide.SELL);
      const buyAdapters = apexDefi.getAdapters(SwapSide.BUY);

      // Adapters can be null if not configured for the network
      if (sellAdapters) {
        expect(Array.isArray(sellAdapters)).toBe(true);
        if (sellAdapters.length > 0) {
          expect(sellAdapters[0]).toHaveProperty('name');
          expect(sellAdapters[0]).toHaveProperty('index');
        }
      }

      if (buyAdapters) {
        expect(Array.isArray(buyAdapters)).toBe(true);
        if (buyAdapters.length > 0) {
          expect(buyAdapters[0]).toHaveProperty('name');
          expect(buyAdapters[0]).toHaveProperty('index');
        }
      }
    });
  });
});
