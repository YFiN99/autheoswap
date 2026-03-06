// api/get-token-meta.js
// GET /api/get-token-meta?address=0x...
// Fetch token metadata from Shelby storage

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  try {
    const storageAcct = process.env.SHELBY_STORAGE_ACCOUNT;
    if (!storageAcct) return res.status(500).json({ error: 'SHELBY_STORAGE_ACCOUNT not set' });

    const metaUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${storageAcct}/metadata/${address.toLowerCase()}.json`;
    const r = await fetch(metaUrl);

    if (!r.ok) return res.status(404).json({ error: 'Metadata not found' });

    const meta = await r.json();
    return res.status(200).json(meta);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
