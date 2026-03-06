import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  TOKENS, FACTORY, ROUTER, WTHEO,
  FACTORY_ABI, PAIR_ABI, ROUTER_ABI, ERC20_ABI,
  toAddr, fmtUnits, getTokenBalance, ensureAllowance, fastGas, deadline,
} from '../utils/config';
import TokenModal from './TokenModal';
import TxModal, { TX } from './TxModal';
import TokenIcon from './TokenIcon';

export default function SwapPanel({ signer, address, readProvider }) {
  const [tokIn,  setTokIn]  = useState(TOKENS[0]);   // THEO
  const [tokOut, setTokOut] = useState(TOKENS[2]);   // USDT
  const [amtIn,  setAmtIn]  = useState('');
  const [amtOut, setAmtOut] = useState('');
  const [balIn,  setBalIn]  = useState('—');
  const [balOut, setBalOut] = useState('—');
  const [slip,   setSlip]   = useState(0.5);
  const [slipOpen,setSlipOpen] = useState(false);
  const [route,  setRoute]  = useState(null);
  const [impact, setImpact] = useState(null);
  const [tokModal,setTokModal] = useState(false);
  const [side,   setSide]   = useState('in');
  const [tx,     setTx]     = useState({ state: TX.IDLE, hash:'', msg:'' });
  const [busy,   setBusy]   = useState(false);

  // load balance
  const loadBal = useCallback(async (tok, setter) => {
    if (!address) { setter('—'); return; }
    const p = readProvider();
    const b = await getTokenBalance(tok, address, p);
    setter(fmtUnits(b, tok.decimals));
  }, [address, readProvider]);

  useEffect(() => { loadBal(tokIn,  setBalIn);  }, [tokIn,  loadBal]);
  useEffect(() => { loadBal(tokOut, setBalOut); }, [tokOut, loadBal]);

  // calc output
  const calcOut = useCallback(async (val, tIn = tokIn, tOut = tokOut) => {
    setAmtOut(''); setRoute(null); setImpact(null);
    if (!val || parseFloat(val) <= 0) return;
    if (toAddr(tIn) === toAddr(tOut)) return;
    try {
      const p       = readProvider();
      const router  = new ethers.Contract(ROUTER, ROUTER_ABI, p);
      const inWei   = ethers.parseUnits(val, tIn.decimals);
      const path    = [toAddr(tIn), toAddr(tOut)];
      const amounts = await router.getAmountsOut(inWei, path);
      const outWei  = amounts[1];
      const outFmt  = parseFloat(ethers.formatUnits(outWei, tOut.decimals));
      setAmtOut(outFmt.toFixed(6));

      // price impact
      const factory = new ethers.Contract(FACTORY, FACTORY_ABI, p);
      const pa = await factory.getPair(toAddr(tIn), toAddr(tOut));
      if (pa !== ethers.ZeroAddress) {
        const pair = new ethers.Contract(pa, PAIR_ABI, p);
        const [r0, r1] = await pair.getReserves();
        const t0 = await pair.token0();
        const rIn  = t0.toLowerCase() === toAddr(tIn).toLowerCase()  ? r0 : r1;
        const pi   = parseFloat(inWei) / (parseFloat(rIn) + parseFloat(inWei)) * 100;
        setImpact(pi);
      }
      setRoute({
        rate:   `1 ${tIn.symbol} = ${(outFmt / parseFloat(val)).toFixed(6)} ${tOut.symbol}`,
        minOut: (outFmt * (1 - slip / 100)).toFixed(6),
        fee:    (parseFloat(val) * 0.003).toFixed(6),
      });
    } catch { /* no pair */ }
  }, [tokIn, tokOut, slip, readProvider]);

  const handleAmtIn = (v) => { setAmtIn(v); calcOut(v); };

  const flip = () => {
    const [a, b] = [tokOut, tokIn];
    setTokIn(a); setTokOut(b);
    setAmtIn(amtOut); setAmtOut('');
    setRoute(null); setImpact(null);
    calcOut(amtOut, a, b);
  };

  const openTokModal = (s) => { setSide(s); setTokModal(true); };
  const selectTok = (tok) => {
    if (side === 'in') {
      if (toAddr(tok) === toAddr(tokOut)) setTokOut(tokIn);
      setTokIn(tok);
    } else {
      if (toAddr(tok) === toAddr(tokIn)) setTokIn(tokOut);
      setTokOut(tok);
    }
    setAmtOut(''); setRoute(null); setImpact(null);
  };

  const setMax = async () => {
    if (!address) return;
    const p = readProvider();
    let b = await getTokenBalance(tokIn, address, p);
    if (tokIn.address === 'NATIVE') {
      const gas = ethers.parseEther('0.05');
      b = b > gas ? b - gas : 0n;
    }
    const v = fmtUnits(b, tokIn.decimals);
    setAmtIn(v); calcOut(v);
  };

  const doSwap = async () => {
    if (!signer || !amtIn || !amtOut) return;
    setBusy(true);
    setTx({ state: TX.PENDING, hash:'', msg:'' });
    try {
      const router  = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
      const inWei   = ethers.parseUnits(amtIn, tokIn.decimals);
      const minWei  = ethers.parseUnits((parseFloat(amtOut) * (1 - slip/100)).toFixed(tokOut.decimals), tokOut.decimals);
      const dl      = deadline();
      const path    = [toAddr(tokIn), toAddr(tokOut)];
      const isNatIn = tokIn.address  === 'NATIVE';
      const isNatOut= tokOut.address === 'NATIVE';
      const gas     = fastGas();

      let tx;
      if (isNatIn) {
        tx = await router.swapExactTHEOForTokens(minWei, path, address, dl, { ...gas, value: inWei });
      } else {
        await ensureAllowance(tokIn, ROUTER, inWei, signer, address);
        if (isNatOut)  tx = await router.swapExactTokensForTHEO(inWei, minWei, path, address, dl, gas);
        else           tx = await router.swapExactTokensForTokens(inWei, minWei, path, address, dl, gas);
      }

      setTx({ state: TX.MINING, hash: tx.hash, msg:'' });
      const receipt = await tx.wait();
      setTx({ state: TX.OK, hash: receipt.hash, msg: `Swapped ${amtIn} ${tokIn.symbol} → ${parseFloat(amtOut).toFixed(4)} ${tokOut.symbol}` });
      setAmtIn(''); setAmtOut(''); setRoute(null);
      loadBal(tokIn, setBalIn); loadBal(tokOut, setBalOut);
    } catch(e) {
      setTx({ state: TX.ERR, hash:'', msg: e.reason || e.shortMessage || e.message });
    } finally { setBusy(false); }
  };

  // button state
  const btnState = () => {
    if (!address)                      return ['CONNECT WALLET',        'outline'];
    if (!amtIn || parseFloat(amtIn)<=0) return ['ENTER AMOUNT',         'disabled'];
    if (!amtOut)                        return ['INSUFFICIENT LIQUIDITY','disabled'];
    return [`SWAP ${tokIn.symbol} → ${tokOut.symbol}`,                  'primary'];
  };
  const [btnLabel, btnType] = btnState();
  const impactCol = !impact ? '#e2f0ff' : impact > 5 ? '#ff3b5c' : impact > 2 ? '#ffd600' : '#00ff88';

  return (
    <div style={S.card}>
      {/* header */}
      <div style={S.hdr}>
        <span style={S.hdrTitle}>SWAP</span>
        <button style={S.setBtn} onClick={() => setSlipOpen(o=>!o)}>⚙ {slip}%</button>
      </div>

      <div style={{ padding:'16px 18px' }}>
        {/* slippage */}
        {slipOpen && (
          <div style={S.slipBox}>
            <div style={S.slipLbl}>SLIPPAGE TOLERANCE</div>
            <div style={{ display:'flex', gap:6 }}>
              {[0.1, 0.5, 1.0].map(v => (
                <button key={v} style={{ ...S.slipOpt, ...(slip===v ? S.slipActive:{}) }} onClick={() => setSlip(v)}>{v}%</button>
              ))}
              <input style={S.slipInput} type="number" placeholder="Custom %" min="0.01" max="49"
                onChange={e => { const v = parseFloat(e.target.value); if (v>0&&v<50) setSlip(v); }} />
            </div>
          </div>
        )}

        {/* token in */}
        <TokBox
          label="YOU PAY" balance={balIn} amount={amtIn}
          onAmount={handleAmtIn} onMax={setMax}
          tok={tokIn} onTokClick={() => openTokModal('in')}
        />

        {/* flip button */}
        <div style={{ textAlign:'center', margin:'3px 0' }}>
          <button style={S.flipBtn} onClick={flip}>⇅</button>
        </div>

        {/* token out */}
        <TokBox
          label="YOU RECEIVE" balance={balOut} amount={amtOut}
          onAmount={() => {}} tok={tokOut}
          onTokClick={() => openTokModal('out')} readonly
        />

        {/* route info */}
        {route && (
          <div style={S.routeBox}>
            <Row lbl="Rate"          val={route.rate} />
            <Row lbl="Price Impact"  val={(impact||0).toFixed(2)+'%'} col={impactCol} />
            <Row lbl="Min. Received" val={`${route.minOut} ${tokOut.symbol}`} />
            <Row lbl="LP Fee (0.3%)" val={`${route.fee} ${tokIn.symbol}`} />
          </div>
        )}

        {/* swap btn */}
        <button
          style={{ ...S.actBtn, ...S[btnType+'Btn'] }}
          disabled={btnType === 'disabled' || busy}
          onClick={address ? doSwap : undefined}
        >
          {busy ? <span style={S.btnSpin}/> : btnLabel}
        </button>
      </div>

      <TokenModal open={tokModal} onClose={() => setTokModal(false)}
        onSelect={selectTok} address={address} provider={readProvider()} />
      <TxModal {...tx} onClose={() => setTx({ state: TX.IDLE, hash:'', msg:'' })} />
    </div>
  );
}

// ─── sub-components ───────────────────────────────────
function TokBox({ label, balance, amount, onAmount, onMax, tok, onTokClick, readonly }) {
  return (
    <div style={S.tbox}>
      <div style={S.tboxTop}>
        <span style={{ color:'#3d5a7a' }}>{label}</span>
        <span style={{ color:'#6b8aaa', cursor: onMax?'pointer':undefined }} onClick={onMax}>
          Balance: {balance}{onMax ? ' MAX' : ''}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <input
          style={{ ...S.amtInp, color: readonly ? '#3d5a7a':'#e2f0ff' }}
          type="number" placeholder="0.0" value={amount}
          onChange={e => onAmount(e.target.value)} readOnly={readonly}
        />
        <button style={S.tokBtn} onClick={onTokClick}>
          <TokenIcon tok={tok} size={28} />
          <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, color:'#e2f0ff' }}>{tok.symbol}</span>
          <span style={{ color:'#3d5a7a', fontSize:10 }}>▾</span>
        </button>
      </div>
    </div>
  );
}

function Row({ lbl, val, col='#e2f0ff' }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0' }}>
      <span style={{ color:'#3d5a7a' }}>{lbl}</span>
      <span style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:col }}>{val}</span>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────
const S = {
  card:       { background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:16, overflow:'hidden' },
  hdr:        { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 18px', borderBottom:'1px solid #132035' },
  hdrTitle:   { fontFamily:"'Unbounded',sans-serif", fontSize:15, fontWeight:700, color:'#e2f0ff' },
  setBtn:     { background:'#0c1624', border:'1px solid #132035', borderRadius:7, padding:'6px 12px', cursor:'pointer', color:'#6b8aaa', fontSize:12, fontFamily:"'IBM Plex Mono',monospace" },
  slipBox:    { background:'#0c1624', border:'1px solid #132035', borderRadius:10, padding:'12px 14px', marginBottom:14 },
  slipLbl:    { fontSize:11, color:'#3d5a7a', fontWeight:700, letterSpacing:'.5px', marginBottom:8 },
  slipOpt:    { padding:'6px 13px', borderRadius:7, border:'1px solid #132035', background:'#080f1a', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, cursor:'pointer' },
  slipActive: { borderColor:'#00d4ff', color:'#00d4ff', background:'rgba(0,212,255,.08)' },
  slipInput:  { flex:1, background:'#080f1a', border:'1px solid #132035', borderRadius:7, padding:'6px 10px', color:'#e2f0ff', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, outline:'none' },
  tbox:       { background:'#0c1624', border:'1px solid #132035', borderRadius:12, padding:'14px 16px', marginBottom:4 },
  tboxTop:    { display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700, letterSpacing:'.5px', marginBottom:10 },
  amtInp:     { background:'none', border:'none', outline:'none', fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:700, width:'100%', minWidth:0 },
  tokBtn:     { display:'flex', alignItems:'center', gap:8, background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:10, padding:'8px 12px', cursor:'pointer', whiteSpace:'nowrap', minWidth:130 },
  flipBtn:    { width:36, height:36, background:'#0c1624', border:'2px solid #1a2d4a', borderRadius:10, cursor:'pointer', fontSize:18, color:'#6b8aaa', transition:'.3s' },
  routeBox:   { background:'#0c1624', border:'1px solid #132035', borderRadius:10, padding:'12px 14px', margin:'12px 0' },
  actBtn:     { width:'100%', padding:15, border:'none', borderRadius:12, fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.3px', marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  primaryBtn: { background:'linear-gradient(135deg,#00d4ff,#0094cc)', color:'#04070d' },
  outlineBtn: { background:'transparent', border:'1px solid #00d4ff', color:'#00d4ff' },
  disabledBtn:{ background:'#0c1624', border:'1px solid #132035', color:'#3d5a7a', cursor:'not-allowed' },
  btnSpin:    { width:16, height:16, border:'2px solid rgba(0,0,0,.3)', borderTopColor:'#04070d', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' },
};
