// api/generate-preview.js
// Uses Groq (fast + near free) for watermarked previews

const RATE_LIMIT = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = RATE_LIMIT.get(ip)
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 3) return true
  entry.count++
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'You have used your 3 free previews for this hour. Pay $4.99 to generate and download your document.',
      rateLimited: true,
    })
  }

  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing GROQ key' })

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content: 'You are a legal document drafting assistant. Generate professional, comprehensive legal documents based on the user details provided. Use formal legal language with clear numbered sections. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      let errMsg = 'Preview generation failed'
      try {
        const errBody = await response.json()
        errMsg = errBody.error?.message || errMsg
      } catch {
        try { errMsg = await response.text() } catch {}
      }
      console.error('Groq error:', response.status, errMsg)
      return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    if (!text) return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
    return res.status(200).json({ text, isPreview: true })
  } catch (err) {
    console.error('Preview generate error:', err)
    return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
  }
}
