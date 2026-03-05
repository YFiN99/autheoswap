import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAIN_HEX, CHAIN_ID, RPCS, EXPLORER } from '../utils/config';

export function useWallet() {
  const [provider, setProvider] = useState(null);
  const [signer,   setSigner]   = useState(null);
  const [address,  setAddress]  = useState('');
  const [error,    setError]    = useState('');

  const connect = useCallback(async () => {
    setError('');
    if (!window.ethereum) { setError('MetaMask not found!'); return; }
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Add / switch to Autheo
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== CHAIN_HEX) {
        try {
          await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] });
        } catch (e) {
          if (e.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: CHAIN_HEX, chainName: 'Autheo Testnet', nativeCurrency: { name: 'THEO', symbol: 'THEO', decimals: 18 }, rpcUrls: RPCS, blockExplorerUrls: [EXPLORER] }],
            });
          } else throw e;
        }
      }

      const prov = new ethers.BrowserProvider(window.ethereum);
      const sign = await prov.getSigner();
      const addr = await sign.getAddress();
      setProvider(prov); setSigner(sign); setAddress(addr);
    } catch (e) { setError(e.shortMessage || e.message); }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const reload = () => window.location.reload();
    window.ethereum.on('accountsChanged', reload);
    window.ethereum.on('chainChanged',    reload);
    return () => { window.ethereum.removeListener('accountsChanged', reload); window.ethereum.removeListener('chainChanged', reload); };
  }, []);

  const readProvider = useCallback(() => provider || new ethers.JsonRpcProvider(RPCS[0]), [provider]);

  return { provider, signer, address, error, connect, readProvider };
}
