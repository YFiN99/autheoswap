export default function TokenIcon({ tok, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(${tok.grad})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 900, color: '#fff',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      {tok.icon}
    </div>
  );
}
