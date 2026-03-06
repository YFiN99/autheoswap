import { useState, useEffect } from 'react';
import { getTokenMeta } from './TokenMetadataUpload';

export default function TokenIcon({ tok, size = 32 }) {
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    if (!tok?.address || tok.address === 'NATIVE') return;
    const meta = getTokenMeta(tok.address);
    if (meta?.logoUrl) setLogoUrl(meta.logoUrl);
  }, [tok?.address]);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={tok.symbol}
        style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
        onError={() => setLogoUrl(null)} // fallback ke default kalau gambar gagal load
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(${tok.grad || '135deg,#1a2d4a,#0c1624'})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 900, color: '#fff',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {tok.icon || tok.symbol?.slice(0,1)}
    </div>
  );
}
