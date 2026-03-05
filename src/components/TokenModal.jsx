import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { TOKENS, ERC20_ABI, fmtUnits } from '../utils/config';
import TokenIcon from './TokenIcon';

export default function TokenModal({ open, onClose, onSelect, address, provider }) {
  const [q,    setQ]    = useState('');
  const [bals, setBals] = useState({});

  useEffect(() => {
    if (!open) return;
    setQ('');
    if (!address || !provider) return;
    TOKENS.forEach(async (t) => {
      try {
        const b = t.address === 'NATIVE'
          ? await provider.getBalance(address)
          : await new ethers.Contract(t.address, ERC20_ABI, provider).balanceOf(address);
        setBals(p => ({ ...p, [t.symbol]: b }));
      } catch {}
    });
  }, [open, address, provider]);

  if (!open) return null;

  const list = TOKENS.filter(t =>
    !q || t.symbol.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* header */}
        <div style={S.hdr}>
          <span style={S.hdrTitle}>SELECT TOKEN</span>
          <button style={S.xBtn} onClick={onClose}>✕</button>
        </div>

        {/* search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #132035' }}>
          <input
            autoFocus style={S.searchInp} placeholder="Search name or address…"
            value={q} onChange={e => setQ(e.target.value)}
          />
        </div>

        {/* common chips */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #132035' }}>
          <div style={{ fontSize: 11, color: '#3d5a7a', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>COMMON</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TOKENS.slice(0, 5).map(t => (
              <button key={t.symbol} style={S.chip} onClick={() => { onSelect(t); onClose(); }}>
                <TokenIcon tok={t} size={20} /> {t.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {list.map(t => (
            <div key={t.symbol} style={S.row}
              onMouseEnter={e => e.currentTarget.style.background = '#0c1624'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { onSelect(t); onClose(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <TokenIcon tok={t} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#e2f0ff' }}>{t.symbol}</div>
                  <div style={{ fontSize: 11, color: '#3d5a7a', marginTop: 2 }}>{t.name}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#6b8aaa', fontFamily: "'IBM Plex Mono',monospace" }}>
                {bals[t.symbol] !== undefined ? fmtUnits(bals[t.symbol], t.decimals) : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay:   { position:'fixed',inset:0,background:'rgba(4,7,13,.88)',backdropFilter:'blur(14px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center' },
  modal:     { background:'#080f1a',border:'1px solid #1a2d4a',borderRadius:16,width:440,maxHeight:'78vh',display:'flex',flexDirection:'column',overflow:'hidden' },
  hdr:       { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 18px',borderBottom:'1px solid #132035' },
  hdrTitle:  { fontFamily:"'Unbounded',sans-serif",fontSize:14,fontWeight:700,color:'#e2f0ff' },
  xBtn:      { background:'#0c1624',border:'1px solid #132035',borderRadius:7,width:30,height:30,cursor:'pointer',color:'#6b8aaa',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center' },
  searchInp: { width:'100%',background:'#0c1624',border:'1px solid #132035',borderRadius:9,padding:'10px 13px',color:'#e2f0ff',fontFamily:"'IBM Plex Mono',monospace",fontSize:14,outline:'none',boxSizing:'border-box' },
  chip:      { display:'flex',alignItems:'center',gap:6,background:'#0c1624',border:'1px solid #132035',borderRadius:8,padding:'5px 11px',cursor:'pointer',fontSize:13,fontWeight:700,color:'#e2f0ff',fontFamily:"'IBM Plex Mono',monospace" },
  row:       { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px',cursor:'pointer',transition:'.15s' },
};
