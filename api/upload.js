export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(500).json({ error: 'Blob storage not configured' });

    // Return token info so frontend can upload directly
    return res.status(200).json({
      token,
      uploadUrl: 'https://blob.vercel-storage.com'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
