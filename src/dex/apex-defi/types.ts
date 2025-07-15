import { Address, NumberAsString } from '../../types';

// ApexDefi pool state representing the current state of a liquidity pool
export type ApexDefiPoolState = {
  reserve0: string;
  reserve1: string;
  fee: number; // Fee in basis points (e.g., 300 = 0.3%)
  blockTimestampLast: number;
};

// Configuration parameters for ApexDefi DEX
export type DexParams = {
  factoryAddress: Address;
  router: Address;
  initCode: string;
  poolGasCost: number;
  feeCode: number;
  subgraphURL?: string;
};

// Pool data structure for ApexDefi
export type ApexDefiPool = {
  address: Address;
  token0: Address;
  token1: Address;
  fee: number;
  reserve0: string;
  reserve1: string;
  direction: boolean;
};

// Data structure passed to exchange functions
export type ApexDefiData = {
  router: Address;
  pools: ApexDefiPool[];
  feeFactor: number;
  weth?: Address;
};

// Parameters for direct swap functions
export type ApexDefiParams = [
  srcToken: Address,
  destToken: Address,
  srcAmount: NumberAsString,
  destAmount: NumberAsString,
  quotedAmount: NumberAsString,
  metadata: string,
  beneficiary: Address,
  pools: string,
];

// Pool parameters with ordered tokens for calculations
export type ApexDefiPoolOrderedParams = {
  tokenIn: Address;
  tokenOut: Address;
  reserveIn: string;
  reserveOut: string;
  fee: number;
  decimalsIn: number;
  decimalsOut: number;
};

// Supported function names in ApexDefi integration
export enum ApexDefiFunctions {
  swap = 'swapExactAmountInOnApexDefi',
  buy = 'swapExactAmountOutOnApexDefi',
}
