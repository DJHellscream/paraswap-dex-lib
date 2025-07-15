import { Address } from '../../types';

export type ApexDefiData = {
  router: Address;
  pools: ApexDefiPool[];
  weth?: Address;
};

export type ApexDefiPool = {
  address: Address;
  token: Address;
  reserveAVAX: string;
  reserveToken: string;
  fee: string;
};

export type ApexDefiPoolState = {
  reserveAVAX: string;
  reserveToken: string;
};

export type ApexDefiPoolOrderedParams = {
  reservesIn: string;
  reservesOut: string;
  fee: string;
};

export type ApexDefiParam = {
  router: Address;
  pools: ApexDefiPool[];
};

export type ApexDefiParamsDirectBase = [
  srcToken: Address,
  destToken: Address,
  fromAmount: string,
  toAmount: string,
  quotedAmount: string,
  metadata: string,
  beneficiary: Address,
  pools: string,
];

export type ApexDefiParamsDirect = [
  params: ApexDefiParamsDirectBase,
  partnerAndFee: string,
  permit: string,
];

export enum ApexDefiFunctions {
  swapAVAXForTokens = 'swapAVAXForTokens',
  swapTokensForAVAX = 'swapTokensForAVAX',
}

export type DexParams = {
  router: Address;
  factory?: Address;
  initCode?: string;
  feeFactor: number;
  pools?: { [key: string]: ApexDefiPoolState };
  chunksCount?: number;
};
