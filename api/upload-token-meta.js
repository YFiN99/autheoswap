// api/upload-token-meta.js
// Vercel Serverless Function — runs Node.js, no dependency conflict
// Frontend call: POST /api/upload-token-meta
const { Shelby, Network } = require('@shelby-protocol/ethereum-kit/node');
const { Wallet }          = require('ethers');

const SHELBY_API_KEY = process.env.SHELBY_API_KEY || '';
const DOMAIN         = 'autheoswap.vercel.app';

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { tokenAddress, symbol, name, description, website, logoBase64, logoMime } = req.body;

    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });
    if (!SHELBY_API_KEY) return res.status(500).json({ error: 'SHELBY_API_KEY not configured' });

    // Dedicated DEX wallet for Shelby storage account
    // This wallet owns the storage on Shelby — tokens uploaded here are public
    const shelbyWallet = new Wallet(process.env.SHELBY_UPLOADER_PRIVATE_KEY);

    const shelby = new Shelby({
      network: Network.SHELBYNET,
      apiKey:  SHELBY_API_KEY,
    });

    const storageAccount = shelby.createStorageAccount(shelbyWallet, DOMAIN);

    const results = {};
    const expiry   = Date.now() * 1000 + 365 * 24 * 3600 * 1_000_000; // 1 year

    // 1. Upload logo if provided
    if (logoBase64 && logoMime) {
      const ext      = logoMime.split('/')[1] || 'png';
      const blobName = `logos/${tokenAddress.toLowerCase()}.${ext}`;
      const buf      = Buffer.from(logoBase64, 'base64');

      await shelby.upload({
        blobData:        new Uint8Array(buf),
        signer:          storageAccount,
        blobName,
        expirationMicros: expiry,
      });

      results.logoUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${storageAccount.address}/${blobName}`;
    }

    // 2. Upload metadata JSON
    const meta = {
      tokenAddress: tokenAddress.toLowerCase(),
      symbol,
      name,
      description,
      website,
      logoUrl:    results.logoUrl || null,
      uploadedAt: Date.now(),
    };

    const metaBlobName = `metadata/${tokenAddress.toLowerCase()}.json`;
    const metaBytes    = new TextEncoder().encode(JSON.stringify(meta));

    await shelby.upload({
      blobData:        metaBytes,
      signer:          storageAccount,
      blobName:        metaBlobName,
      expirationMicros: expiry,
    });

    results.metaUrl      = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${storageAccount.address}/${metaBlobName}`;
    results.storageAcct  = storageAccount.address;
    results.meta         = meta;

    return res.status(200).json({ ok: true, ...results });

  } catch (e) {
    console.error('Shelby upload error:', e);
    return res.status(500).json({ error: e.message || 'Upload failed' });
  }
};
