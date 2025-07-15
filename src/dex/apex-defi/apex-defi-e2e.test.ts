import dotenv from 'dotenv';
dotenv.config();

import { testE2E } from '../../../tests/utils-e2e';
import { Tokens, Holders } from '../../../tests/constants-e2e';
import { Network, ContractMethod, SwapSide } from '../../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { generateConfig } from '../../config';

/**
 * Integration tests for ApexDefi DEX
 * Tests the complete flow from pricing to transaction execution
 */
describe('ApexDefi E2E', () => {
  const dexKey = 'ApexDefi';
  const network = Network.AVALANCHE;
  const tokens = Tokens[network];
  const holders = Holders[network];
  const provider = new StaticJsonRpcProvider(
    generateConfig(network).privateHttpProvider,
    network,
  );

  // Test configuration with longer timeout for Avalanche network
  const testConfig = {
    network,
    tokens,
    holders,
    dexKey,
    provider,
    testTimeoutMs: 60000,
  };

  describe('AVAX -> Token swaps', () => {
    it('AVAX -> USDC.e', async () => {
      await testE2E(
        {
          ...testConfig,
          srcToken: tokens.AVAX,
          destToken: tokens['USDC.e'],
          sideToContractMethods: new Map([
            [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
          ]),
        },
        5, // maxPoolsUsed
      );
    });

    it('AVAX -> USDT.e', async () => {
      await testE2E(
        {
          ...testConfig,
          srcToken: tokens.AVAX,
          destToken: tokens['USDT.e'],
          sideToContractMethods: new Map([
            [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
          ]),
        },
        5,
      );
    });
  });

  describe('Token -> AVAX swaps', () => {
    it('USDC.e -> AVAX', async () => {
      await testE2E(
        {
          ...testConfig,
          srcToken: tokens['USDC.e'],
          destToken: tokens.AVAX,
          sideToContractMethods: new Map([
            [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
          ]),
        },
        5,
      );
    });

    it('USDT.e -> AVAX', async () => {
      await testE2E(
        {
          ...testConfig,
          srcToken: tokens['USDT.e'],
          destToken: tokens.AVAX,
          sideToContractMethods: new Map([
            [SwapSide.SELL, [ContractMethod.swapExactAmountIn]],
          ]),
        },
        5,
      );
    });
  });

  describe('Buy operations', () => {
    it('Buy USDC.e with AVAX', async () => {
      await testE2E(
        {
          ...testConfig,
          srcToken: tokens.AVAX,
          destToken: tokens['USDC.e'],
          sideToContractMethods: new Map([
            [SwapSide.BUY, [ContractMethod.swapExactAmountOut]],
          ]),
        },
        5,
      );
    });
  });
});
