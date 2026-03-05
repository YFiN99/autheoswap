import { useState } from 'react';
import { useWallet } from './hooks/useWallet';
import SwapPanel from './components/SwapPanel';
import LiquidityPanel from './components/LiquidityPanel';
import './index.css';

export default function App() {
  const { signer, address, error, connect, readProvider } = useWallet();
  const [tab, setTab] = useState('swap');

  return (
    <div className="app">
      <div className="bg-grid"/>
      <div className="bg-glow"/>

      {/* NAV */}
      <nav className="nav">
        <div className="logo">
          <div className="logo-dot"/>
          AUTHEOSWAP
        </div>

        <div className="nav-tabs">
          <button className={`nav-tab${tab==='swap'      ? ' active':''}`} onClick={() => setTab('swap')}>SWAP</button>
          <button className={`nav-tab${tab==='liquidity' ? ' active':''}`} onClick={() => setTab('liquidity')}>LIQUIDITY</button>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="net-badge">
            <div className="net-dot"/>
            AUTHEO · 785
          </div>
          <button className={`connect-btn${address ? ' connected':''}`} onClick={connect}>
            {address ? `${address.slice(0,6)}…${address.slice(-4)}` : 'CONNECT'}
          </button>
        </div>
      </nav>

      {/* error banner */}
      {error && (
        <div style={{ background:'rgba(255,59,92,.12)', borderBottom:'1px solid #ff3b5c', padding:'10px 28px', fontSize:13, color:'#ff3b5c', textAlign:'center' }}>
          ⚠ {error}
        </div>
      )}

      {/* MAIN */}
      <main className="main">
        {tab === 'swap'      && <SwapPanel      signer={signer} address={address} readProvider={readProvider}/>}
        {tab === 'liquidity' && <LiquidityPanel signer={signer} address={address} readProvider={readProvider}/>}
      </main>
    </div>
  );
}
