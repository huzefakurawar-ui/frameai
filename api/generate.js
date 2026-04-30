export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { assetDesc, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const fullPrompt = `You are FrameAI, a professional video editor AI assistant. Produce a clear VIDEO EDIT PLAN with:
1. PROJECT OVERVIEW
2. SCENE SEQUENCE (asset, timestamps, transitions, effects)
3. COLOUR & STYLE (grade, LUT, adjustments)
4. AUDIO PLAN (music, sound design, voiceover)
5. EXPORT SETTINGS (resolution, fps, codec)

Assets uploaded:
${assetDesc || '(none)'}

Edit instruction:
${prompt}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        })
      }
    );

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
    return res.status(200).json({ result: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
