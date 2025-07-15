import { ApexDefiPoolOrderedParams } from './types';

/**
 * ApexDefi Constant Product Pool
 *
 * This class provides static methods for calculating prices in ApexDefi AMM pools
 * using the constant product formula (x * y = k).
 */
export class ApexDefiConstantProductPool {
  /**
   * Calculate the output amount for a sell operation
   * Uses the constant product formula with fees applied
   */
  static getSellPrice(
    priceParams: ApexDefiPoolOrderedParams,
    srcAmount: bigint,
    feeFactor: number,
  ): bigint {
    const { reserveIn, reserveOut, fee } = priceParams;

    // Check if pool has sufficient liquidity
    if (BigInt(reserveIn) === 0n || BigInt(reserveOut) === 0n) {
      return 0n;
    }

    // Apply fee to input amount (fee is in basis points)
    const amountInWithFee = srcAmount * BigInt(feeFactor - fee);

    // Calculate output using constant product formula
    // amountOut = (amountInWithFee * reserveOut) / (reserveIn * feeFactor + amountInWithFee)
    const numerator = amountInWithFee * BigInt(reserveOut);
    const denominator = BigInt(reserveIn) * BigInt(feeFactor) + amountInWithFee;

    return denominator === 0n ? 0n : numerator / denominator;
  }

  /**
   * Calculate the input amount required for a buy operation
   * Uses the inverse of the constant product formula with fees applied
   */
  static getBuyPrice(
    priceParams: ApexDefiPoolOrderedParams,
    destAmount: bigint,
    feeFactor: number,
  ): bigint {
    const { reserveIn, reserveOut, fee } = priceParams;

    // Check if the desired output amount is available
    if (destAmount >= BigInt(reserveOut)) {
      return 0n;
    }

    // Calculate required input using inverse constant product formula
    // amountIn = (reserveIn * destAmount * feeFactor) / ((feeFactor - fee) * (reserveOut - destAmount))
    const numerator = BigInt(reserveIn) * destAmount * BigInt(feeFactor);
    const denominator =
      (BigInt(feeFactor) - BigInt(fee)) * (BigInt(reserveOut) - destAmount);

    if (denominator <= 0n) return 0n;

    // Add 1 wei to account for rounding errors
    return numerator === 0n ? 0n : 1n + numerator / denominator;
  }
}
