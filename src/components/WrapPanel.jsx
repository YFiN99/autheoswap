// src/components/WrapPanel.jsx
// Wrap THEO → WTHEO dan Unwrap WTHEO → THEO (selalu 1:1)
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { WTHEO, ERC20_ABI, fmtUnits, getTokenBalance, fastGas } from '../utils/config';
import TxModal, { TX } from './TxModal';
import TokenIcon from './TokenIcon';

const WTHEO_ABI = [
  'function deposit() payable',
  'function withdraw(uint256) ',
  'function balanceOf(address) view returns (uint256)',
];

const TOK_THEO  = { symbol:'THEO',  name:'Autheo',        decimals:18, address:'NATIVE',  color:'#00d4ff', grad:'135deg,#00d4ff,#005f99', icon:'T' };
const TOK_WTHEO = { symbol:'WTHEO', name:'Wrapped THEO',  decimals:18, address: WTHEO,    color:'#00b4d8', grad:'135deg,#00b4d8,#00607a', icon:'W' };

export default function WrapPanel({ signer, address, readProvider }) {
  const [mode,    setMode]    = useState('wrap');   // 'wrap' | 'unwrap'
  const [amt,     setAmt]     = useState('');
  const [balNat,  setBalNat]  = useState('—');
  const [balW,    setBalW]    = useState('—');
  const [balNatR, setBalNatR] = useState(0n);
  const [balWR,   setBalWR]   = useState(0n);
  const [tx,      setTx]      = useState({ state: TX.IDLE, hash:'', msg:'' });
  const [busy,    setBusy]    = useState(false);

  const loadBals = useCallback(async () => {
    if (!address) return;
    const p = readProvider();
    const nat = await p.getBalance(address);
    const w   = await new ethers.Contract(WTHEO, ERC20_ABI, p).balanceOf(address);
    setBalNatR(nat); setBalNat(fmtUnits(nat, 18));
    setBalWR(w);     setBalW(fmtUnits(w, 18));
  }, [address, readProvider]);

  useEffect(() => { loadBals(); }, [loadBals]);

  const isWrap   = mode === 'wrap';
  const tokIn    = isWrap ? TOK_THEO  : TOK_WTHEO;
  const tokOut   = isWrap ? TOK_WTHEO : TOK_THEO;
  const balInRaw = isWrap ? balNatR   : balWR;
  const balIn    = isWrap ? balNat    : balW;
  const balOut   = isWrap ? balW      : balNat;

  const setMax = () => {
    let b = balInRaw;
    if (isWrap) {
      const gas = ethers.parseEther('0.05');
      b = b > gas ? b - gas : 0n;
    }
    setAmt(parseFloat(ethers.formatEther(b)).toFixed(6));
  };

  const doTx = async () => {
    if (!signer || !amt || parseFloat(amt) <= 0) return;
    setBusy(true);
    setTx({ state: TX.PENDING, hash:'', msg:'' });
    try {
      const contract = new ethers.Contract(WTHEO, WTHEO_ABI, signer);
      const wei = ethers.parseEther(amt);
      let txr;

      if (isWrap) {
        txr = await contract.deposit({ ...fastGas({ gasLimit: 80000n }), value: wei });
      } else {
        txr = await contract.withdraw(wei, fastGas({ gasLimit: 80000n }));
      }

      setTx({ state: TX.MINING, hash: txr.hash, msg:'' });
      const receipt = await txr.wait();
      setTx({
        state: TX.OK,
        hash:  receipt.hash,
        msg:   isWrap
          ? `Wrapped ${amt} THEO → ${amt} WTHEO`
          : `Unwrapped ${amt} WTHEO → ${amt} THEO`,
      });
      setAmt('');
      await loadBals();
    } catch(e) {
      setTx({ state: TX.ERR, hash:'', msg: e.reason || e.shortMessage || e.message });
    } finally { setBusy(false); }
  };

  const btnOk = address && amt && parseFloat(amt) > 0;

  return (
    <div style={S.card}>
      <div style={S.hdr}>
        <span style={S.hdrTitle}>WRAP / UNWRAP</span>
        <div style={S.badge}>1 : 1</div>
      </div>

      <div style={{ padding:'16px 18px' }}>
        <div style={S.infoBox}>
          <b style={{ color:'#00d4ff' }}>THEO</b> adalah native coin.{' '}
          <b style={{ color:'#00d4ff' }}>WTHEO</b> adalah versi ERC-20-nya.<br/>
          Wrap/unwrap selalu <b style={{ color:'#00ff88' }}>1 : 1</b>, tidak ada fee.
        </div>

        {/* mode toggle */}
        <div style={S.modeRow}>
          <button style={{ ...S.modeBtn, ...(isWrap  ? S.modeActive:{}) }} onClick={() => { setMode('wrap');   setAmt(''); }}>
            WRAP
          </button>
          <button style={{ ...S.modeBtn, ...(!isWrap ? S.modeActive:{}) }} onClick={() => { setMode('unwrap'); setAmt(''); }}>
            UNWRAP
          </button>
        </div>

        {/* input */}
        <div style={S.tbox}>
          <div style={S.tboxTop}>
            <span style={{ color:'#3d5a7a' }}>YOU PAY</span>
            <span style={{ color:'#6b8aaa', cursor:'pointer' }} onClick={setMax}>
              Balance: {balIn} MAX
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input
              style={S.amtInp} type="number" placeholder="0.0"
              value={amt} onChange={e => setAmt(e.target.value)}
            />
            <div style={S.tokDisplay}>
              <TokenIcon tok={tokIn} size={26}/>
              <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, color:'#e2f0ff' }}>
                {tokIn.symbol}
              </span>
            </div>
          </div>
        </div>

        {/* arrow */}
        <div style={{ textAlign:'center', fontSize:20, color:'#00d4ff', padding:'6px 0' }}>↓</div>

        {/* output (always same amount) */}
        <div style={{ ...S.tbox, opacity:.75 }}>
          <div style={S.tboxTop}>
            <span style={{ color:'#3d5a7a' }}>YOU RECEIVE</span>
            <span style={{ color:'#6b8aaa' }}>Balance: {balOut}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input
              style={{ ...S.amtInp, color:'#6b8aaa' }}
              type="number" placeholder="0.0"
              value={amt} readOnly
            />
            <div style={S.tokDisplay}>
              <TokenIcon tok={tokOut} size={26}/>
              <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, color:'#e2f0ff' }}>
                {tokOut.symbol}
              </span>
            </div>
          </div>
        </div>

        <button
          style={{ ...S.actBtn, ...(btnOk ? S.primaryBtn : S.disabledBtn) }}
          disabled={!btnOk || busy}
          onClick={doTx}
        >
          {busy
            ? <span style={S.btnSpin}/>
            : isWrap ? `WRAP THEO → WTHEO` : `UNWRAP WTHEO → THEO`
          }
        </button>
      </div>

      <TxModal {...tx} onClose={() => setTx({ state: TX.IDLE, hash:'', msg:'' })} />
    </div>
  );
}

const S = {
  card:       { background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:16, overflow:'hidden' },
  hdr:        { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 18px', borderBottom:'1px solid #132035' },
  hdrTitle:   { fontFamily:"'Unbounded',sans-serif", fontSize:15, fontWeight:700, color:'#e2f0ff' },
  badge:      { background:'rgba(0,255,136,.1)', border:'1px solid rgba(0,255,136,.3)', borderRadius:20, padding:'4px 12px', fontSize:12, fontWeight:700, color:'#00ff88', fontFamily:"'IBM Plex Mono',monospace" },
  infoBox:    { background:'rgba(0,212,255,.05)', border:'1px solid rgba(0,212,255,.12)', borderRadius:10, padding:'11px 14px', marginBottom:14, fontSize:12, color:'#6b8aaa', lineHeight:1.7 },
  modeRow:    { display:'flex', gap:3, background:'#0c1624', border:'1px solid #132035', borderRadius:10, padding:3, marginBottom:14 },
  modeBtn:    { flex:1, padding:'9px 0', borderRadius:7, border:'none', background:'transparent', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:13, fontWeight:700, cursor:'pointer', transition:'.2s', letterSpacing:'.5px' },
  modeActive: { background:'#00d4ff', color:'#04070d' },
  tbox:       { background:'#0c1624', border:'1px solid #132035', borderRadius:12, padding:'14px 16px', marginBottom:4 },
  tboxTop:    { display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700, letterSpacing:'.5px', marginBottom:10 },
  amtInp:     { background:'none', border:'none', outline:'none', fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:700, color:'#e2f0ff', width:'100%', minWidth:0 },
  tokDisplay: { display:'flex', alignItems:'center', gap:8, background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:10, padding:'8px 12px', whiteSpace:'nowrap', minWidth:120 },
  actBtn:     { width:'100%', padding:15, border:'none', borderRadius:12, fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.3px', marginTop:12, display:'flex', alignItems:'center', justifyContent:'center' },
  primaryBtn: { background:'linear-gradient(135deg,#00d4ff,#0094cc)', color:'#04070d' },
  disabledBtn:{ background:'#0c1624', border:'1px solid #132035', color:'#3d5a7a', cursor:'not-allowed' },
  btnSpin:    { width:16, height:16, border:'2px solid rgba(0,0,0,.3)', borderTopColor:'#04070d', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' },
};
