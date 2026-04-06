// api/generate-preview.js
// Uses Groq (fast + near free) for watermarked previews
// Rate limiting: simple token bucket per IP, resets on cold start
// At current scale this is sufficient — add Redis when abuse is detected

import { parseBody } from '../lib/parse-body.js'
import { logError, logInfo } from '../lib/logger.js'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_PER_WINDOW = 3

const ipStore = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = ipStore.get(ip)
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_PER_WINDOW) return true
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

  const body = await parseBody(req)
  const { prompt } = body
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
      logError('/generate-preview', { status: response.status, message: errMsg })
      return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    if (!text) return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
    
    logInfo('/generate-preview', { success: true, text_length: text.length })
    return res.status(200).json({ text, isPreview: true })
  } catch (err) {
    logError('/generate-preview', { message: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
  }
}
