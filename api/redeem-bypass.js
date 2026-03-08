// api/redeem-bypass.js
// Verifies a bypass code by recomputing the expected HMAC — no Redis required.
// Codes are valid for the current UTC day and expire at midnight.

import { createHmac } from 'crypto'

function encodeBase32(num) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  let n = Math.abs(num)
  for (let i = 0; i < 5; i++) {
    result = chars[n % 32] + result
    n = Math.floor(n / 32)
  }
  return result
}

function getExpectedCode(secret) {
  const dayToken = Math.floor(Date.now() / 86400000)
  const hmac = createHmac('sha256', secret)
    .update(String(dayToken))
    .digest()
  const num = hmac.readUInt32BE(0)
  return 'SIG-' + encodeBase32(num)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { code, prompt } = req.body

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing bypass code.' })
  }
  if (!prompt) {
    return res.status(400).json({ error: 'Missing document prompt.' })
  }

  const adminSecret = process.env.BYPASS_ADMIN_SECRET
  if (!adminSecret) {
    return res.status(500).json({ error: 'Server misconfigured — contact hello@getsignova.com.' })
  }

  const normalised = code.trim().toUpperCase()
  const expected = getExpectedCode(adminSecret)

  if (normalised !== expected) {
    return res.status(400).json({
      error: 'Invalid or expired code. Codes expire at midnight — contact hello@getsignova.com if you need a new one.',
    })
  }

  console.log(`[Bypass] Code redeemed: ${normalised}`)

  // Generate premium document with Anthropic Claude
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured — contact hello@getsignova.com.' })
  }

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
          'You are an expert legal document drafter with deep knowledge of international law. Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(500).json({ error: err.error?.message || 'Document generation failed. Please try again.' })
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''

    return res.status(200).json({ text, isPremium: true, bypassUsed: true })
  } catch (err) {
    console.error('[Bypass] Generation error:', err)
    return res.status(500).json({ error: 'Something went wrong. Please try again or contact hello@getsignova.com.' })
  }
}
