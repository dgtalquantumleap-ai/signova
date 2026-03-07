// api/generate-preview.js
// Uses Groq (fast + near free) for watermarked previews
// Real customers get Anthropic quality via api/generate.js after payment

// ── Rate limiting ──────────────────────────────────────────────────────────
// Uses Upstash Redis in production (persists across serverless cold starts).
// Falls back to in-memory Map in local dev when env vars are missing.

let ratelimit = null

async function initRatelimit() {
  if (ratelimit) return ratelimit
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    const { Redis } = await import('@upstash/redis')
    const { Ratelimit } = await import('@upstash/ratelimit')
    const redis = new Redis({ url, token })
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 previews per IP per hour
      analytics: false,
    })
  }
  return ratelimit
}

// In-memory fallback (dev only — resets on every cold start in prod)
const RATE_LIMIT_FALLBACK = new Map()
function isRateLimitedFallback(ip) {
  const now = Date.now()
  const entry = RATE_LIMIT_FALLBACK.get(ip)
  if (!entry || now > entry.resetAt) {
    RATE_LIMIT_FALLBACK.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 3) return true
  entry.count++
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Rate limiting
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'

  const rl = await initRatelimit()
  if (rl) {
    const { success } = await rl.limit(ip)
    if (!success) {
      return res.status(429).json({
        error: 'You have used your free previews for this hour. Pay $4.99 to generate and download your document.',
        rateLimited: true,
      })
    }
  } else {
    // fallback for local dev
    if (isRateLimitedFallback(ip)) {
      return res.status(429).json({
        error: 'You have used your free previews for this hour. Pay $4.99 to generate and download your document.',
        rateLimited: true,
      })
    }
  }

  const { prompt } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured' })

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
            content:
              'You are a legal document drafting assistant. Generate professional, comprehensive legal documents based on the user details provided. Use formal legal language with clear numbered sections. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res
        .status(response.status)
        .json({ error: err.error?.message || 'Preview generation failed' })
    }

    const data = await response.json()
    const text = data.choices[0]?.message?.content || ''
    res.status(200).json({ text, isPreview: true })
  } catch (err) {
    console.error('Preview generate error:', err)
    res.status(500).json({ error: 'Preview generation failed. Please try again.' })
  }
}
