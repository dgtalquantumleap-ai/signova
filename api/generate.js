// api/generate.js
// PAID ONLY — Uses Anthropic Claude for premium quality documents
// Only called after Polar payment success is confirmed
// Do NOT call this for free previews — use api/generate-preview.js instead

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, paid } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  // Safety check — must include paid flag
  // Note: for stronger security, verify Polar webhook signature here in future
  if (!paid) {
    return res.status(403).json({
      error: 'Premium generation requires payment. Use /api/generate-preview for free previews.',
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system:
          'You are an expert legal document drafter with deep knowledge of international law. Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res
        .status(response.status)
        .json({ error: err.error?.message || 'Generation failed' })
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''
    res.status(200).json({ text, isPremium: true })
  } catch (err) {
    console.error('Generate error:', err)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
}
