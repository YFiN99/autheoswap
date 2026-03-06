import { ethers } from 'ethers';

// ── Network ───────────────────────────────────────────
export const CHAIN_ID  = 785;
export const CHAIN_HEX = '0x311';
export const RPCS      = ['https://testnet-rpc1.autheo.com', 'https://testnet-rpc2.autheo.com'];
export const EXPLORER  = 'https://testnet-explorer.autheo.com';

// ── Contracts ─────────────────────────────────────────
export const FACTORY = '0x2677B46B2E3584b7504D95e05E555e00C6abD665';
export const WTHEO   = '0x9c52C2fFA611066858Cd2d8DB724c659B561c41D';
export const ROUTER  = '0xd8A7cEc4c9FCB80ab393e9936aD1C01dbE6CeDCB';
export const CONTRACTS = { factory: FACTORY, wtheo: WTHEO, router: ROUTER };

// ── Token list ────────────────────────────────────────
// WTHEO disembunyikan dari UI — Router otomatis wrap THEO saat swap
// User hanya perlu THEO, tidak perlu lihat WTHEO
export const TOKENS = [
  { symbol:'THEO',  name:'Autheo',           decimals:18, address:'NATIVE',                                     color:'#00d4ff', grad:'135deg,#00d4ff,#005f99', icon:'T' },
  { symbol:'USDT',  name:'Tether USD',       decimals:6,  address:'0x6145F2411f9b94E7063f28971a174dcCD3532bEe', color:'#26a17b', grad:'135deg,#26a17b,#1a6b52', icon:'₮' },
  { symbol:'USDC',  name:'USD Coin',         decimals:6,  address:'0x9Df70Dd5F5BD34bC8FA598D18737935cAead7124', color:'#2775ca', grad:'135deg,#2775ca,#1a58a0', icon:'$' },
  { symbol:'WBTC',  name:'Wrapped Bitcoin',  decimals:8,  address:'0xF79cd4BCB7986f6B9F14DA6a63FcC6Dccd08BeC5', color:'#f7931a', grad:'135deg,#f7931a,#c06010', icon:'₿' },
  { symbol:'WETH',  name:'Wrapped Ether',    decimals:18, address:'0xa0a45220Af1874faD35ea8ea5d68B185a1A3b805', color:'#627eea', grad:'135deg,#627eea,#3a4ec8', icon:'Ξ' },
];

// WTHEO tetap tersedia untuk keperluan internal (liquidity, wrap panel)
export const TOK_WTHEO = { symbol:'WTHEO', name:'Wrapped THEO', decimals:18, address:'0x9c52C2fFA611066858Cd2d8DB724c659B561c41D', color:'#00b4d8', grad:'135deg,#00b4d8,#00607a', icon:'W' };

export const toAddr = (tok) => tok.address === 'NATIVE' ? WTHEO : tok.address;

// ── ABIs ──────────────────────────────────────────────
export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export const FACTORY_ABI = [
  'function getPair(address,address) view returns (address)',
  'function allPairs(uint256) view returns (address)',
  'function allPairsLength() view returns (uint256)',
];

export const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
  'function allowance(address,address) view returns (uint256)',
];

export const ROUTER_ABI = [
  'function getAmountsOut(uint256,address[]) view returns (uint256[])',
  'function getAmountsIn(uint256,address[]) view returns (uint256[])',
  'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256) returns (uint256[])',
  'function swapExactTHEOForTokens(uint256,address[],address,uint256) payable returns (uint256[])',
  'function swapExactTokensForTHEO(uint256,uint256,address[],address,uint256) returns (uint256[])',
  'function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)',
  'function addLiquidityTHEO(address,uint256,uint256,uint256,address,uint256) payable returns (uint256,uint256,uint256)',
  'function removeLiquidity(address,address,uint256,uint256,uint256,address,uint256) returns (uint256,uint256)',
  'function removeLiquidityTHEO(address,uint256,uint256,uint256,address,uint256) returns (uint256,uint256)',
];

// ── Helpers ───────────────────────────────────────────
export const readRpc = () => new ethers.JsonRpcProvider(RPCS[0]);

export function fmtUnits(wei, decimals, dp = 5) {
  try {
    const n = parseFloat(ethers.formatUnits(String(wei), decimals));
    if (n === 0) return '0';
    if (n < 0.00001) return n.toExponential(3);
    return n.toFixed(n >= 1000 ? 2 : dp);
  } catch { return '0'; }
}

// Deadline 30 menit — beri ruang kalau network lambat
export const deadline = () => Math.floor(Date.now() / 1000) + 1800;

export async function getTokenBalance(tok, userAddr, provider) {
  try {
    if (tok.address === 'NATIVE') return await provider.getBalance(userAddr);
    const c = new ethers.Contract(tok.address, ERC20_ABI, provider);
    return await c.balanceOf(userAddr);
  } catch { return 0n; }
}

// ── Gas override — skip eth_estimateGas yang lambat ──
// Set gasLimit langsung → MetaMask popup muncul lebih cepat
export function fastGas(extraFields = {}) {
  return {
    gasLimit: 600000n,   // cukup untuk semua operasi DEX
    ...extraFields,
  };
}

// ── Allowance cache — hindari RPC call berulang ──────
const _allowanceCache = new Map(); // key: `tokenAddr-spender-user`

export async function ensureAllowance(tok, spender, amount, signer, userAddr) {
  if (tok.address === 'NATIVE') return;

  const key = `${tok.address}-${spender}-${userAddr}`.toLowerCase();

  // Pakai cache kalau sudah pernah approve MaxUint256
  if (_allowanceCache.has(key)) return;

  const c = new ethers.Contract(tok.address, ERC20_ABI, signer);
  const allowed = await c.allowance(userAddr, spender);

  if (allowed >= amount) {
    // Kalau sudah approve MaxUint256, cache-kan agar tidak cek lagi
    if (allowed >= ethers.MaxUint256 / 2n) _allowanceCache.set(key, true);
    return;
  }

  // Approve MaxUint256 dengan gasLimit langsung (skip estimateGas)
  const tx = await c.approve(spender, ethers.MaxUint256, fastGas());
  await tx.wait();
  _allowanceCache.set(key, true);
}

