# AutheoSwap — Uniswap V2 DEX Frontend

A React-based DEX interface for interacting with AutheoSwap on Autheo Testnet (Chain ID: 785).

## Contract Addresses

| Contract | Address |
|----------|---------|
| Factory  | `0x2677B46B2E3584b7504D95e05E555e00C6abD665` |
| WTHEO    | `0x9c52C2fFA611066858Cd2d8DB724c659B561c41D` |
| Router   | `0xd8A7cEc4c9FCB80ab393e9936aD1C01dbE6CeDCB` |
| USDT     | `0x6145F2411f9b94E7063f28971a174dcCD3532bEe` |
| USDC     | `0x9Df70Dd5F5BD34bC8FA598D18737935cAead7124` |
| WBTC     | `0xF79cd4BCB7986f6B9F14DA6a63FcC6Dccd08BeC5` |
| WETH     | `0xa0a45220Af1874faD35ea8ea5d68B185a1A3b805` |

## Getting Started

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- ✅ MetaMask wallet connection with auto-add Autheo Testnet
- ✅ Token swaps (THEO ↔ USDT ↔ USDC ↔ WBTC ↔ WETH)
- ✅ Real-time price quotes via `getAmountsOut`
- ✅ Price impact, minimum received & LP fee display
- ✅ Slippage tolerance settings (0.1% / 0.5% / 1.0% / custom)
- ✅ Add liquidity for token/token and THEO/token pairs
- ✅ Auto-calculated paired amounts for existing pools
- ✅ View all your LP positions
- ✅ Remove liquidity with percentage slider
- ✅ Wrap / Unwrap THEO ↔ WTHEO (always 1:1, no fee)
- ✅ Auto token approval before transactions
- ✅ Toast-style transaction notifications (no blocking modal)
- ✅ Block explorer links for every transaction

## Network

| Field | Value |
|-------|-------|
| Network Name | Autheo Testnet |
| Chain ID | 785 |
| Currency | THEO |
| RPC URL | https://testnet-rpc1.autheo.com |
| Explorer | https://testnet-explorer.autheo.com |

## Production Build

```bash
npm run build
```

Output is in the `build/` folder — ready to deploy on Vercel, Netlify, or any static host.
