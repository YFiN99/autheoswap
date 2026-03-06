import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  TOKENS, FACTORY, ROUTER, WTHEO,
  FACTORY_ABI, PAIR_ABI, ROUTER_ABI, ERC20_ABI,
  toAddr, fmtUnits, getTokenBalance, ensureAllowance,
} from '../utils/config';
import TokenModal from './TokenModal';
import TxModal, { TX } from './TxModal';
import TokenIcon from './TokenIcon';

export default function LiquidityPanel({ signer, address, readProvider }) {
  const [tab, setTab] = useState('add'); // 'add' | 'positions'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* tab switcher */}
      <div style={S.tabRow}>
        <button style={{ ...S.tab, ...(tab==='add'      ? S.tabActive:{}) }} onClick={() => setTab('add')}>ADD</button>
        <button style={{ ...S.tab, ...(tab==='positions'? S.tabActive:{}) }} onClick={() => setTab('positions')}>MY POSITIONS</button>
      </div>

      {tab === 'add'       && <AddPane       signer={signer} address={address} readProvider={readProvider} />}
      {tab === 'positions' && <PositionsPane signer={signer} address={address} readProvider={readProvider} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  ADD LIQUIDITY PANE
// ══════════════════════════════════════════════════════
function AddPane({ signer, address, readProvider }) {
  const [tokA,     setTokA]     = useState(TOKENS[0]);
  const [tokB,     setTokB]     = useState(TOKENS[2]);
  const [amtA,     setAmtA]     = useState('');
  const [amtB,     setAmtB]     = useState('');
  const [balARaw,  setBalARaw]  = useState(0n);  // raw BigInt
  const [balBRaw,  setBalBRaw]  = useState(0n);
  const [balA,     setBalA]     = useState('—');
  const [balB,     setBalB]     = useState('—');
  const [poolInfo, setPoolInfo] = useState(null); // null | { isNew, rate, share, lpEst }
  const [pct,      setPct]      = useState(10);   // % slider for new pool (1-25)
  const [tokModal, setTokModal] = useState(false);
  const [side,     setSide]     = useState('A');
  const [tx,       setTx]       = useState({ state: TX.IDLE, hash:'', msg:'' });
  const [busy,     setBusy]     = useState(false);

  // ── load balance ──────────────────────────────────
  const loadBal = useCallback(async (tok, setRaw, setFmt) => {
    if (!address) { setRaw(0n); setFmt('—'); return; }
    const b = await getTokenBalance(tok, address, readProvider());
    setRaw(b);
    setFmt(fmtUnits(b, tok.decimals));
  }, [address, readProvider]);

  useEffect(() => { loadBal(tokA, setBalARaw, setBalA); }, [tokA, loadBal]);
  useEffect(() => { loadBal(tokB, setBalBRaw, setBalB); }, [tokB, loadBal]);

  // ── check pool & calc paired amount ──────────────
  const calcPaired = useCallback(async (valA, tA = tokA, tB = tokB) => {
    setPoolInfo(null);
    if (!valA || parseFloat(valA) <= 0) return;
    if (toAddr(tA) === toAddr(tB)) return;
    try {
      const p       = readProvider();
      const factory = new ethers.Contract(FACTORY, FACTORY_ABI, p);
      const pa      = await factory.getPair(toAddr(tA), toAddr(tB));

      // ── NEW POOL: bebas isi Token B ───────────────
      if (pa === ethers.ZeroAddress) {
        setPoolInfo({ isNew: true });
        // amtB stays as user input — don't overwrite
        return;
      }

      // ── EXISTING POOL: auto-hitung Token B ────────
      const pair    = new ethers.Contract(pa, PAIR_ABI, p);
      const [r0,r1] = await pair.getReserves();
      const t0      = await pair.token0();
      const [rA,rB] = t0.toLowerCase() === toAddr(tA).toLowerCase() ? [r0,r1] : [r1,r0];
      const totalLP = await pair.totalSupply();

      const weiA  = ethers.parseUnits(valA, tA.decimals);
      const weiB  = rA > 0n ? weiA * rB / rA : 0n;
      const bFmt  = parseFloat(ethers.formatUnits(weiB, tB.decimals)).toFixed(6);
      setAmtB(bFmt); // ← auto-set Token B

      const lpEst = totalLP > 0n ? weiA * totalLP / rA : 0n;
      const share = totalLP > 0n
        ? Number(lpEst) / (Number(totalLP) + Number(lpEst)) * 100
        : 100;
      const decDiff = 10 ** (tA.decimals - tB.decimals);

      setPoolInfo({
        isNew: false,
        rate:  `1 ${tA.symbol} = ${(Number(rB) / Number(rA) * decDiff).toFixed(6)} ${tB.symbol}`,
        share: share.toFixed(4) + '%',
        lpEst: fmtUnits(lpEst, 18),
      });
    } catch { setPoolInfo(null); }
  }, [tokA, tokB, readProvider]);

  // ── % slider handler (new pool only) ─────────────
  const handlePct = (p) => {
    setPct(p);
    if (balARaw > 0n) {
      // reserve a bit for gas if native
      let usable = balARaw;
      if (tokA.address === 'NATIVE') {
        const gas = ethers.parseEther('0.05');
        usable = usable > gas ? usable - gas : 0n;
      }
      const slice = usable * BigInt(p) / 100n;
      const v = parseFloat(ethers.formatUnits(slice, tokA.decimals)).toFixed(6);
      setAmtA(v);
      calcPaired(v);
    }
  };

  const handleAmtA = (v) => {
    setAmtA(v);
    calcPaired(v);
  };

  const handleAmtB = (v) => {
    // only editable when pool is new
    if (poolInfo?.isNew || !poolInfo) setAmtB(v);
  };

  // ── do add liquidity ──────────────────────────────
  const doAdd = async () => {
    if (!signer || !amtA || !amtB) return;
    setBusy(true);
    setTx({ state: TX.PENDING, hash:'', msg:'' });
    try {
      const router   = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
      const weiA     = ethers.parseUnits(amtA, tokA.decimals);
      const weiB     = ethers.parseUnits(amtB, tokB.decimals);
      const deadline = Math.floor(Date.now()/1000) + 1200;
      const isNatA   = tokA.address === 'NATIVE';
      const isNatB   = tokB.address === 'NATIVE';

      let txr;
      if (isNatA) {
        await ensureAllowance(tokB, ROUTER, weiB, signer, address);
        txr = await router.addLiquidityTHEO(toAddr(tokB), weiB, 0n, 0n, address, deadline, { value: weiA });
      } else if (isNatB) {
        await ensureAllowance(tokA, ROUTER, weiA, signer, address);
        txr = await router.addLiquidityTHEO(toAddr(tokA), weiA, 0n, 0n, address, deadline, { value: weiB });
      } else {
        await ensureAllowance(tokA, ROUTER, weiA, signer, address);
        await ensureAllowance(tokB, ROUTER, weiB, signer, address);
        txr = await router.addLiquidity(toAddr(tokA), toAddr(tokB), weiA, weiB, 0n, 0n, address, deadline);
      }
      setTx({ state: TX.MINING, hash: txr.hash, msg:'' });
      const receipt = await txr.wait();
      setTx({ state: TX.OK, hash: receipt.hash, msg: `Added ${amtA} ${tokA.symbol} + ${amtB} ${tokB.symbol}` });
      setAmtA(''); setAmtB(''); setPoolInfo(null); setPct(10);
      loadBal(tokA, setBalARaw, setBalA);
      loadBal(tokB, setBalBRaw, setBalB);
    } catch(e) {
      setTx({ state: TX.ERR, hash:'', msg: e.reason || e.shortMessage || e.message });
    } finally { setBusy(false); }
  };

  const btnState = () => {
    if (!address)      return ['CONNECT WALLET', 'outline'];
    if (!amtA || !amtB) return ['ENTER AMOUNTS',  'disabled'];
    return [`ADD ${tokA.symbol} / ${tokB.symbol}`, 'primary'];
  };
  const [btnLabel, btnType] = btnState();

  const selectTok = (s, tok) => {
    if (s === 'A') { setTokA(tok); setAmtA(''); setAmtB(''); setPoolInfo(null); setPct(10); }
    else           { setTokB(tok); setAmtA(''); setAmtB(''); setPoolInfo(null); setPct(10); }
  };

  const isNewPool = poolInfo?.isNew === true;

  return (
    <div style={S.card}>
      <div style={S.hdr}><span style={S.hdrTitle}>ADD LIQUIDITY</span></div>
      <div style={{ padding:'16px 18px' }}>
        <div style={S.infoBox}>
          <b style={{ color:'#00d4ff' }}>Liquidity Provider</b> — earn{' '}
          <b style={{ color:'#00d4ff' }}>0.3%</b> of every swap, proportional to your share.
        </div>

        {/* TOKEN A */}
        <LiqBox
          label="TOKEN A" bal={balA} amt={amtA}
          onAmt={handleAmtA} tok={tokA}
          onTok={() => { setSide('A'); setTokModal(true); }}
          readonly={false}
        />

        {/* % slider — only for NEW pool */}
        {isNewPool && (
          <div style={S.pctSliderBox}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:11, color:'#3d5a7a', fontWeight:700, letterSpacing:'.5px' }}>
                USE % OF BALANCE
              </span>
              <span style={{ fontSize:13, fontWeight:700, color:'#00d4ff', fontFamily:"'IBM Plex Mono',monospace" }}>
                {pct}%
              </span>
            </div>
            <input
              type="range" min="1" max="25" value={pct}
              onChange={e => handlePct(Number(e.target.value))}
              style={{ width:'100%', accentColor:'#00d4ff', cursor:'pointer', marginBottom:8 }}
            />
            <div style={{ display:'flex', gap:6 }}>
              {[1,5,10,25].map(p => (
                <button key={p}
                  style={{ ...S.pctChip, ...(pct===p ? S.pctChipActive:{}) }}
                  onClick={() => handlePct(p)}
                >{p}%</button>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign:'center', fontSize:22, color:'#00d4ff', padding:'4px 0', fontWeight:700 }}>+</div>

        {/* TOKEN B */}
        <LiqBox
          label={isNewPool ? 'TOKEN B  (bebas isi harga)' : 'TOKEN B  (otomatis dari pool)'}
          bal={balB} amt={amtB}
          onAmt={handleAmtB}
          tok={tokB}
          onTok={() => { setSide('B'); setTokModal(true); }}
          readonly={!isNewPool && poolInfo !== null}
        />

        {/* pool info */}
        {poolInfo && (
          <div style={S.routeBox}>
            {isNewPool ? (
              <div style={{ fontSize:12, lineHeight:1.7 }}>
                <div style={{ color:'#00ff88', fontWeight:700, marginBottom:4 }}>🆕 Pool Baru</div>
                <div style={{ color:'#6b8aaa' }}>
                  Kamu yang menentukan harga awal.<br/>
                  Masukkan berapa <b style={{ color:'#e2f0ff' }}>{tokB.symbol}</b> per{' '}
                  <b style={{ color:'#e2f0ff' }}>{tokA.symbol}</b>.
                </div>
                {amtA && amtB && parseFloat(amtA)>0 && parseFloat(amtB)>0 && (
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid #132035' }}>
                    <Row lbl="Harga awal" val={`1 ${tokA.symbol} = ${(parseFloat(amtB)/parseFloat(amtA)).toFixed(6)} ${tokB.symbol}`} />
                    <Row lbl="Pool Share" val="100% (kamu LP pertama)" col="#00ff88" />
                  </div>
                )}
              </div>
            ) : (
              <>
                <Row lbl="Rate (pool)"     val={poolInfo.rate} />
                <Row lbl="Pool Share (est.)" val={poolInfo.share} />
                <Row lbl="LP Tokens (est.)" val={poolInfo.lpEst} />
              </>
            )}
          </div>
        )}

        <button
          style={{ ...S.actBtn, ...S[btnType+'Btn'] }}
          disabled={btnType==='disabled' || busy}
          onClick={doAdd}
        >
          {busy ? <span style={S.btnSpin}/> : btnLabel}
        </button>
      </div>

      <TokenModal open={tokModal} onClose={() => setTokModal(false)}
        onSelect={tok => selectTok(side, tok)} address={address} provider={readProvider()} />
      <TxModal {...tx} onClose={() => setTx({ state: TX.IDLE, hash:'', msg:'' })} />
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  POSITIONS PANE
// ══════════════════════════════════════════════════════
function PositionsPane({ signer, address, readProvider }) {
  const [positions, setPositions] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removePct,    setRemovePct]    = useState(50);
  const [tx, setTx] = useState({ state: TX.IDLE, hash:'', msg:'' });

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const p       = readProvider();
      const factory = new ethers.Contract(FACTORY, FACTORY_ABI, p);
      const count   = Number(await factory.allPairsLength());
      const result  = [];
      for (let i = 0; i < Math.min(count, 50); i++) {
        const pa    = await factory.allPairs(i);
        const pair  = new ethers.Contract(pa, PAIR_ABI, p);
        const lpBal = await pair.balanceOf(address);
        if (lpBal === 0n) continue;
        const t0a     = await pair.token0();
        const t1a     = await pair.token1();
        const [r0,r1] = await pair.getReserves();
        const totalLP = await pair.totalSupply();
        const tok0    = TOKENS.find(t => t.address.toLowerCase() === t0a.toLowerCase()) || { symbol:t0a.slice(0,8), decimals:18, grad:'135deg,#333,#555', icon:'?' };
        const tok1    = TOKENS.find(t => t.address.toLowerCase() === t1a.toLowerCase()) || { symbol:t1a.slice(0,8), decimals:18, grad:'135deg,#333,#555', icon:'?' };
        const share   = Number(lpBal) * 100 / Number(totalLP);
        const a0      = lpBal * r0 / totalLP;
        const a1      = lpBal * r1 / totalLP;
        result.push({ pa, tok0, tok1, lpBal, totalLP, share, a0, a1, t0a, t1a });
      }
      setPositions(result);
    } finally { setLoading(false); }
  }, [address, readProvider]);

  useEffect(() => { load(); }, [load]);

  const doRemove = async () => {
    if (!signer || !removeTarget) return;
    const { pa, tok0, tok1, lpBal } = removeTarget;
    const burnLP  = lpBal * BigInt(removePct) / 100n;
    const deadline= Math.floor(Date.now()/1000) + 1200;
    setTx({ state: TX.PENDING, hash:'', msg:'' });
    try {
      const pair   = new ethers.Contract(pa, PAIR_ABI, signer);
      const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
      const allowed = await pair.allowance(address, ROUTER);
      if (allowed < burnLP) { const t = await pair.approve(ROUTER, burnLP); await t.wait(); }

      const isWTHEO0 = tok0.address?.toLowerCase() === WTHEO.toLowerCase();
      const isWTHEO1 = tok1.address?.toLowerCase() === WTHEO.toLowerCase();
      let txr;
      if (isWTHEO0 || isWTHEO1) {
        const tokenAddr = isWTHEO0 ? tok1.address : tok0.address;
        txr = await router.removeLiquidityTHEO(tokenAddr, burnLP, 0n, 0n, address, deadline);
      } else {
        txr = await router.removeLiquidity(tok0.address, tok1.address, burnLP, 0n, 0n, address, deadline);
      }
      setTx({ state: TX.MINING, hash: txr.hash, msg:'' });
      const receipt = await txr.wait();
      setTx({ state: TX.OK, hash: receipt.hash, msg: `Removed ${removePct}% from ${tok0.symbol}/${tok1.symbol}` });
      setRemoveTarget(null);
      load();
    } catch(e) {
      setTx({ state: TX.ERR, hash:'', msg: e.reason || e.shortMessage || e.message });
    }
  };

  return (
    <div style={S.card}>
      <div style={S.hdr}>
        <span style={S.hdrTitle}>MY POSITIONS</span>
        <button style={S.setBtn} onClick={load}>↻ Refresh</button>
      </div>
      <div style={{ padding:'14px 16px' }}>
        {loading && <div style={{ textAlign:'center', padding:30, color:'#3d5a7a' }}><div style={S.spin2}/>Loading…</div>}
        {!loading && !address && <Empty icon="💧" text="Connect wallet to see positions" />}
        {!loading && address && positions.length === 0 && <Empty icon="🌊" text="No LP positions found." />}
        {!loading && positions.map((pos, i) => (
          <PosCard key={i} pos={pos} onRemove={() => { setRemoveTarget(pos); setRemovePct(50); }} />
        ))}
      </div>

      {/* remove modal */}
      {removeTarget && (
        <div style={S.overlay} onClick={() => setRemoveTarget(null)}>
          <div style={S.removeModal} onClick={e => e.stopPropagation()}>
            <div style={S.hdr}>
              <span style={S.hdrTitle}>REMOVE LIQUIDITY</span>
              <button style={S.setBtn} onClick={() => setRemoveTarget(null)}>✕</button>
            </div>
            <div style={{ padding:18 }}>
              <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:44, fontWeight:900, color:'#00d4ff', textAlign:'center', padding:'6px 0' }}>{removePct}%</div>
              <input type="range" min="1" max="100" value={removePct}
                onChange={e => setRemovePct(Number(e.target.value))}
                style={{ width:'100%', marginBottom:10, accentColor:'#00d4ff', cursor:'pointer' }} />
              <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                {[25,50,75,100].map(p => (
                  <button key={p} style={{ ...S.pctBtn, ...(removePct===p?S.pctActive:{}) }} onClick={() => setRemovePct(p)}>{p === 100 ? 'MAX' : p+'%'}</button>
                ))}
              </div>
              <div style={S.routeBox}>
                <Row lbl="LP to burn"                       val={fmtUnits(removeTarget.lpBal * BigInt(removePct)/100n, 18)} />
                <Row lbl={removeTarget.tok0.symbol+' back'} val={fmtUnits(removeTarget.a0 * BigInt(removePct)/100n, removeTarget.tok0.decimals)} />
                <Row lbl={removeTarget.tok1.symbol+' back'} val={fmtUnits(removeTarget.a1 * BigInt(removePct)/100n, removeTarget.tok1.decimals)} />
              </div>
              <button style={{ ...S.actBtn, background:'#ff3b5c', color:'#fff' }} onClick={doRemove}>
                REMOVE {removePct}% LIQUIDITY
              </button>
            </div>
          </div>
        </div>
      )}

      <TxModal {...tx} onClose={() => setTx({ state: TX.IDLE, hash:'', msg:'' })} />
    </div>
  );
}

// ─── sub-components ───────────────────────────────────
function LiqBox({ label, bal, amt, onAmt, tok, onTok, readonly }) {
  return (
    <div style={{ ...S.tbox, ...(readonly ? { opacity:.75 }:{}) }}>
      <div style={S.tboxTop}>
        <span style={{ color:'#3d5a7a', fontSize:11 }}>{label}</span>
        <span style={{ color:'#6b8aaa' }}>Balance: {bal}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <input
          style={{ ...S.amtInp, color: readonly ? '#6b8aaa':'#e2f0ff', cursor: readonly?'not-allowed':'text' }}
          type="number" placeholder="0.0"
          value={amt}
          onChange={e => !readonly && onAmt(e.target.value)}
          readOnly={readonly}
        />
        <button style={S.tokBtn} onClick={onTok}>
          <TokenIcon tok={tok} size={28}/>
          <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, color:'#e2f0ff' }}>{tok.symbol}</span>
          <span style={{ color:'#3d5a7a', fontSize:10 }}>▾</span>
        </button>
      </div>
    </div>
  );
}

function PosCard({ pos, onRemove }) {
  return (
    <div style={S.posCard}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex' }}>
            <TokenIcon tok={pos.tok0} size={26}/>
            <div style={{ marginLeft:-8, border:'2px solid #0c1624', borderRadius:'50%' }}><TokenIcon tok={pos.tok1} size={26}/></div>
          </div>
          <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, color:'#e2f0ff' }}>
            {pos.tok0.symbol}/{pos.tok1.symbol}
          </span>
        </div>
        <button style={S.removeBtn} onClick={onRemove}>REMOVE</button>
      </div>
      <Row lbl="LP Tokens"          val={fmtUnits(pos.lpBal, 18)} />
      <Row lbl="Pool Share"         val={pos.share.toFixed(4)+'%'} />
      <Row lbl={pos.tok0.symbol}    val={fmtUnits(pos.a0, pos.tok0.decimals)} />
      <Row lbl={pos.tok1.symbol}    val={fmtUnits(pos.a1, pos.tok1.decimals)} />
    </div>
  );
}

function Empty({ icon, text }) {
  return <div style={{ textAlign:'center', padding:'36px 0', color:'#3d5a7a' }}><div style={{ fontSize:34, marginBottom:10 }}>{icon}</div>{text}</div>;
}

function Row({ lbl, val, col='#e2f0ff' }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0' }}>
      <span style={{ color:'#3d5a7a' }}>{lbl}</span>
      <span style={{ fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", color:col }}>{val}</span>
    </div>
  );
}
const S = {
  card:       { background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:16, overflow:'hidden' },
  hdr:        { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 18px', borderBottom:'1px solid #132035' },
  hdrTitle:   { fontFamily:"'Unbounded',sans-serif", fontSize:15, fontWeight:700, color:'#e2f0ff' },
  setBtn:     { background:'#0c1624', border:'1px solid #132035', borderRadius:7, padding:'6px 12px', cursor:'pointer', color:'#6b8aaa', fontSize:12, fontFamily:"'IBM Plex Mono',monospace" },
  infoBox:    { background:'rgba(0,212,255,.05)', border:'1px solid rgba(0,212,255,.15)', borderRadius:10, padding:'12px 14px', marginBottom:14, fontSize:12, color:'#6b8aaa', lineHeight:1.7 },
  tbox:       { background:'#0c1624', border:'1px solid #132035', borderRadius:12, padding:'14px 16px', marginBottom:4 },
  tboxTop:    { display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700, letterSpacing:'.5px', marginBottom:10 },
  amtInp:     { background:'none', border:'none', outline:'none', fontFamily:"'IBM Plex Mono',monospace", fontSize:28, fontWeight:700, width:'100%', minWidth:0 },
  tokBtn:     { display:'flex', alignItems:'center', gap:8, background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:10, padding:'8px 12px', cursor:'pointer', whiteSpace:'nowrap', minWidth:130 },
  routeBox:   { background:'#0c1624', border:'1px solid #132035', borderRadius:10, padding:'12px 14px', margin:'12px 0' },
  actBtn:     { width:'100%', padding:15, border:'none', borderRadius:12, fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.3px', marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  primaryBtn: { background:'linear-gradient(135deg,#00d4ff,#0094cc)', color:'#04070d' },
  outlineBtn: { background:'transparent', border:'1px solid #00d4ff', color:'#00d4ff' },
  disabledBtn:{ background:'#0c1624', border:'1px solid #132035', color:'#3d5a7a', cursor:'not-allowed' },
  btnSpin:    { width:16, height:16, border:'2px solid rgba(0,0,0,.3)', borderTopColor:'#04070d', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' },
  tabRow:     { display:'flex', gap:2, background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:10, padding:3 },
  tab:        { flex:1, padding:'9px 0', borderRadius:7, border:'none', background:'transparent', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, cursor:'pointer', transition:'.2s', letterSpacing:'.5px' },
  tabActive:  { background:'#00d4ff', color:'#04070d' },
  posCard:    { background:'#0c1624', border:'1px solid #132035', borderRadius:12, padding:'14px 16px', marginBottom:10 },
  removeBtn:  { padding:'6px 14px', borderRadius:7, border:'1px solid #ff3b5c', background:'transparent', color:'#ff3b5c', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, cursor:'pointer' },
  overlay:    { position:'fixed', inset:0, background:'rgba(4,7,13,.9)', backdropFilter:'blur(14px)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' },
  removeModal:{ background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:16, width:380 },
  pctBtn:        { flex:1, padding:7, borderRadius:7, border:'1px solid #132035', background:'#0c1624', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, cursor:'pointer' },
  pctActive:     { borderColor:'#00d4ff', color:'#00d4ff', background:'rgba(0,212,255,.08)' },
  spin2:         { width:28, height:28, border:'3px solid #132035', borderTopColor:'#00d4ff', borderRadius:'50%', animation:'spin .7s linear infinite', margin:'0 auto 12px' },
  pctSliderBox:  { background:'rgba(0,212,255,.04)', border:'1px solid rgba(0,212,255,.12)', borderRadius:10, padding:'12px 14px', margin:'4px 0 6px' },
  pctChip:       { flex:1, padding:'6px 0', borderRadius:7, border:'1px solid #132035', background:'#080f1a', color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:700, cursor:'pointer', transition:'.15s' },
  pctChipActive: { borderColor:'#00d4ff', color:'#00d4ff', background:'rgba(0,212,255,.1)' },
};
