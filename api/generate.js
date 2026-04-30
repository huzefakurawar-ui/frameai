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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://frameai-sable.vercel.app',
        'X-Title': 'FrameAI'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout:free',
        messages: [{ role: 'user', content: fullPrompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const text = data.choices?.[0]?.message?.content || 'No response.';
    return res.status(200).json({ result: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
