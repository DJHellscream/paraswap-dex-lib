import { Interface } from '@ethersproject/abi';
import _ from 'lodash';
import { AsyncOrSync, DeepReadonly } from 'ts-essentials';
import {
  AdapterExchangeParam,
  Address,
  ExchangePrices,
  PoolPrices,
  Log,
  Logger,
  PoolLiquidity,
  SimpleExchangeParam,
  Token,
  TxInfo,
  DexExchangeParam,
} from '../../types';
import {
  ApexDefiData,
  ApexDefiPool,
  ApexDefiPoolState,
  ApexDefiParam,
  ApexDefiFunctions,
  ApexDefiParamsDirect,
  ApexDefiPoolOrderedParams,
  DexParams,
} from './types';
import { IDex } from '../idex';
import {
  ETHER_ADDRESS,
  Network,
  NULL_ADDRESS,
  SUBGRAPH_TIMEOUT,
} from '../../constants';
import * as CALLDATA_GAS_COST from '../../calldata-gas-cost';
import { SimpleExchange } from '../simple-exchange';
import { SwapSide } from '../../constants';
import { IDexHelper } from '../../dex-helper';
import { getDexKeysWithNetwork, isETHAddress, getBigIntPow } from '../../utils';
import ApexDefiRouterABI from '../../abi/apex-defi/apex-defi-router.json';
import ApexDefiPoolABI from '../../abi/apex-defi/apex-defi-pool.json';
import { ApexDefiConfig, Adapters, APEX_DEFI_WETH_ADDRESS } from './config';
import { ApexDefiConstantProductPool } from './apex-defi-constant-product-pool';
import { ApexDefiEventPool } from './apex-defi-event-pool';

const DefaultApexDefiPoolGasCost = 120 * 1000; // Higher gas cost due to ERC314 complexity

/**
 * ApexDefi DEX implementation
 *
 * ApexDefi uses ERC314 tokens which combine token and liquidity functionality.
 * Each token has its own pool where the pool address equals the token address.
 * Trading is done against AVAX pairs only (token/AVAX).
 *
 * Key characteristics:
 * - ERC314 tokens with built-in AMM functionality
 * - Pool address = Token address for non-AVAX tokens
 * - All pairs are Token/AVAX (no token-to-token direct swaps)
 * - Constant product AMM formula with fees
 * - Event-driven pool state tracking
 */
export class ApexDefi
  extends SimpleExchange
  implements IDex<ApexDefiData, ApexDefiParam | ApexDefiParamsDirect>
{
  readonly hasConstantPriceLargeAmounts = false;
  readonly needWrapNative = true;
  readonly isFeeOnTransferSupported = false;

  public static dexKeysWithNetwork: { key: string; networks: Network[] }[] =
    getDexKeysWithNetwork(ApexDefiConfig);

  private routerIface = new Interface(ApexDefiRouterABI);
  private poolIface = new Interface(ApexDefiPoolABI);
  private config: DexParams;
  private eventPools: Record<string, ApexDefiEventPool | null> = {};
  private wethAddress: Address;

  constructor(
    readonly network: number,
    readonly dexKey: string,
    readonly dexHelper: IDexHelper,
    protected logger: Logger,
    protected adapters = Adapters,
    protected config_ = ApexDefiConfig[dexKey][network],
  ) {
    super(dexHelper, dexKey);
    this.config = config_;
    this.wethAddress = APEX_DEFI_WETH_ADDRESS; // WAVAX on Avalanche
  }

  /**
   * Initialize the DEX instance
   */
  async initializePricing(blockNumber: number): Promise<void> {
    // ApexDefi doesn't require specific initialization
    this.logger.info(`ApexDefi initialized for network ${this.network}`);
  }

  /**
   * Get pricing information for token swaps
   * ApexDefi only supports AVAX/Token pairs, so we need to handle routing accordingly
   */
  async getPricesVolume(
    srcToken: Token,
    destToken: Token,
    amounts: bigint[],
    side: SwapSide,
    blockNumber: number,
    limitPools?: string[],
  ): Promise<null | ExchangePrices<ApexDefiData>> {
    try {
      // Check if this is a supported pair (one token must be AVAX/WAVAX)
      const isValidPair = this.isValidApexDefiPair(srcToken, destToken);
      if (!isValidPair) {
        return null;
      }

      // Determine which token is AVAX and which is the ERC314 token
      const { avaxToken, erc314Token, isAvaxToToken } = this.identifyTokens(
        srcToken,
        destToken,
      );

      // Get pool state for the ERC314 token
      const poolAddress = erc314Token.address;
      const poolState = await this.getPoolState(
        poolAddress,
        erc314Token.address,
        blockNumber,
      );

      if (!poolState || !this.hasMinimumLiquidity(poolState)) {
        return null;
      }

      // Calculate prices for all amounts
      const prices = amounts.map(amount => {
        if (amount === 0n) return 0n;

        const priceParams: ApexDefiPoolOrderedParams = isAvaxToToken
          ? {
              reservesIn: poolState.reserveAVAX,
              reservesOut: poolState.reserveToken,
              fee: '300', // 3% default fee for ApexDefi
            }
          : {
              reservesIn: poolState.reserveToken,
              reservesOut: poolState.reserveAVAX,
              fee: '300',
            };

        return side === SwapSide.SELL
          ? ApexDefiConstantProductPool.getSellPrice(
              priceParams,
              amount,
              this.config.feeFactor,
            )
          : ApexDefiConstantProductPool.getBuyPrice(
              priceParams,
              amount,
              this.config.feeFactor,
            );
      });

      // Check if all prices are valid
      if (prices.some(price => price === 0n)) {
        return null;
      }

      // Build the pool data
      const pool: ApexDefiPool = {
        address: poolAddress,
        token: erc314Token.address,
        reserveAVAX: poolState.reserveAVAX,
        reserveToken: poolState.reserveToken,
        fee: '300',
      };

      const data: ApexDefiData = {
        router: this.config.router,
        pools: [pool],
        weth: this.wethAddress,
      };

      const poolPrices: PoolPrices<ApexDefiData> = {
        prices,
        unit: getBigIntPow(destToken.decimals),
        data,
        poolAddresses: [poolAddress],
        exchange: this.dexKey,
        gasCost: DefaultApexDefiPoolGasCost,
        poolIdentifier: `${this.dexKey}_${poolAddress}`,
      };

      return [poolPrices];
    } catch (error) {
      this.logger.error(`Error in getPricesVolume: ${error}`);
      return null;
    }
  }

  /**
   * Get adapter parameters for transaction execution
   */
  getAdapterParam(
    srcToken: string,
    destToken: string,
    srcAmount: string,
    destAmount: string,
    data: ApexDefiData,
    side: SwapSide,
  ): AdapterExchangeParam {
    // Determine swap direction and function
    const isAvaxToToken =
      isETHAddress(srcToken) ||
      srcToken.toLowerCase() === this.wethAddress.toLowerCase();
    const functionName = isAvaxToToken
      ? ApexDefiFunctions.swapAVAXForTokens
      : ApexDefiFunctions.swapTokensForAVAX;

    // Get the token address (non-AVAX token)
    const tokenAddress = isAvaxToToken ? destToken : srcToken;

    // Build the swap parameters
    const swapParams = [
      tokenAddress, // token address
      srcAmount, // amountIn
      destAmount, // amountOutMin
      NULL_ADDRESS, // to (will be replaced by adapter)
    ];

    // Encode the function call
    const swapData = this.routerIface.encodeFunctionData(
      functionName,
      swapParams,
    );

    // Calculate calldata gas cost
    const calldataGasCost =
      CALLDATA_GAS_COST.DEX_OVERHEAD +
      CALLDATA_GAS_COST.LENGTH_SMALL +
      CALLDATA_GAS_COST.OFFSET_SMALL +
      CALLDATA_GAS_COST.WORD * Math.ceil(swapData.length / 64);

    return {
      targetExchange: data.router,
      payload: swapData,
      networkFee: '0',
    };
  }

  /**
   * Get top pools for a given token (for liquidity discovery)
   */
  async getTopPoolsForToken(
    tokenAddress: Address,
    limit: number,
  ): Promise<PoolLiquidity[]> {
    try {
      // For ApexDefi, each token has exactly one pool (token/AVAX)
      // The pool address equals the token address for ERC314 tokens

      // Skip if token is AVAX/WAVAX
      if (
        isETHAddress(tokenAddress) ||
        tokenAddress.toLowerCase() === this.wethAddress.toLowerCase()
      ) {
        return [];
      }

      const poolAddress = tokenAddress;
      const poolState = await this.getPoolState(
        poolAddress,
        tokenAddress,
        'latest',
      );

      if (!poolState || !this.hasMinimumLiquidity(poolState)) {
        return [];
      }

      // Calculate approximate USD liquidity (using AVAX reserve * 2 * estimated price)
      const avaxReserve = BigInt(poolState.reserveAVAX);
      const avaxAmount = Number(avaxReserve) / 1e18;
      const estimatedUSDLiquidity = avaxAmount * 100 * 2; // Assuming $100 AVAX price

      const poolLiquidity: PoolLiquidity = {
        exchange: this.dexKey,
        address: poolAddress,
        connectorTokens: [
          {
            decimals: 18,
            address: this.wethAddress, // WAVAX
          },
        ],
        liquidityUSD: estimatedUSDLiquidity,
      };

      return [poolLiquidity];
    } catch (error) {
      this.logger.error(`Error in getTopPoolsForToken: ${error}`);
      return [];
    }
  }

  /**
   * Release resources (cleanup)
   */
  releaseResources(): AsyncOrSync<void> {
    // Clean up event pools
    Object.values(this.eventPools).forEach(pool => {
      if (pool) {
        pool.removeAllListeners();
      }
    });
    this.eventPools = {};
  }

  // Helper methods

  /**
   * Check if the token pair is valid for ApexDefi
   * One token must be AVAX/WAVAX and the other must be an ERC314 token
   */
  private isValidApexDefiPair(srcToken: Token, destToken: Token): boolean {
    const isSourceAvax =
      isETHAddress(srcToken.address) ||
      srcToken.address.toLowerCase() === this.wethAddress.toLowerCase();
    const isDestAvax =
      isETHAddress(destToken.address) ||
      destToken.address.toLowerCase() === this.wethAddress.toLowerCase();

    // Exactly one token should be AVAX
    return (isSourceAvax && !isDestAvax) || (!isSourceAvax && isDestAvax);
  }

  /**
   * Identify which token is AVAX and which is the ERC314 token
   */
  private identifyTokens(srcToken: Token, destToken: Token) {
    const isSourceAvax =
      isETHAddress(srcToken.address) ||
      srcToken.address.toLowerCase() === this.wethAddress.toLowerCase();

    if (isSourceAvax) {
      return {
        avaxToken: srcToken,
        erc314Token: destToken,
        isAvaxToToken: true,
      };
    } else {
      return {
        avaxToken: destToken,
        erc314Token: srcToken,
        isAvaxToToken: false,
      };
    }
  }

  /**
   * Get pool state with caching via event pools
   */
  private async getPoolState(
    poolAddress: Address,
    tokenAddress: Address,
    blockNumber: number | string,
  ): Promise<ApexDefiPoolState | null> {
    try {
      const blockNum = typeof blockNumber === 'string' ? 'latest' : blockNumber;
      const poolKey = `${poolAddress}_${tokenAddress}`.toLowerCase();

      // Try to get from event pool first
      let eventPool = this.eventPools[poolKey];
      if (!eventPool) {
        eventPool = new ApexDefiEventPool(
          this.dexKey,
          this.network,
          this.dexHelper,
          this.logger,
          poolAddress,
          tokenAddress,
        );
        this.eventPools[poolKey] = eventPool;
      }

      if (blockNum !== 'latest') {
        const state = eventPool.getState(blockNum as number);
        if (state) {
          return state;
        }
      }

      // Fallback to direct contract call
      const reservesResult = await this.dexHelper.multiContract.methods
        .getReserves(poolAddress)
        .call({}, blockNum);

      return {
        reserveAVAX: reservesResult.reserveAVAX.toString(),
        reserveToken: reservesResult.reserveToken.toString(),
      };
    } catch (error) {
      this.logger.warn(`Failed to get pool state for ${poolAddress}: ${error}`);
      return null;
    }
  }

  /**
   * Check if pool has minimum liquidity
   */
  private hasMinimumLiquidity(state: ApexDefiPoolState): boolean {
    const minLiquidity = 1000n; // Minimum 1000 wei in each reserve
    return (
      BigInt(state.reserveAVAX) >= minLiquidity &&
      BigInt(state.reserveToken) >= minLiquidity
    );
  }
}
