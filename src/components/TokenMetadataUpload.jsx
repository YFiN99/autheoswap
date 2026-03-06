// src/components/TokenMetadataUpload.jsx
// Upload token logo + metadata via /api/upload-token-meta (Vercel serverless)
// Serverless function pakai Shelby SDK di Node.js — tidak ada conflict
import { useState, useRef } from 'react';
import { EXPLORER } from '../utils/config';

const STORAGE_KEY = 'autheoswap_token_meta';

// ── public helpers ────────────────────────────────────
export function getTokenMeta(address) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return all[address?.toLowerCase()] || null;
  } catch { return null; }
}

export function saveTokenMeta(address, meta) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[address.toLowerCase()] = meta;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

// fetch metadata from Shelby via proxy (called on app load)
export async function fetchTokenMetaFromShelby(address) {
  try {
    const r = await fetch(`/api/get-token-meta?address=${address}`);
    if (!r.ok) return null;
    const meta = await r.json();
    // cache locally
    saveTokenMeta(address, meta);
    return meta;
  } catch { return null; }
}

// ── main component ────────────────────────────────────
export default function TokenMetadataUpload({ tok, onClose, onSaved }) {
  const existing  = getTokenMeta(tok.address);
  const [preview,  setPreview]  = useState(existing?.logoUrl || null);
  const [logoB64,  setLogoB64]  = useState(null);  // base64 string for upload
  const [logoMime, setLogoMime] = useState(null);
  const [desc,     setDesc]     = useState(existing?.description || '');
  const [website,  setWebsite]  = useState(existing?.website || '');
  const [status,   setStatus]   = useState('idle'); // idle|uploading|done|error
  const [errMsg,   setErrMsg]   = useState('');
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 256 * 1024) { setErrMsg('Max file size 256KB'); return; }
    if (!file.type.startsWith('image/')) { setErrMsg('Must be an image file'); return; }
    setErrMsg('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      // extract base64 part only
      const b64 = dataUrl.split(',')[1];
      setLogoB64(b64);
      setLogoMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!logoB64 && !desc) { setErrMsg('Add a logo or description'); return; }
    setStatus('uploading');
    setErrMsg('');

    try {
      const payload = {
        tokenAddress: tok.address,
        symbol:       tok.symbol,
        name:         tok.name,
        description:  desc.trim(),
        website:      website.trim(),
        logoBase64:   logoB64   || null,
        logoMime:     logoMime  || null,
      };

      const r = await fetch('/api/upload-token-meta', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Upload failed');

      // Save to localStorage with Shelby URLs
      const meta = {
        ...data.meta,
        logoUrl: data.logoUrl || preview, // use Shelby URL if available, else base64
      };
      saveTokenMeta(tok.address, meta);

      setStatus('done');
      onSaved?.(meta);
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.hdr}>
          <span style={S.hdrTitle}>TOKEN METADATA</span>
          <button style={S.x} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding:'18px' }}>
          {/* token info */}
          <div style={S.tokInfo}>
            <div style={S.tokAvatar}>{tok.symbol.slice(0,2).toUpperCase()}</div>
            <div>
              <div style={{ fontWeight:700, color:'#e2f0ff', fontSize:14 }}>{tok.symbol}</div>
              <div style={{ fontSize:11, color:'#3d5a7a', fontFamily:"'IBM Plex Mono',monospace" }}>
                {tok.address.slice(0,10)}…
                <span style={{ color:'#00d4ff', cursor:'pointer', marginLeft:6 }}
                  onClick={() => window.open(`${EXPLORER}/token/${tok.address}`, '_blank')}>↗</span>
              </div>
            </div>
          </div>

          {status === 'done' ? <Done onClose={onClose} /> : (
            <>
              {/* logo */}
              <div style={S.section}>
                <div style={S.label}>TOKEN LOGO</div>
                <div style={{ ...S.dropzone, ...(preview ? S.dropzoneHasImg:{}) }}
                  onClick={() => fileRef.current.click()}>
                  {preview
                    ? <img src={preview} alt="logo" style={S.previewImg}/>
                    : <>
                        <div style={{ fontSize:28, marginBottom:6 }}>🖼</div>
                        <div style={{ fontSize:12, color:'#6b8aaa' }}>Click to upload logo</div>
                        <div style={{ fontSize:10, color:'#3d5a7a', marginTop:3 }}>PNG / JPG / SVG · max 256KB</div>
                      </>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*"
                  style={{ display:'none' }} onChange={handleFile}/>
                {preview && (
                  <button style={S.clearBtn}
                    onClick={() => { setPreview(null); setLogoB64(null); setLogoMime(null); }}>
                    Remove logo
                  </button>
                )}
              </div>

              {/* description */}
              <div style={S.section}>
                <div style={S.label}>DESCRIPTION</div>
                <textarea style={S.textarea}
                  placeholder="Describe your token — what is it for?"
                  value={desc} onChange={e => setDesc(e.target.value)}
                  rows={3} maxLength={280}/>
                <div style={{ fontSize:10, color:'#3d5a7a', textAlign:'right' }}>{desc.length}/280</div>
              </div>

              {/* website */}
              <div style={S.section}>
                <div style={S.label}>WEBSITE <span style={{ color:'#3d5a7a', fontWeight:400 }}>(optional)</span></div>
                <input style={S.input} placeholder="https://yourproject.com"
                  value={website} onChange={e => setWebsite(e.target.value)}/>
              </div>

              {/* shelby badge */}
              <div style={S.shelbyBadge}>
                <span>🛡</span>
                <div>
                  <div style={{ color:'#e2f0ff', fontWeight:700, marginBottom:2 }}>
                    Stored on <span style={{ color:'#00d4ff' }}>Shelby Protocol</span>
                  </div>
                  <div style={{ fontSize:10, color:'#3d5a7a' }}>
                    Decentralized storage — permanent & censorship resistant
                  </div>
                </div>
              </div>

              {errMsg && <div style={S.err}>{errMsg}</div>}

              <button
                style={{ ...S.uploadBtn, ...(status==='uploading' ? S.uploadBtnBusy:{}) }}
                onClick={handleUpload}
                disabled={status === 'uploading'}
              >
                {status === 'uploading'
                  ? <><span style={S.spin}/>Uploading to Shelby…</>
                  : '⬆ Upload to Shelby'
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Done({ onClose }) {
  return (
    <div style={{ textAlign:'center', padding:'24px 0' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
      <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:700, color:'#00ff88', marginBottom:8 }}>
        Uploaded to Shelby!
      </div>
      <div style={{ fontSize:12, color:'#6b8aaa', marginBottom:20, lineHeight:1.7 }}>
        Token metadata is now stored on<br/>
        <b style={{ color:'#00d4ff' }}>Shelby Protocol</b> — decentralized & permanent.
      </div>
      <button style={S.uploadBtn} onClick={onClose}>Done</button>
    </div>
  );
}

const S = {
  overlay:        { position:'fixed', inset:0, background:'rgba(4,7,13,.85)', backdropFilter:'blur(10px)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  modal:          { background:'#080f1a', border:'1px solid #1a2d4a', borderRadius:16, width:'100%', maxWidth:420, overflow:'hidden', maxHeight:'90vh', overflowY:'auto' },
  hdr:            { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px 18px', borderBottom:'1px solid #132035', position:'sticky', top:0, background:'#080f1a', zIndex:1 },
  hdrTitle:       { fontFamily:"'Unbounded',sans-serif", fontSize:13, fontWeight:700, color:'#e2f0ff' },
  x:              { background:'none', border:'none', color:'#6b8aaa', fontSize:18, cursor:'pointer', padding:0 },
  tokInfo:        { display:'flex', alignItems:'center', gap:12, background:'#0c1624', border:'1px solid #132035', borderRadius:10, padding:'11px 14px', marginBottom:18 },
  tokAvatar:      { width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#1a2d4a,#0c1624)', border:'1px solid #2a4060', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#6b8aaa', fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 },
  section:        { marginBottom:14 },
  label:          { fontSize:10, fontWeight:700, letterSpacing:'.8px', color:'#3d5a7a', marginBottom:7 },
  dropzone:       { border:'2px dashed #1a2d4a', borderRadius:10, padding:'20px', textAlign:'center', cursor:'pointer', background:'#0c1624' },
  dropzoneHasImg: { border:'2px solid #00d4ff', padding:'8px', background:'#04070d' },
  previewImg:     { width:80, height:80, objectFit:'contain', borderRadius:8 },
  clearBtn:       { background:'none', border:'none', color:'#ff3b5c', fontSize:11, cursor:'pointer', marginTop:5, padding:0 },
  textarea:       { width:'100%', background:'#0c1624', border:'1px solid #132035', borderRadius:8, padding:'10px 12px', color:'#e2f0ff', fontSize:13, fontFamily:"'IBM Plex Mono',monospace", resize:'vertical', outline:'none', boxSizing:'border-box' },
  input:          { width:'100%', background:'#0c1624', border:'1px solid #132035', borderRadius:8, padding:'10px 12px', color:'#e2f0ff', fontSize:13, fontFamily:"'IBM Plex Mono',monospace", outline:'none', boxSizing:'border-box' },
  shelbyBadge:    { display:'flex', alignItems:'flex-start', gap:10, background:'rgba(0,212,255,.05)', border:'1px solid rgba(0,212,255,.15)', borderRadius:10, padding:'11px 14px', fontSize:12, color:'#6b8aaa', marginBottom:14 },
  err:            { background:'rgba(255,59,92,.1)', border:'1px solid rgba(255,59,92,.25)', borderRadius:8, padding:'9px 12px', fontSize:12, color:'#ff3b5c', marginBottom:12 },
  uploadBtn:      { width:'100%', padding:'13px', border:'none', borderRadius:10, background:'linear-gradient(135deg,#00d4ff,#0094cc)', color:'#04070d', fontFamily:"'Unbounded',sans-serif", fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 },
  uploadBtnBusy:  { opacity:.7, cursor:'not-allowed' },
  spin:           { width:14, height:14, border:'2px solid rgba(0,0,0,.3)', borderTopColor:'#04070d', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' },
};
