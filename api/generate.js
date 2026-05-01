export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { assetDesc, prompt, referenceDesc, hasReference } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  const referenceContext = hasReference
    ? `\n\nThe user has also uploaded a REFERENCE VIDEO. Analyse its style and incorporate those visual aesthetics, pacing, colour grade, and editing rhythm into your plan.`
    : '';

  const fullPrompt = `You are FrameAI v3, a professional video editor AI. ${referenceContext}

Assets uploaded:
${assetDesc || '(none)'}

${hasReference ? `Reference video provided: Yes — match its style, pacing and colour grade.` : ''}

Edit instruction: ${prompt}

Produce a detailed VIDEO EDIT PLAN:
1. PROJECT OVERVIEW (style, mood, target platform)
2. SCENE SEQUENCE (clip name, in/out points, transition type)
3. COLOUR & STYLE (match reference if provided, grade name, LUT, temp/contrast/sat values)
4. AUDIO PLAN (music genre, BPM, sound design, voiceover timing)
5. TEXT & GRAPHICS (overlay text, position, font style, timing)
6. EXPORT SETTINGS (resolution, fps, codec, bitrate)

Be extremely specific and professional.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://frameai-sable.vercel.app',
        'X-Title': 'FrameAI v3'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
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
