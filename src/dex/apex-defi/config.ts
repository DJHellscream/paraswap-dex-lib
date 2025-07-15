import { DexParams } from './types';
import { DexConfigMap } from '../../types';
import { Network, SwapSide } from '../../constants';

export const ApexDefiConfig: DexConfigMap<DexParams> = {
  ApexDefi: {
    [Network.AVALANCHE]: {
      router: '0x0000000000000000000000000000000000000000', // ApexDefi Router address
      feeFactor: 10000, // 100% = 10000, fee = (10000 - feeFactor) / 10000
      chunksCount: 10,
    },
  },
};

// Adapter configurations for different networks and swap sides
export const Adapters: {
  [chainId: number]: { [side: string]: { name: string; index: number }[] };
} = {
  [Network.AVALANCHE]: {
    [SwapSide.SELL]: [
      {
        name: 'AvalancheAdapter01',
        index: 3,
      },
    ],
    [SwapSide.BUY]: [
      {
        name: 'AvalancheBuyAdapter',
        index: 1,
      },
    ],
  },
};

export const APEX_DEFI_WETH_ADDRESS =
  '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7'; // WAVAX on Avalanche
