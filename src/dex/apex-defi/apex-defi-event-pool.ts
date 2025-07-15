import { Interface } from '@ethersproject/abi';
import { DeepReadonly } from 'ts-essentials';
import { Log, Logger, Address } from '../../types';
import { StatefulEventSubscriber } from '../../stateful-event-subscriber';
import { IDexHelper } from '../../dex-helper/idex-helper';
import { ApexDefiPoolState } from './types';
import ApexDefiPoolABI from '../../abi/apex-defi/apex-defi-pool.json';

/**
 * ApexDefi Event Pool implementation for tracking pool state changes
 * Handles Swap events to maintain up-to-date reserve information
 */
export class ApexDefiEventPool extends StatefulEventSubscriber<ApexDefiPoolState> {
  private poolIface = new Interface(ApexDefiPoolABI);

  handlers: {
    [event: string]: (
      event: any,
      state: DeepReadonly<ApexDefiPoolState>,
      log: Readonly<Log>,
    ) => DeepReadonly<ApexDefiPoolState> | null;
  } = {};

  logDecoder: (log: Log) => any;

  addressesSubscribed: string[];

  constructor(
    readonly parentName: string,
    protected network: number,
    protected dexHelper: IDexHelper,
    logger: Logger,
    public readonly poolAddress: Address,
    public readonly token: Address,
    mapKey: string = '',
  ) {
    super(parentName, `${poolAddress}_${token}`, dexHelper, logger);

    this.logDecoder = (log: Log) => this.poolIface.parseLog(log);
    this.addressesSubscribed = [poolAddress];

    // Handler for Swap events
    this.handlers['Swap'] = this.handleSwapEvent.bind(this);
  }

  /**
   * Handle Swap events to update pool reserves
   * Swap event: Swap(address indexed from, address indexed to, uint256 amountAVAX, uint256 amountToken)
   */
  handleSwapEvent(
    event: any,
    state: DeepReadonly<ApexDefiPoolState>,
    log: Readonly<Log>,
  ): DeepReadonly<ApexDefiPoolState> | null {
    try {
      const { amountAVAX, amountToken } = event.args;

      // Update reserves based on swap event
      // Note: In ERC314, the amounts in the event represent the current reserves after the swap
      return {
        reserveAVAX: amountAVAX.toString(),
        reserveToken: amountToken.toString(),
      };
    } catch (error) {
      this.logger.error(`Error handling Swap event: ${error}`);
      return null;
    }
  }

  /**
   * Generate state from on-chain data
   */
  async generateState(
    blockNumber: number,
    readonly: boolean = false,
  ): Promise<DeepReadonly<ApexDefiPoolState>> {
    try {
      // Get current reserves from the pool contract
      const reserves = await this.dexHelper.multiContract.methods
        .getReserves(this.poolAddress)
        .call({}, blockNumber);

      const state: ApexDefiPoolState = {
        reserveAVAX: reserves.reserveAVAX.toString(),
        reserveToken: reserves.reserveToken.toString(),
      };

      return state;
    } catch (error) {
      this.logger.error(
        `Error generating state for pool ${this.poolAddress}: ${error}`,
      );

      // Return empty state if unable to fetch reserves
      return {
        reserveAVAX: '0',
        reserveToken: '0',
      };
    }
  }

  /**
   * Get the current state of the pool
   */
  getState(blockNumber: number): DeepReadonly<ApexDefiPoolState> | null {
    return this.getStateOrGenerate(blockNumber, false);
  }

  /**
   * Check if pool has sufficient liquidity for a trade
   */
  hasLiquidity(
    state: DeepReadonly<ApexDefiPoolState>,
    minLiquidity: bigint = 1000n,
  ): boolean {
    const reserveAVAX = BigInt(state.reserveAVAX);
    const reserveToken = BigInt(state.reserveToken);

    return reserveAVAX >= minLiquidity && reserveToken >= minLiquidity;
  }

  /**
   * Calculate the total value locked in USD equivalent (assuming AVAX price)
   * This is a simplified calculation for liquidity ranking
   */
  getTotalValueLocked(
    state: DeepReadonly<ApexDefiPoolState>,
    avaxPrice: number = 100,
  ): number {
    const reserveAVAX = BigInt(state.reserveAVAX);

    // Convert AVAX reserves to USD (multiply by 2 for total pool value)
    // 1 AVAX = 18 decimals, so divide by 10^18
    const avaxInPool = Number(reserveAVAX) / 1e18;
    return avaxInPool * avaxPrice * 2; // Multiply by 2 for total pool value
  }
}

export type PoolState = ApexDefiPoolState;
