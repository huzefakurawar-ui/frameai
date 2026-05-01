import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Cloudinary not configured' });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'frameai';

    // Create signature
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      cloudName,
      apiKey,
      folder,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
