# ApexDefi DEX Integration

This directory contains the complete integration for ApexDefi protocol into the ParaSwap DEX library.

## Overview

ApexDefi is implemented as a UniswapV2-style constant product automated market maker (AMM) that uses the formula `x * y = k` for price calculations.

## Files Structure

- **`apex-defi.ts`** - Main DEX implementation with pricing, pool discovery, and transaction building
- **`apex-defi-pool.ts`** - Constant product pool mathematics and calculations
- **`types.ts`** - TypeScript type definitions for the integration
- **`config.ts`** - Multi-network configuration and adapter mappings
- **`apex-defi-integration.test.ts`** - Unit tests for core functionality

## ABI Files

Located in `src/abi/apex-defi/`:

- **`ApexDefiFactory.json`** - Factory contract ABI for pool discovery
- **`ApexDefiPool.json`** - Pool contract ABI for reserves and swaps
- **`ApexDefiRouter.json`** - Router contract ABI for swap execution

## Features

### Multi-Network Support

- Ethereum Mainnet
- Polygon
- Binance Smart Chain (BSC)
- Arbitrum

### Core Functionality

- **Pool Discovery** - Automatic identification of available trading pairs
- **Price Calculation** - Accurate buy/sell price computation with fees
- **Gas Estimation** - Optimized gas cost calculations
- **Adapter Integration** - Full support for ParaSwap V5 and V6 adapters
- **Fee Handling** - Configurable fee structures (default 0.3%)

### Mathematical Model

Uses the constant product AMM formula:

- **Sell Price**: `amountOut = (amountIn * (10000 - fee) * reserveOut) / (reserveIn * 10000 + amountIn * (10000 - fee))`
- **Buy Price**: `amountIn = (reserveIn * amountOut * 10000) / ((10000 - fee) * (reserveOut - amountOut)) + 1`

## Configuration

### Network Setup

Each network requires the following configuration in `config.ts`:

```typescript
{
  factoryAddress: string;     // Factory contract address
  router: string;            // Router contract address
  initCode: string;          // Pool init code hash
  feeCode: number;           // Fee in basis points (300 = 0.3%)
  poolGasCost: number;       // Estimated gas cost
  subgraphURL?: string;      // Optional subgraph endpoint
}
```

### Adapter Configuration

Adapters are configured per network and swap side:

```typescript
{
  [Network.MAINNET]: {
    [SwapSide.SELL]: [{ name: 'Adapter04', index: 8 }],
    [SwapSide.BUY]: [{ name: 'BuyAdapter02', index: 6 }]
  }
}
```

## Usage

The integration is automatically registered in the DEX registry and will be available for routing when:

1. Valid contract addresses are configured for the target network
2. Sufficient pool liquidity exists for the trading pair
3. The pool is discoverable through the factory contract

## Testing

Run the unit tests with:

```bash
yarn test src/dex/apex-defi/apex-defi-integration.test.ts
```

Tests cover:

- Pool mathematics accuracy
- Configuration validation
- Adapter functionality
- Edge case handling (zero liquidity, large amounts)

## Production Deployment

To deploy for production:

1. Update `config.ts` with real contract addresses
2. Verify ABI files match deployed contracts
3. Test on testnet with real pools
4. Configure appropriate gas costs and fees
5. Set up subgraph endpoints if available

## Notes

- This implementation follows the same patterns as UniswapV2 and other established DEX integrations
- All calculations use BigInt for precision and to avoid rounding errors
- Comprehensive error handling and logging is included throughout
- The code is fully typed with TypeScript for maximum safety
