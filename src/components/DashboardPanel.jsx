// src/components/DashboardPanel.jsx v2
// Memanfaatkan Autheo Explorer API (Blockscout-compatible)
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { EXPLORER, TOKENS, CONTRACTS, fmtUnits } from '../utils/config';
import TokenIcon from './TokenIcon';

const API = `${EXPLORER}/api/v2`;

const TOK_WTHEO = { symbol:'WTHEO', name:'Wrapped THEO', decimals:18, address:'0x9c52C2fFA611066858Cd2d8DB724c659B561c41D', grad:'135deg,#00b4d8,#00607a', icon:'W' };
const ALL_TOKS  = [...TOKENS, TOK_WTHEO];

async function apiFetch(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// ── helpers ───────────────────────────────────────────
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function shortAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0,6)}…${addr.slice(-4)}`;
}

function findTok(addr) {
  if (!addr) return null;
  return ALL_TOKS.find(t => t.address.toLowerCase() === addr.toLowerCase()) || null;
}

// ══════════════════════════════════════════════════════
export default function DashboardPanel({ address, readProvider }) {
  const [tab, setTab] = useState('portfolio');

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* sub tabs */}
      <div style={S.tabRow}>
        {['portfolio','history','pools','network'].map(t => (
          <button key={t}
            style={{ ...S.tab, ...(tab===t ? S.tabActive:{}) }}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && <Portfolio address={address} />}
      {tab === 'history'   && <TxHistory  address={address} />}
      {tab === 'pools'     && <Pools />}
      {tab === 'network'   && <Network />}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  PORTFOLIO — token balances via explorer API
// ══════════════════════════════════════════════════════
function Portfolio({ address }) {
  const [balances, setBalances] = useState([]);
  const [native,   setNative]   = useState(null);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      apiFetch(`/addresses/${address}`),
      apiFetch(`/addresses/${address}/token-balances`),
    ]).then(([info, toks]) => {
      // native balance
      setNative(info.coin_balance || '0');
      // only show tokens we know
      const known = (toks || []).filter(t =>
        findTok(t.token?.address)
      ).map(t => ({
        tok:     findTok(t.token.address),
        balance: t.value,
        decimals: parseInt(t.token.decimals || '18'),
      }));
      setBalances(known);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [address]);

  if (!address) return <Empty icon="👛" text="Connect wallet to view portfolio" />;

  return (
    <div style={S.card}>
      <div style={S.hdr}><span style={S.hdrTitle}>PORTFOLIO</span></div>
      <div style={{ padding:'14px 16px' }}>
        {loading && <Loader />}
        {!loading && (
          <>
            {/* native THEO */}
            {native && (
              <BalRow
                tok={{ symbol:'THEO', grad:'135deg,#00d4ff,#005f99', icon:'T', decimals:18 }}
                balance={native} decimals={18}
              />
            )}
            {balances.map((b, i) => (
              <BalRow key={i} tok={b.tok} balance={b.balance} decimals={b.tok.decimals} />
            ))}
            {!loading && balances.length === 0 && !native && (
              <Empty icon="💰" text="No tokens found" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BalRow({ tok, balance, decimals }) {
  const fmt = fmtUnits(balance, decimals);
  return (
    <div style={S.balRow}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <TokenIcon tok={tok} size={32}/>
        <div>
          <div style={{ fontWeight:700, fontSize:14, color:'#e2f0ff' }}>{tok.symbol}</div>
          <div style={{ fontSize:11, color:'#3d5a7a' }}>{tok.name || ''}</div>
        </div>
      </div>
      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontWeight:700, fontSize:14, color:'#e2f0ff' }}>
        {fmt}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  TX HISTORY — recent transactions
// ══════════════════════════════════════════════════════
function TxHistory({ address }) {
  const [txs,     setTxs]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState('all'); // 'all' | 'swap' | 'liquidity'

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const [txData, tokenData] = await Promise.all([
        apiFetch(`/addresses/${address}/transactions?filter=to%20%7C%20from&limit=20`),
        apiFetch(`/addresses/${address}/token-transfers?limit=20`),
      ]);

      const combined = [
        ...(txData.items || []).map(tx => ({ ...tx, _type:'tx' })),
      ];

      // merge token transfers info
      const transferMap = {};
      (tokenData.items || []).forEach(t => {
        transferMap[t.tx_hash] = t;
      });

      const enriched = combined.map(tx => ({
        ...tx,
        transfer: transferMap[tx.hash],
      }));

      setTxs(enriched);
    } catch { setTxs([]); }
    finally  { setLoading(false); }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  if (!address) return <Empty icon="📋" text="Connect wallet to view history" />;

  const filtered = txs.filter(tx => {
    if (filter === 'all') return true;
    const to = tx.to?.hash?.toLowerCase() || '';
    if (filter === 'swap')      return to === CONTRACTS.router.toLowerCase() && tx.method?.includes('swap');
    if (filter === 'liquidity') return to === CONTRACTS.router.toLowerCase() && (tx.method?.includes('add') || tx.method?.includes('remove'));
    return true;
  });

  return (
    <div style={S.card}>
      <div style={S.hdr}>
        <span style={S.hdrTitle}>TX HISTORY</span>
        <button style={S.refreshBtn} onClick={load}>↻</button>
      </div>
      {/* filter chips */}
      <div style={{ display:'flex', gap:6, padding:'10px 16px', borderBottom:'1px solid #132035' }}>
        {['all','swap','liquidity'].map(f => (
          <button key={f}
            style={{ ...S.chip, ...(filter===f ? S.chipActive:{}) }}
            onClick={() => setFilter(f)}
          >{f.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ maxHeight:380, overflowY:'auto' }}>
        {loading && <Loader />}
        {!loading && filtered.length === 0 && <Empty icon="📭" text="No transactions found" />}
        {!loading && filtered.map((tx, i) => <TxRow key={i} tx={tx} address={address} />)}
      </div>
    </div>
  );
}

function TxRow({ tx, address }) {
  const isOut  = tx.from?.hash?.toLowerCase() === address?.toLowerCase();
  const method = tx.method || 'transfer';
  const status = tx.status === 'ok' ? 'ok' : tx.status === 'error' ? 'err' : 'pending';
  const statusColor = { ok:'#00ff88', err:'#ff3b5c', pending:'#ffd600' }[status];

  const label = () => {
    if (method.includes('swap'))           return '🔄 Swap';
    if (method.includes('addLiquidity'))   return '💧 Add Liquidity';
    if (method.includes('removeLiquidity'))return '💸 Remove Liquidity';
    if (method.includes('deposit'))        return '⬇ Wrap';
    if (method.includes('withdraw'))       return '⬆ Unwrap';
    if (method.includes('approve'))        return '✅ Approve';
    return '📝 ' + method.slice(0, 18);
  };

  return (
    <div
      style={S.txRow}
      onMouseEnter={e => e.currentTarget.style.background='#0c1624'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
      onClick={() => window.open(`${EXPLORER}/tx/${tx.hash}`, '_blank')}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#e2f0ff' }}>{label()}</span>
          <span style={{ fontSize:10, color: statusColor, fontWeight:700 }}>
            {status === 'ok' ? '✓' : status === 'err' ? '✗' : '⏳'}
          </span>
        </div>
        <div style={{ fontSize:11, color:'#3d5a7a', fontFamily:"'IBM Plex Mono',monospace" }}>
          {shortAddr(tx.hash)} · {tx.timestamp ? timeAgo(tx.timestamp) : '—'}
        </div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        {tx.value && tx.value !== '0' && (
          <div style={{ fontSize:12, fontWeight:700, color: isOut?'#ff3b5c':'#00ff88', fontFamily:"'IBM Plex Mono',monospace" }}>
            {isOut?'-':'+'}{fmtUnits(tx.value, 18)} THEO
          </div>
        )}
        <div style={{ fontSize:10, color:'#3d5a7a' }}>↗ explorer</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  POOLS — token info for our pool tokens
// ══════════════════════════════════════════════════════
function Pools() {
  const [pools,   setPools]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poolTokens = [
      { label:'WTHEO/USDT', addr:'0x0364FE5d7b95a7B1eF26aD29D49274fbDF8581C9' },
      { label:'WTHEO/USDC', addr:'0xe47Dc953aB1146028190716FdC0b8EfB3297B2cd' },
      { label:'WTHEO/WBTC', addr:'0x788F70be3FbA2Cc18A7489152787430a29E0FC00' },
      { label:'WTHEO/WETH', addr:'0x49f15A035FA7DC901914108d028bA41AF7679E65' },
    ];

    Promise.all(
      poolTokens.map(async p => {
        try {
          const [info, counters] = await Promise.all([
            apiFetch(`/tokens/${p.addr}`),
            apiFetch(`/tokens/${p.addr}/counters`),
          ]);
          return {
            ...p,
            totalSupply: info.total_supply,
            decimals:    parseInt(info.decimals || '18'),
            transfers:   counters.transfers_count,
            holders:     counters.token_holders_count,
          };
        } catch { return { ...p, totalSupply:'—', transfers:'—', holders:'—' }; }
      })
    ).then(setPools).finally(() => setLoading(false));
  }, []);

  return (
    <div style={S.card}>
      <div style={S.hdr}><span style={S.hdrTitle}>LIQUIDITY POOLS</span></div>
      <div style={{ padding:'14px 16px' }}>
        {loading && <Loader />}
        {!loading && pools.map((p, i) => (
          <div key={i} style={S.poolRow}
            onClick={() => window.open(`${EXPLORER}/token/${p.addr}`, '_blank')}
            onMouseEnter={e => e.currentTarget.style.background='#0c1624'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'#e2f0ff', marginBottom:4 }}>{p.label}</div>
              <div style={{ fontSize:11, color:'#3d5a7a', fontFamily:"'IBM Plex Mono',monospace" }}>
                LP supply: {p.totalSupply !== '—' ? fmtUnits(p.totalSupply, p.decimals) : '—'}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:12, color:'#00d4ff', fontWeight:700 }}>{p.transfers || '—'} txs</div>
              <div style={{ fontSize:11, color:'#3d5a7a' }}>{p.holders || '—'} holders</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  NETWORK — chain stats
// ══════════════════════════════════════════════════════
function Network() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/stats')
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={S.card}>
      <div style={S.hdr}><span style={S.hdrTitle}>NETWORK STATS</span></div>
      <div style={{ padding:'14px 16px' }}>
        {loading && <Loader />}
        {!loading && !stats && <Empty icon="📡" text="Could not load network stats" />}
        {!loading && stats && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <StatBox label="Total Blocks"      val={Number(stats.total_blocks||0).toLocaleString()} />
            <StatBox label="Total Txs"         val={Number(stats.total_transactions||0).toLocaleString()} />
            <StatBox label="Avg Block Time"    val={stats.average_block_time ? `${(stats.average_block_time/1000).toFixed(1)}s` : '—'} />
            <StatBox label="Total Addresses"   val={Number(stats.total_addresses||0).toLocaleString()} />
            <StatBox label="Gas Price"         val={stats.gas_prices?.average ? `${stats.gas_prices.average} Gwei` : '—'} />
            <StatBox label="Network Util."     val={stats.network_utilization_percentage ? `${parseFloat(stats.network_utilization_percentage).toFixed(1)}%` : '—'} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, val }) {
  return (
    <div style={S.statBox}>
      <div style={{ fontSize:10, color:'#3d5a7a', fontWeight:700, letterSpacing:'.5px', marginBottom:5 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#00d4ff', fontFamily:"'IBM Plex Mono',monospace" }}>{val}</div>
    </div>
  );
}

// ── shared sub-components ─────────────────────────────
const Loader = () => (
  <div style={{ textAlign:'center', padding:'28px 0', color:'#3d5a7a' }}>
    <div style={S.spin}/>Loading…
  </div>
);

const Empty = ({ icon, text }) => (
  <div style={{ textAlign:'center', padding:'32px 0', color:'#3d5a7a' }}>
    <div style={{ fontSize:32, marginBottom:8 }}>{icon}</div>{text}
  </div>
);

// ── styles ────────────────────────────────────────────
const S = {
  card:       { background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:16, overflow:'hidden' },
  hdr:        { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 18px', borderBottom:'1px solid #132035' },
  hdrTitle:   { fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:700, color:'#e2f0ff' },
  refreshBtn: { background:'#0c1624', border:'1px solid #132035', borderRadius:7, padding:'5px 11px', cursor:'pointer', color:'#6b8aaa', fontSize:14 },
  tabRow:     { display:'flex', gap:2, background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:10, padding:3 },
  tab:        { flex:1, padding:'9px 0', borderRadius:7, border:'none', background:'transparent', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer', transition:'.2s', letterSpacing:'.5px' },
  tabActive:  { background:'#00d4ff', color:'#04070d' },
  balRow:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 0', borderBottom:'1px solid #0c1624' },
  txRow:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 16px', cursor:'pointer', transition:'.15s', borderBottom:'1px solid #0c1624' },
  poolRow:    { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #0c1624', cursor:'pointer', transition:'.15s', borderRadius:8 },
  statBox:    { background:'#0c1624', border:'1px solid #132035', borderRadius:10, padding:'12px 14px' },
  chip:       { padding:'5px 12px', borderRadius:7, border:'1px solid #132035', background:'#0c1624', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer' },
  chipActive: { borderColor:'#00d4ff', color:'#00d4ff', background:'rgba(0,212,255,.08)' },
  spin:       { width:28, height:28, border:'3px solid #132035', borderTopColor:'#00d4ff', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' },
};
