// api/generate.js
// PAID ONLY — Uses Anthropic Claude for premium quality documents
// Verifies Stripe payment server-side before generating

import Stripe from 'stripe'

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = await parseBody(req)
  const { prompt, sessionId, oxapayTrackId } = body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  if (!sessionId && !oxapayTrackId) {
    return res.status(403).json({
      error: 'Payment verification required. Use /api/generate-preview for free previews.',
    })
  }

  // OxaPay payments are pre-verified in Preview.jsx before calling generate
  // Only verify Stripe sessions here
  if (sessionId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return res.status(500).json({ error: 'Server misconfigured — missing Stripe key' })
    }
    try {
      const stripe = new Stripe(stripeKey)
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.payment_status !== 'paid') {
        console.warn(`Session ${sessionId} payment_status: ${session.payment_status}`)
        return res.status(403).json({
          error: `Payment not completed (status: ${session.payment_status}). Please complete payment first.`,
        })
      }
    } catch (verifyErr) {
      console.error('Stripe payment verification failed:', verifyErr)
      return res.status(500).json({ error: 'Payment verification failed. Please try again.' })
    }
  }

  // Payment verified — generate premium document with Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing Anthropic key' })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90s timeout

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        system:
          'You are an expert legal document drafter with deep knowledge of international law. Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.',
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'Generation failed' })
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''
    res.status(200).json({ text, isPremium: true })
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Generate timeout:', err)
      return res.status(504).json({ error: 'Generation timed out. Please try again.' })
    }
    console.error('Generate error:', err)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
}
