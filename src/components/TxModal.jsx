/* global BigInt */
import React from 'react';
import { EXPLORER } from '../utils/config';

export const TX = { IDLE:'idle', PENDING:'pending', MINING:'mining', OK:'ok', ERR:'err' };

export default function TxModal({ state, hash, msg, onClose }) {
  if (state === TX.IDLE) return null;

  const body = {
    [TX.PENDING]: () => <><Spin/><T>Confirm in wallet…</T><D>Check MetaMask</D></>,
    [TX.MINING]:  () => <><Spin/><T>Broadcasting…</T><D>Waiting for block confirmation</D>{hash && <Hash h={hash}/>}</>,
    [TX.OK]:      () => <><Big>✅</Big><T>Success!</T><D style={{color:'#00ff88'}}>{msg}</D>{hash && <Hash h={hash} label="View on Explorer ↗"/>}<Btn onClick={onClose}>Close</Btn></>,
    [TX.ERR]:     () => <><Big>❌</Big><T>Failed</T><D style={{color:'#ff3b5c'}}>{(msg||'').slice(0,200)}</D><Btn onClick={onClose}>Close</Btn></>,
  }[state];

  return (
    <div style={S.overlay} onClick={state === TX.OK || state === TX.ERR ? onClose : undefined}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.hdr}>
          <span style={S.title}>TRANSACTION</span>
          <button style={S.x} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:'28px 20px', textAlign:'center' }}>{body()}</div>
      </div>
    </div>
  );
}

const Spin = () => <div style={S.spin}/>;
const Big  = ({ children }) => <div style={{ fontSize:48, marginBottom:14 }}>{children}</div>;
const T    = ({ children }) => <div style={S.t}>{children}</div>;
const D    = ({ children, style }) => <div style={{ ...S.d, ...style }}>{children}</div>;
const Hash = ({ h, label }) => (
  <div style={S.hash} onClick={() => window.open(`${EXPLORER}/tx/${h}`, '_blank')}>
    {label || h}
  </div>
);
const Btn  = ({ children, onClick }) => <button style={S.btn} onClick={onClick}>{children}</button>;

const S = {
  overlay: { position:'fixed',inset:0,background:'rgba(4,7,13,.9)',backdropFilter:'blur(14px)',zIndex:600,display:'flex',alignItems:'center',justifyContent:'center' },
  modal:   { background:'#080f1a',border:'1px solid #1a2d4a',borderRadius:16,width:360,overflow:'hidden' },
  hdr:     { display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid #132035' },
  title:   { fontFamily:"'Unbounded',sans-serif",fontSize:13,fontWeight:700,color:'#e2f0ff' },
  x:       { background:'#0c1624',border:'1px solid #132035',borderRadius:7,width:28,height:28,cursor:'pointer',color:'#6b8aaa',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' },
  spin:    { width:48,height:48,border:'3px solid #1a2d4a',borderTopColor:'#00d4ff',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 20px' },
  t:       { fontFamily:"'Unbounded',sans-serif",fontSize:18,fontWeight:700,marginBottom:8,color:'#e2f0ff' },
  d:       { fontSize:13,color:'#6b8aaa',lineHeight:1.7,marginBottom:14 },
  hash:    { background:'#0c1624',border:'1px solid #1a2d4a',borderRadius:9,padding:'10px 14px',fontSize:11,color:'#00d4ff',wordBreak:'break-all',cursor:'pointer',marginBottom:14 },
  btn:     { width:'100%',padding:'13px',border:'none',borderRadius:10,background:'linear-gradient(135deg,#00d4ff,#0094cc)',color:'#04070d',fontFamily:"'Unbounded',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer' }
};