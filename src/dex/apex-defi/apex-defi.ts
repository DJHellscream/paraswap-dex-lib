import { Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';

import {
  AdapterExchangeParam,
  Address,
  DexExchangeParam,
  ExchangePrices,
  PoolLiquidity,
  PoolPrices,
  SimpleExchangeParam,
  Token,
  TxInfo,
  Log,
  Logger,
  TransferFeeParams,
} from '../../types';
import {
  ApexDefiData,
  ApexDefiPool,
  ApexDefiParams,
  ApexDefiFunctions,
  ApexDefiPoolState,
  ApexDefiPoolOrderedParams,
  DexParams,
} from './types';
import { IDex } from '../idex';
import { IDexHelper } from '../../dex-helper';
import {
  Network,
  SwapSide,
  NULL_ADDRESS,
  ETHER_ADDRESS,
  DEST_TOKEN_PARASWAP_TRANSFERS,
  SRC_TOKEN_PARASWAP_TRANSFERS,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import {
  getDexKeysWithNetwork,
  isETHAddress,
  getBigIntPow,
  prependWithOx,
} from '../../utils';
import { NumberAsString, SwapSide as CoreSwapSide } from '@paraswap/core';
import { SimpleExchange } from '../simple-exchange';
import { ApexDefiConfig, Adapters } from './config';
import { ApexDefiConstantProductPool } from './apex-defi-pool';
import ApexDefiFactoryABI from '../../abi/apex-defi/ApexDefiFactory.json';
import ApexDefiRouterABI from '../../abi/apex-defi/ApexDefiRouter.json';

// Gas cost for ApexDefi pool operations
const DefaultApexDefiPoolGasCost = 90 * 1000;

/**
 * Encode pools data for adapter usage
 */
function encodePools(
  pools: ApexDefiPool[],
  feeFactor: number,
): NumberAsString[] {
  return pools.map(({ fee, direction, address }) => {
    return (
      (BigInt(feeFactor - fee) << 161n) +
      ((direction ? 0n : 1n) << 160n) +
      BigInt(address)
    ).toString();
  });
}

/**
 * ApexDefi DEX Integration
 *
 * This class implements the IDex interface for ApexDefi protocol,
 * providing pricing, pool discovery, and transaction building capabilities.
 */
export class ApexDefi extends SimpleExchange implements IDex<ApexDefiData> {
  readonly hasConstantPriceLargeAmounts = false;
  readonly isFeeOnTransferSupported = false;
  readonly needWrapNative = true;
  readonly cacheStateKey = 'state';

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ApexDefiConfig);

  logger: Logger;
  private factoryInterface: Interface;
  private routerInterface: Interface;
  private config: DexParams;

  constructor(
    network: Network,
    dexKey: string,
    dexHelper: IDexHelper,
    protected adapters = Adapters,
  ) {
    super(dexHelper, dexKey);

    this.logger = dexHelper.getLogger(dexKey);
    this.factoryInterface = new Interface(ApexDefiFactoryABI);
    this.routerInterface = new Interface(ApexDefiRouterABI);

    // Get configuration for the current network
    const config = ApexDefiConfig[dexKey]?.[network];
    if (!config) {
      throw new Error(
        `ApexDefi: No configuration found for network ${network}`,
      );
    }
    this.config = config;
  }

  // ============= IDexPricing Implementation =============

  /**
   * Get pool identifiers for a token pair
   * Pool identifier format: {dexKey}_{tokenA}_{tokenB}
   */
  async getPoolIdentifiers(
    srcToken: Token,
    destToken: Token,
    side: SwapSide,
    blockNumber: number,
  ): Promise<string[]> {
    const tokenA = srcToken.address.toLowerCase();
    const tokenB = destToken.address.toLowerCase();

    // Create pool identifier - ensure consistent ordering
    const [token0, token1] =
      tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA];
    const poolIdentifier = `${this.dexKey}_${token0}_${token1}`;

    return [poolIdentifier];
  }

  /**
   * Get prices for given amounts from ApexDefi pools
   */
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
    transferFees?: TransferFeeParams,
    isFirstSwap?: boolean,
  ): Promise<ExchangePrices<ApexDefiData> | null> {
    try {
      const poolAddress = await this.getPoolAddress(
        srcToken,
        destToken,
        blockNumber,
      );
      if (!poolAddress || poolAddress === NULL_ADDRESS) {
        return null;
      }

      const reserves = await this.getPoolReserves(poolAddress, blockNumber);
      if (!reserves) {
        return null;
      }

      const tokenIn = side === SwapSide.SELL ? srcToken : destToken;
      const tokenOut = side === SwapSide.SELL ? destToken : srcToken;

      // Determine token order in the pool
      const isToken0In =
        tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase();
      const reserveIn = isToken0In ? reserves.reserve0 : reserves.reserve1;
      const reserveOut = isToken0In ? reserves.reserve1 : reserves.reserve0;

      const poolParams: ApexDefiPoolOrderedParams = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        reserveIn,
        reserveOut,
        fee: this.config.feeCode,
        decimalsIn: tokenIn.decimals,
        decimalsOut: tokenOut.decimals,
      };

      const unitAmount = getBigIntPow(tokenIn.decimals);
      const feeFactor = 10000 - this.config.feeCode;

      const prices = amounts
        .map(amount => {
          let outputAmount: bigint;

          if (side === SwapSide.SELL) {
            outputAmount = ApexDefiConstantProductPool.getSellPrice(
              poolParams,
              amount,
              10000,
            );
          } else {
            outputAmount = ApexDefiConstantProductPool.getBuyPrice(
              poolParams,
              amount,
              10000,
            );
          }

          if (outputAmount === 0n) {
            return null;
          }

          return {
            prices: [outputAmount],
            unit:
              side === SwapSide.SELL
                ? ApexDefiConstantProductPool.getSellPrice(
                    poolParams,
                    unitAmount,
                    10000,
                  )
                : ApexDefiConstantProductPool.getBuyPrice(
                    poolParams,
                    unitAmount,
                    10000,
                  ),
            data: {
              router: this.config.router,
              pools: [
                {
                  address: poolAddress,
                  token0: isToken0In ? tokenIn.address : tokenOut.address,
                  token1: isToken0In ? tokenOut.address : tokenIn.address,
                  fee: this.config.feeCode,
                  reserve0: reserves.reserve0,
                  reserve1: reserves.reserve1,
                  direction: side === SwapSide.SELL,
                },
              ],
              feeFactor,
            } as ApexDefiData,
            poolAddresses: [poolAddress],
            exchange: this.dexKey,
            gasCost: this.config.poolGasCost,
            poolIdentifier: `${this.dexKey}_${poolAddress}`,
          };
        })
        .filter(p => p !== null);

      return prices.length > 0 ? prices : null;
    } catch (error) {
      this.logger.error('Error in getPricesVolume:', error);
      return null;
    }
  }

  /**
   * Calculate gas cost for calldata
   */
  getCalldataGasCost(poolPrices: PoolPrices<ApexDefiData>): number | number[] {
    return CALLDATA_GAS_COST.DEX_NO_PAYLOAD;
  }

  /**
   * Get available adapters for the given side
   */
  getAdapters(side: SwapSide): { name: string; index: number }[] | null {
    return this.adapters[this.network]?.[side] || null;
  }

  // ============= IDexTxBuilder Implementation =============

  /**
   * Get adapter parameters for multi-hop swaps
   */
  getAdapterParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ApexDefiData,
    side: SwapSide,
  ): AdapterExchangeParam {
    const { pools } = data;
    const payload = this.abiCoder.encodeParameter(
      'tuple(address,uint256,uint256,address[])',
      [data.router, srcAmount, destAmount, pools.map(p => p.address)],
    );

    return {
      targetExchange: data.router,
      payload,
      networkFee: '0',
    };
  }

  /**
   * Get simple swap parameters
   */
  async getSimpleParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    data: ApexDefiData,
    side: SwapSide,
  ): Promise<SimpleExchangeParam> {
    const swapFunction =
      side === SwapSide.SELL
        ? 'swapExactTokensForTokens'
        : 'swapTokensForExactTokens';

    const swapData = this.routerInterface.encodeFunctionData(swapFunction, [
      side === SwapSide.SELL ? srcAmount : destAmount,
      side === SwapSide.SELL ? destAmount : srcAmount,
      [srcToken, destToken],
      NULL_ADDRESS, // Placeholder for recipient
      Math.floor(Date.now() / 1000) + 1800, // 30 minutes deadline
    ]);

    return this.buildSimpleParamWithoutWETHConversion(
      srcToken,
      srcAmount,
      destToken,
      destAmount,
      swapData,
      data.router,
    );
  }

  /**
   * Get direct swap parameters for V6 contracts
   */
  getDexParam(
    srcToken: Address,
    destToken: Address,
    srcAmount: NumberAsString,
    destAmount: NumberAsString,
    recipient: Address,
    data: ApexDefiData,
    side: SwapSide,
  ): DexExchangeParam {
    const swapFunction =
      side === SwapSide.SELL ? ApexDefiFunctions.swap : ApexDefiFunctions.buy;

    const swapData = this.abiCoder.encodeParameters(
      ['address', 'uint256', 'uint256', 'address[]'],
      [data.router, srcAmount, destAmount, data.pools.map(p => p.address)],
    );

    return {
      needWrapNative: this.needWrapNative,
      dexFuncHasRecipient: false,
      exchangeData: swapData,
      targetExchange: data.router,
      returnAmountPos: side === SwapSide.SELL ? undefined : 0,
    };
  }

  // ============= Helper Methods =============

  /**
   * Get pool address for a token pair
   */
  private async getPoolAddress(
    tokenA: Token,
    tokenB: Token,
    blockNumber: number,
  ): Promise<Address | null> {
    try {
      const factoryContract = new this.dexHelper.web3Provider.eth.Contract(
        ApexDefiFactoryABI as any,
        this.config.factoryAddress,
      );

      const poolAddress = await factoryContract.methods
        .getPair(tokenA.address, tokenB.address)
        .call({}, blockNumber);

      return poolAddress === NULL_ADDRESS ? null : poolAddress;
    } catch (error) {
      this.logger.error('Error getting pool address:', error);
      return null;
    }
  }

  /**
   * Get pool reserves from blockchain
   */
  private async getPoolReserves(
    poolAddress: Address,
    blockNumber: number,
  ): Promise<{ reserve0: string; reserve1: string } | null> {
    try {
      const poolContract = new this.dexHelper.web3Provider.eth.Contract(
        [
          {
            name: 'getReserves',
            type: 'function',
            inputs: [],
            outputs: [
              { name: 'reserve0', type: 'uint112' },
              { name: 'reserve1', type: 'uint112' },
              { name: 'blockTimestampLast', type: 'uint32' },
            ],
            stateMutability: 'view',
          },
        ],
        poolAddress,
      );

      const reserves = await poolContract.methods
        .getReserves()
        .call({}, blockNumber);

      return {
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
      };
    } catch (error) {
      this.logger.error('Error getting pool reserves:', error);
      return null;
    }
  }

  // ============= IDexPooltracker Implementation =============

  /**
   * Get top pools for a token based on liquidity
   */
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    // Placeholder implementation - in a real scenario, this would fetch from subgraph
    // or scan factory events to find pools with the highest liquidity
    return [];
  }
}
