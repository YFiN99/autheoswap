// src/components/TokenScanner.jsx
// Auto-scan wallet tokens → detect which ones have no pool on DEX
// Shows a persistent banner prompting user to create pool
import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { EXPLORER, FACTORY, WTHEO, FACTORY_ABI, fmtUnits } from '../utils/config';

const API = `${EXPLORER}/api/v2`;

async function apiFetch(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ── main component ────────────────────────────────────
export default function TokenScanner({ address, readProvider, onCreatePool }) {
  const [unlistedTokens, setUnlisted] = useState([]);
  const [dismissed,      setDismissed] = useState({});
  const [expanded,       setExpanded]  = useState(false);
  const scanned = useRef(false);

  const scan = useCallback(async () => {
    if (!address || scanned.current) return;
    scanned.current = true;

    try {
      // 1. Fetch all token balances from explorer
      const data = await apiFetch(`/addresses/${address}/token-balances`);
      const tokens = (data || []).filter(t =>
        t.token?.address &&
        t.token?.type === 'ERC-20' &&
        BigInt(t.value || '0') > 0n
      );

      if (tokens.length === 0) return;

      // 2. Check each token — does it have a WTHEO pair on our DEX?
      const provider = readProvider();
      const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

      const results = await Promise.all(
        tokens.map(async (t) => {
          try {
            const addr = t.token.address;
            const pair = await factory.getPair(addr, WTHEO);
            const hasPool = pair !== ethers.ZeroAddress;
            return {
              address:  addr,
              symbol:   t.token.symbol   || addr.slice(0,6),
              name:     t.token.name     || 'Unknown Token',
              decimals: parseInt(t.token.decimals || '18'),
              balance:  t.value,
              hasPool,
            };
          } catch { return null; }
        })
      );

      // 3. Only show tokens WITHOUT a pool
      const unlisted = results.filter(r => r && !r.hasPool);
      setUnlisted(unlisted);
    } catch { /* silent fail */ }
  }, [address, readProvider]);

  useEffect(() => {
    scanned.current = false; // reset on address change
    setUnlisted([]);
    setDismissed({});
    scan();
  }, [address, scan]);

  const visible = unlistedTokens.filter(t => !dismissed[t.address]);
  if (visible.length === 0) return null;

  return (
    <div style={S.banner}>
      {/* header */}
      <div style={S.bannerHdr} onClick={() => setExpanded(e => !e)}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={S.pulse}/>
          <span style={S.bannerTitle}>
            {visible.length} token{visible.length > 1 ? 's' : ''} in your wallet {visible.length > 1 ? 'have' : 'has'} no pool yet
          </span>
          <span style={S.badge}>NEW OPPORTUNITY</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#6b8aaa' }}>
            {expanded ? 'hide ▲' : 'show ▼'}
          </span>
        </div>
      </div>

      {/* token list */}
      {expanded && (
        <div style={S.list}>
          {visible.map(tok => (
            <TokenRow
              key={tok.address}
              tok={tok}
              onCreatePool={() => onCreatePool(tok)}
              onDismiss={() => setDismissed(d => ({ ...d, [tok.address]: true }))}
            />
          ))}
          <div style={S.hint}>
            💡 Creating a pool makes your token tradeable on AutheoSwap and earns you <b style={{ color:'#00d4ff' }}>0.3% fee</b> on every swap.
          </div>
        </div>
      )}
    </div>
  );
}

// ── single token row ──────────────────────────────────
function TokenRow({ tok, onCreatePool, onDismiss }) {
  const fmt = fmtUnits(tok.balance, tok.decimals);

  return (
    <div style={S.row}>
      {/* token avatar */}
      <div style={S.avatar}>
        {tok.symbol.slice(0,2).toUpperCase()}
      </div>

      {/* info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
          <span style={S.tokSym}>{tok.symbol}</span>
          <span style={S.noBadge}>NO POOL</span>
        </div>
        <div style={{ fontSize:11, color:'#6b8aaa' }}>
          Balance: <span style={{ color:'#e2f0ff', fontFamily:"'IBM Plex Mono',monospace" }}>{fmt}</span>
          {' · '}
          <span
            style={{ color:'#00d4ff', cursor:'pointer' }}
            onClick={() => window.open(`${EXPLORER}/token/${tok.address}`, '_blank')}
          >
            {tok.address.slice(0,8)}…
          </span>
        </div>
      </div>

      {/* actions */}
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button style={S.createBtn} onClick={onCreatePool}>
          + Create Pool
        </button>
        <button style={S.dismissBtn} onClick={onDismiss} title="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────
const S = {
  banner: {
    background:   'linear-gradient(135deg, rgba(0,212,255,.06), rgba(0,255,136,.04))',
    border:       '1px solid rgba(0,212,255,.2)',
    borderRadius: 14,
    overflow:     'hidden',
    marginBottom: 4,
  },
  bannerHdr: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '13px 16px',
    cursor:         'pointer',
    userSelect:     'none',
  },
  bannerTitle: {
    fontFamily: "'Unbounded',sans-serif",
    fontSize:   11,
    fontWeight: 700,
    color:      '#e2f0ff',
    letterSpacing: '.2px',
  },
  badge: {
    background:   'rgba(0,255,136,.12)',
    border:       '1px solid rgba(0,255,136,.3)',
    borderRadius: 20,
    padding:      '2px 8px',
    fontSize:     9,
    fontWeight:   700,
    color:        '#00ff88',
    letterSpacing: '.5px',
  },
  pulse: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    background:   '#00ff88',
    boxShadow:    '0 0 8px #00ff88',
    animation:    'blink 1.5s ease-in-out infinite',
    flexShrink:   0,
  },
  list: {
    borderTop:  '1px solid rgba(0,212,255,.1)',
    padding:    '8px 12px 12px',
    display:    'flex',
    flexDirection: 'column',
    gap:        6,
  },
  row: {
    display:      'flex',
    alignItems:   'center',
    gap:          12,
    background:   '#080f1a',
    border:       '1px solid #1a2d4a',
    borderRadius: 10,
    padding:      '10px 12px',
  },
  avatar: {
    width:          36,
    height:         36,
    borderRadius:   '50%',
    background:     'linear-gradient(135deg,#1a2d4a,#0c1624)',
    border:         '1px solid #2a4060',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       12,
    fontWeight:     700,
    color:          '#6b8aaa',
    fontFamily:     "'IBM Plex Mono',monospace",
    flexShrink:     0,
  },
  tokSym: {
    fontFamily: "'Unbounded',sans-serif",
    fontSize:   13,
    fontWeight: 700,
    color:      '#e2f0ff',
  },
  noBadge: {
    background:   'rgba(255,59,92,.1)',
    border:       '1px solid rgba(255,59,92,.25)',
    borderRadius: 4,
    padding:      '1px 6px',
    fontSize:     9,
    fontWeight:   700,
    color:        '#ff3b5c',
    letterSpacing: '.5px',
  },
  createBtn: {
    background:   'linear-gradient(135deg,#00d4ff,#0094cc)',
    border:       'none',
    borderRadius: 8,
    padding:      '7px 14px',
    fontSize:     11,
    fontWeight:   700,
    color:        '#04070d',
    cursor:       'pointer',
    fontFamily:   "'Unbounded',sans-serif",
    whiteSpace:   'nowrap',
  },
  dismissBtn: {
    background:   '#0c1624',
    border:       '1px solid #1a2d4a',
    borderRadius: 8,
    padding:      '7px 10px',
    fontSize:     12,
    color:        '#3d5a7a',
    cursor:       'pointer',
  },
  hint: {
    fontSize:     11,
    color:        '#3d5a7a',
    lineHeight:   1.7,
    padding:      '8px 12px',
    background:   'rgba(0,212,255,.04)',
    borderRadius: 8,
    marginTop:    4,
  },
};
