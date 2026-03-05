# AutheoSwap — Uniswap V2 DEX Frontend

React app untuk berinteraksi dengan AutheoSwap di Autheo Testnet (Chain ID: 785).

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

## Cara Jalankan

```bash
npm install
npm start
```

Buka http://localhost:3000

## Fitur

- ✅ Connect MetaMask + auto-add Autheo Testnet
- ✅ Swap token (THEO ↔ WTHEO ↔ USDT ↔ USDC ↔ WBTC ↔ WETH)
- ✅ Real-time price quote dari `getAmountsOut`
- ✅ Price impact, minimum received, LP fee display
- ✅ Slippage tolerance (0.1% / 0.5% / 1.0% / custom)
- ✅ Add liquidity (token/token & THEO/token)
- ✅ View semua LP positions kamu
- ✅ Remove liquidity dengan slider %
- ✅ Auto approve token sebelum transaksi
- ✅ TX modal (pending → mining → success/error)
- ✅ Link ke Autheo block explorer

## Build Production

```bash
npm run build
```

Output di folder `build/`, siap di-deploy ke Netlify / Vercel / hosting manapun.
