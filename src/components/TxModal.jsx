// src/components/TxModal.jsx — Uniswap-style toast, no blocking overlay
import { useEffect } from 'react';
import { EXPLORER } from '../utils/config';

export const TX = { IDLE:'idle', PENDING:'pending', MINING:'mining', OK:'ok', ERR:'err' };

export default function TxModal({ state, hash, msg, onClose }) {
  // Auto-dismiss on success after 5s
  useEffect(() => {
    if (state !== TX.OK) return;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [state, onClose]);

  if (state === TX.IDLE) return null;

  const cfg = {
    [TX.PENDING]: { icon:<Spin/>,  title:'Confirm in wallet', sub:'Check MetaMask',            accent:'#00d4ff', border:'#1a2d4a' },
    [TX.MINING]:  { icon:<Spin/>,  title:'Transaction sent',  sub:'Waiting for confirmation…', accent:'#00d4ff', border:'#1a2d4a', link:hash },
    [TX.OK]:      { icon:<Check/>, title:'Success',           sub:msg,                         accent:'#00ff88', border:'rgba(0,255,136,.2)', link:hash, closeable:true },
    [TX.ERR]:     { icon:<Err/>,   title:'Failed',            sub:(msg||'').slice(0,120),        accent:'#ff3b5c', border:'rgba(255,59,92,.2)', closeable:true },
  }[state];

  return (
    <div style={S.wrap}>
      <div style={{ ...S.toast, borderColor: cfg.border }}>
        <div style={S.track}>
          <div style={{
            ...S.bar,
            background: cfg.accent,
            ...(state === TX.OK  ? S.shrink : {}),
            ...(state === TX.ERR ? { width:'100%', animation:'none' } : {}),
          }}/>
        </div>
        <div style={S.body}>
          <div style={{ flexShrink:0, marginTop:1 }}>{cfg.icon}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ ...S.title, color: cfg.accent }}>{cfg.title}</div>
            {cfg.sub && <div style={S.sub}>{cfg.sub}</div>}
            {cfg.link && (
              <button style={S.link} onClick={() => window.open(`${EXPLORER}/tx/${cfg.link}`, '_blank')}>
                View on Explorer ↗
              </button>
            )}
          </div>
          {cfg.closeable && <button style={S.x} onClick={onClose}>✕</button>}
        </div>
      </div>
    </div>
  );
}

const Spin  = () => <div style={S.spin}/>;
const Check = () => (
  <div style={{ ...S.circle, background:'rgba(0,255,136,.12)', border:'1.5px solid #00ff88' }}>
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 6.5l3.5 3.5 5.5-6" stroke="#00ff88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);
const Err = () => (
  <div style={{ ...S.circle, background:'rgba(255,59,92,.12)', border:'1.5px solid #ff3b5c' }}>
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="#ff3b5c" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </div>
);

const S = {
  wrap:   { position:'fixed', bottom:24, right:24, zIndex:999, width:300, pointerEvents:'none' },
  toast:  { background:'#080f1a', border:'1px solid', borderRadius:14, overflow:'hidden', boxShadow:'0 8px 40px rgba(0,0,0,.6)', pointerEvents:'all', animation:'toastIn .3s cubic-bezier(.34,1.4,.64,1)' },
  track:  { height:3, background:'#0c1624', overflow:'hidden' },
  bar:    { height:'100%', width:'55%', animation:'barPulse 1.4s ease-in-out infinite' },
  shrink: { width:'100%', animation:'barShrink 5s linear forwards' },
  body:   { display:'flex', alignItems:'flex-start', gap:11, padding:'13px 14px 14px' },
  title:  { fontFamily:"'Unbounded',sans-serif", fontSize:11, fontWeight:700, letterSpacing:'.3px', marginBottom:3 },
  sub:    { fontSize:12, color:'#6b8aaa', lineHeight:1.5, wordBreak:'break-word' },
  link:   { background:'none', border:'none', padding:0, marginTop:5, fontSize:11, color:'#00d4ff', cursor:'pointer', fontFamily:"'IBM Plex Mono',monospace", display:'block' },
  x:      { background:'none', border:'none', color:'#3d5a7a', fontSize:14, cursor:'pointer', padding:0, flexShrink:0, marginTop:1, lineHeight:1 },
  circle: { width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' },
  spin:   { width:30, height:30, border:'2.5px solid #1a2d4a', borderTopColor:'#00d4ff', borderRadius:'50%', animation:'spin .7s linear infinite' },
};
