import { DexParams } from './types';
import { DexConfigMap, AdapterMappings } from '../../types';
import { Network, SwapSide } from '../../constants';

// Configuration for ApexDefi across different networks
export const ApexDefiConfig: DexConfigMap<DexParams> = {
  ApexDefi: {
    // Ethereum Mainnet configuration
    [Network.MAINNET]: {
      factoryAddress: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual factory address
      router: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual router address
      initCode:
        '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder - replace with actual init code hash
      feeCode: 300, // 0.3% fee in basis points
      poolGasCost: 150 * 1000, // Estimated gas cost for pool operations
      subgraphURL: '', // Placeholder - add subgraph URL if available
    },
    // Polygon configuration
    [Network.POLYGON]: {
      factoryAddress: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual factory address
      router: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual router address
      initCode:
        '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder - replace with actual init code hash
      feeCode: 300, // 0.3% fee in basis points
      poolGasCost: 150 * 1000, // Estimated gas cost for pool operations
      subgraphURL: '', // Placeholder - add subgraph URL if available
    },
    // BSC (Binance Smart Chain) configuration
    [Network.BSC]: {
      factoryAddress: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual factory address
      router: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual router address
      initCode:
        '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder - replace with actual init code hash
      feeCode: 300, // 0.3% fee in basis points
      poolGasCost: 150 * 1000, // Estimated gas cost for pool operations
      subgraphURL: '', // Placeholder - add subgraph URL if available
    },
    // Arbitrum configuration
    [Network.ARBITRUM]: {
      factoryAddress: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual factory address
      router: '0x0000000000000000000000000000000000000000', // Placeholder - replace with actual router address
      initCode:
        '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder - replace with actual init code hash
      feeCode: 300, // 0.3% fee in basis points
      poolGasCost: 150 * 1000, // Estimated gas cost for pool operations
      subgraphURL: '', // Placeholder - add subgraph URL if available
    },
  },
};

// Adapter configurations for different networks and swap sides
export const Adapters: Record<number, AdapterMappings> = {
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 8 }], // Adapter for sell-side swaps
    [SwapSide.BUY]: [{ name: 'BuyAdapter02', index: 6 }], // Adapter for buy-side swaps
  },
  [Network.POLYGON]: {
    [SwapSide.SELL]: [{ name: 'PolygonAdapter02', index: 7 }],
    [SwapSide.BUY]: [{ name: 'PolygonBuyAdapter02', index: 5 }],
  },
  [Network.BSC]: {
    [SwapSide.SELL]: [{ name: 'BscAdapter02', index: 6 }],
    [SwapSide.BUY]: [{ name: 'BscBuyAdapter02', index: 4 }],
  },
  [Network.ARBITRUM]: {
    [SwapSide.SELL]: [{ name: 'ArbitrumAdapter02', index: 8 }],
    [SwapSide.BUY]: [{ name: 'ArbitrumBuyAdapter02', index: 6 }],
  },
};
