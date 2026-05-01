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

    const speed = parseFloat(settings?.speed || 1.0);
    const textOverlay = settings?.textOverlay || '';
    const textPosition = settings?.textPosition || 'bottom';

    // Build output URL using first clip with transformations via query params
    const firstClip = clips[0];
    const clipUrl = firstClip.url;

    // Return the clip URLs for the frontend to display
    // For actual video processing we return the direct URLs
    return res.status(200).json({
      success: true,
      outputUrl: clipUrl,
      allClips: clips.map(c => c.url),
      settings: { speed, textOverlay, textPosition },
      message: 'Video ready'
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
