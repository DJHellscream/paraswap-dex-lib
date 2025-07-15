import { ApexDefiPoolOrderedParams } from './types';

export class ApexDefiConstantProductPool {
  /**
   * Calculate output amount for a sell operation (exact input)
   * Using constant product formula: (x + dx) * (y - dy) = x * y
   * With fee deduction: dy = (y * dx * (1 - fee)) / (x + dx * (1 - fee))
   */
  static getSellPrice(
    priceParams: ApexDefiPoolOrderedParams,
    srcAmount: bigint,
    feeFactor: number,
  ): bigint {
    const { reservesIn, reservesOut, fee } = priceParams;

    const reserveInBigInt = BigInt(reservesIn);
    const reserveOutBigInt = BigInt(reservesOut);
    const feeBigInt = BigInt(fee);

    // Calculate fee-adjusted input amount
    // amountInWithFee = srcAmount * (feeFactor - fee) / feeFactor
    const amountInWithFee =
      (srcAmount * (BigInt(feeFactor) - feeBigInt)) / BigInt(feeFactor);

    // Calculate output using constant product formula
    // amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee)
    const numerator = reserveOutBigInt * amountInWithFee;
    const denominator = reserveInBigInt + amountInWithFee;

    return denominator === 0n ? 0n : numerator / denominator;
  }

  /**
   * Calculate input amount for a buy operation (exact output)
   * Using constant product formula rearranged for input calculation
   * dx = (x * dy) / ((y - dy) * (1 - fee))
   */
  static getBuyPrice(
    priceParams: ApexDefiPoolOrderedParams,
    destAmount: bigint,
    feeFactor: number,
  ): bigint {
    const { reservesIn, reservesOut, fee } = priceParams;

    const reserveInBigInt = BigInt(reservesIn);
    const reserveOutBigInt = BigInt(reservesOut);
    const feeBigInt = BigInt(fee);

    // Check if we have enough output reserve
    if (destAmount >= reserveOutBigInt) {
      return 0n;
    }

    // Calculate required input amount
    // numerator = reserveIn * destAmount * feeFactor
    const numerator = reserveInBigInt * destAmount * BigInt(feeFactor);
    // denominator = (reserveOut - destAmount) * (feeFactor - fee)
    const denominator =
      (reserveOutBigInt - destAmount) * (BigInt(feeFactor) - feeBigInt);

    if (denominator <= 0n) return 0n;

    // Add 1 to account for rounding up (ensuring we have enough input)
    return numerator === 0n ? 0n : 1n + numerator / denominator;
  }

  /**
   * Get current price impact for a given input amount
   */
  static getPriceImpact(
    priceParams: ApexDefiPoolOrderedParams,
    srcAmount: bigint,
    feeFactor: number,
  ): number {
    const { reservesIn, reservesOut } = priceParams;

    const reserveInBigInt = BigInt(reservesIn);
    const reserveOutBigInt = BigInt(reservesOut);

    // Calculate price before swap
    const priceBefore = Number(reserveOutBigInt) / Number(reserveInBigInt);

    // Calculate output amount
    const outputAmount = ApexDefiConstantProductPool.getSellPrice(
      priceParams,
      srcAmount,
      feeFactor,
    );

    if (outputAmount === 0n) return 100; // 100% price impact if no output

    // Calculate effective price
    const effectivePrice = Number(outputAmount) / Number(srcAmount);

    // Calculate price impact as percentage
    const priceImpact = ((priceBefore - effectivePrice) / priceBefore) * 100;

    return Math.max(0, Math.min(100, priceImpact));
  }
}
