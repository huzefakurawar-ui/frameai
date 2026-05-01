export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { clips, settings } = req.body;
    if (!clips || clips.length === 0) {
      return res.status(400).json({ error: 'No clips provided' });
    }

    // Return the uploaded blob URL directly for download
    const outputUrl = clips[0].url;

    return res.status(200).json({
      success: true,
      outputUrl,
      message: 'Video ready'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
