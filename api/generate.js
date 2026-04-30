export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { assetDesc, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const systemPrompt = `You are FrameAI, a professional video editor AI assistant. Produce a clear VIDEO EDIT PLAN with:
1. PROJECT OVERVIEW
2. SCENE SEQUENCE (asset, timestamps, transitions, effects)
3. COLOUR & STYLE (grade, LUT, adjustments)
4. AUDIO PLAN (music, sound design, voiceover)
5. EXPORT SETTINGS (resolution, fps, codec)
Be specific and practical.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Assets:\n${assetDesc || '(none)'}\n\nEdit instruction:\n${prompt}` }]
      })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.content?.map(b => b.text || '').join('') || 'No response.';
    return res.status(200).json({ result: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
