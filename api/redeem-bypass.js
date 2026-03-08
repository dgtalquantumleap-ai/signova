// api/redeem-bypass.js
// Called when a customer enters their WhatsApp bypass code on the preview page.
// Validates the code, generates the premium document with Anthropic Claude,
// marks the code as used (single-use), and returns the document.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { code, prompt } = req.body

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing bypass code' })
  }
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' })
  }

  const normalised = code.trim().toUpperCase()

  // Validate format — must look like SIG-XXXXX
  if (!/^SIG-[A-Z0-9]{5}$/.test(normalised)) {
    return res.status(400).json({ error: 'Invalid code format. Codes look like SIG-7X9K2.' })
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url: redisUrl, token: redisToken })

    const value = await redis.get(`bypass:${normalised}`)

    if (!value) {
      return res.status(400).json({
        error: 'Code not found or expired. Codes are valid for 24 hours — contact hello@getsignova.com if you need a new one.',
      })
    }

    if (value === 'used') {
      return res.status(400).json({
        error: 'This code has already been used. Each code is single-use. Contact hello@getsignova.com if you need help.',
      })
    }

    // Mark as used immediately before generating — prevents race conditions
    await redis.set(`bypass:${normalised}`, 'used', { ex: 86400 })

    console.log(`[Bypass] Code redeemed: ${normalised}`)

    // Generate premium document with Anthropic Claude
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // Roll back the used flag if generation is going to fail anyway
      await redis.set(`bypass:${normalised}`, 'unused', { ex: 86400 })
      return res.status(500).json({ error: 'Server misconfigured — contact hello@getsignova.com' })
    }

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
          'You are an expert legal document drafter with deep knowledge of international law. Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      // Roll back so customer can try again
      await redis.set(`bypass:${normalised}`, 'unused', { ex: 86400 })
      const err = await response.json()
      return res.status(500).json({ error: err.error?.message || 'Document generation failed. Please try again.' })
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''

    return res.status(200).json({ text, isPremium: true, bypassUsed: true })
  } catch (err) {
    console.error('redeem-bypass error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again or contact hello@getsignova.com.' })
  }
}
