import { useState } from 'react';
import { useWallet } from './hooks/useWallet';
import SwapPanel from './components/SwapPanel';
import LiquidityPanel from './components/LiquidityPanel';
import WrapPanel from './components/WrapPanel';
import DashboardPanel from './components/DashboardPanel';
import TokenScanner from './components/TokenScanner';
import './index.css';

export default function App() {
  const { signer, address, error, connect, readProvider } = useWallet();
  const [tab,        setTab]        = useState('swap');
  const [prefillTok, setPrefillTok] = useState(null); // token to pre-fill in liquidity

  // When user clicks "Create Pool" from scanner → go to Liquidity tab with token pre-filled
  const handleCreatePool = (tok) => {
    setPrefillTok(tok);
    setTab('liquidity');
  };

  return (
    <div className="app">
      <div className="bg-grid"/>
      <div className="bg-glow"/>

      <nav className="nav">
        <div className="logo">
          <div className="logo-dot"/>
          AUTHEOSWAP
        </div>
        <div className="nav-tabs">
          <button className={`nav-tab${tab==='swap'      ? ' active':''}`} onClick={() => setTab('swap')}>SWAP</button>
          <button className={`nav-tab${tab==='liquidity' ? ' active':''}`} onClick={() => setTab('liquidity')}>LIQUIDITY</button>
          <button className={`nav-tab${tab==='wrap'      ? ' active':''}`} onClick={() => setTab('wrap')}>WRAP</button>
          <button className={`nav-tab${tab==='dashboard' ? ' active':''}`} onClick={() => setTab('dashboard')}>STATS</button>
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

      {error && (
        <div style={{ background:'rgba(255,59,92,.12)', borderBottom:'1px solid #ff3b5c', padding:'10px 28px', fontSize:13, color:'#ff3b5c', textAlign:'center' }}>
          ⚠ {error}
        </div>
      )}

      <main className="main">
        {/* Token scanner — shows banner if wallet has tokens with no pool */}
        {address && (
          <TokenScanner
            address={address}
            readProvider={readProvider}
            onCreatePool={handleCreatePool}
          />
        )}

        {tab === 'swap'      && <SwapPanel      signer={signer} address={address} readProvider={readProvider}/>}
        {tab === 'liquidity' && <LiquidityPanel signer={signer} address={address} readProvider={readProvider} prefillTok={prefillTok} onPrefillUsed={() => setPrefillTok(null)}/>}
        {tab === 'wrap'      && <WrapPanel      signer={signer} address={address} readProvider={readProvider}/>}
        {tab === 'dashboard' && <DashboardPanel address={address} readProvider={readProvider}/>}
      </main>
    </div>
  );
}
