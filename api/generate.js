// api/generate.js
// PAID ONLY — Uses Anthropic Claude for premium quality documents
// Verifies Stripe payment server-side before generating

import Stripe from 'stripe'
import { parseBody } from '../lib/parse-body.js'
import { logError, logWarn, logInfo } from '../lib/logger.js'
import { buildReceipt, renderProvenanceBlock, appendToAuditLog } from '../lib/doc-hash.js'
import { getRedis } from '../lib/redis.js'
import { buildDpaSystemPrompt } from './v1/documents/clauses.js'

// Redis helpers (Upstash REST API) — gracefully degrade if env vars are missing
async function redisGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    return json.result ?? null
  } catch {
    return null
  }
}

async function redisSet(key, ttlSeconds) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/1/ex/${ttlSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // non-fatal
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = await parseBody(req)
  const { prompt, sessionId, oxapayTrackId, promoToken } = body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  // FIX 3: Prompt length limit
  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long. Maximum 8000 characters.' })
  }

  if (!sessionId && !oxapayTrackId && !promoToken) {
    return res.status(403).json({
      error: 'Payment verification required. Use /api/generate-preview for free previews.',
    })
  }

  // Verify promo token if that's the auth method
  if (promoToken && !sessionId && !oxapayTrackId) {
    try {
      const verifyRes = await fetch(`https://${req.headers.host}/api/promo-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: promoToken }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok || !verifyData.valid) {
        return res.status(403).json({ error: 'Invalid or expired promo token.' })
      }
    } catch (promoErr) {
      logError('/generate', { message: 'Promo token verification failed', error: promoErr.message })
      return res.status(500).json({ error: 'Promo verification failed. Please try again.' })
    }
  }

  // FIX 1: OxaPay server-side verification
  if (oxapayTrackId) {
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY
    if (!merchantKey) {
      return res.status(500).json({ error: 'Server misconfigured — missing OxaPay merchant key' })
    }
    try {
      const oxaRes = await fetch('https://api.oxapay.com/merchants/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchantKey, trackId: oxapayTrackId }),
      })
      const oxaData = await oxaRes.json()
      if (oxaData.result !== 100) {
        logWarn('/generate', {
          message: `OxaPay inquiry failed for trackId ${oxapayTrackId}`,
          result: oxaData.result,
        })
        return res.status(403).json({ error: 'OxaPay payment verification failed.' })
      }
      if (oxaData.status !== 'Paid' && oxaData.status !== 'Confirming') {
        logWarn('/generate', {
          message: `OxaPay payment not complete for trackId ${oxapayTrackId}`,
          status: oxaData.status,
        })
        return res.status(403).json({
          error: `OxaPay payment not completed (status: ${oxaData.status}). Please complete payment first.`,
        })
      }
      logInfo('/generate', { message: `OxaPay payment verified for trackId ${oxapayTrackId}`, status: oxaData.status })
    } catch (oxaErr) {
      logError('/generate', { message: 'OxaPay payment verification failed', error: oxaErr.message })
      return res.status(500).json({ error: 'OxaPay payment verification failed. Please try again.' })
    }

    // FIX 2: Idempotency check for OxaPay
    const oxaRedisKey = `payment:used:oxapay:${oxapayTrackId}`
    const oxaUsed = await redisGet(oxaRedisKey)
    if (oxaUsed) {
      logWarn('/generate', { message: `OxaPay trackId already used: ${oxapayTrackId}` })
      return res.status(409).json({ error: 'This payment has already been used to generate a document.' })
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logWarn('/generate', { message: 'Redis unavailable — skipping idempotency check for OxaPay' })
    }
  }

  if (sessionId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return res.status(500).json({ error: 'Server misconfigured — missing Stripe key' })
    }
    try {
      const stripe = new Stripe(stripeKey)
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.payment_status !== 'paid') {
        logWarn('/generate', { message: `Session ${sessionId} payment_status: ${session.payment_status}` })
        return res.status(403).json({
          error: `Payment not completed (status: ${session.payment_status}). Please complete payment first.`,
        })
      }
    } catch (verifyErr) {
      logError('/generate', { message: 'Stripe payment verification failed', error: verifyErr.message })
      return res.status(500).json({ error: 'Payment verification failed. Please try again.' })
    }

    // FIX 2: Idempotency check for Stripe
    const stripeRedisKey = `payment:used:stripe:${sessionId}`
    const stripeUsed = await redisGet(stripeRedisKey)
    if (stripeUsed) {
      logWarn('/generate', { message: `Stripe sessionId already used: ${sessionId}` })
      return res.status(409).json({ error: 'This payment has already been used to generate a document.' })
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logWarn('/generate', { message: 'Redis unavailable — skipping idempotency check for Stripe' })
    }
  }

  // Payment verified — generate premium document with Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing Anthropic key' })

  const isDpa = prompt.toLowerCase().includes('data processing agreement') || prompt.toLowerCase().includes('dpa')
  const isNigeria = prompt.toLowerCase().includes('nigeria')
  const nigeriaClause = isNigeria && !isDpa
    ? '\n\nIMPORTANT — NIGERIAN JURISDICTION: When the governing law is Nigeria, strictly apply the Nigeria Data Protection Act 2023 (NDPA), NDPC GAID guidelines, and CBN regulations where relevant. Include clauses for: Lawful Basis for data processing (NDPA Section 25), Data Subject Rights (Section 34), DPO designation requirements, 72-hour breach notification to the NDPC (Section 41), and Cross-Border Transfer restrictions (Section 43). Reference the Companies and Allied Matters Act (CAMA) 2020 for corporate governance matters.'
    : ''
  const systemPrompt = isDpa
    ? buildDpaSystemPrompt('Nigeria — NDPA 2023') + '\n\nThis is a premium paid document — make it exceptional.'
    : 'You are an expert legal document drafter with deep knowledge of international law. Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.' + nigeriaClause

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
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
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
    const rawText = data.content[0]?.text || ''

    // Stamp a content hash + verifiable provenance block onto the document.
    // The hash is deterministic from the body, so anyone holding the doc
    // can verify it byte-for-byte via /trust or POST /api/verify.
    const receipt = buildReceipt(rawText, {
      doc_tier: 'premium',
      word_count: rawText.split(/\s+/).filter(Boolean).length,
    })

    // Append to the tamper-evident audit chain. Non-fatal on failure —
    // the document is still stamped with its hash + signature regardless.
    let auditEntry = null
    try {
      const redis = getRedis()
      auditEntry = await appendToAuditLog(redis, receipt)
    } catch (err) {
      logWarn('/generate', { message: 'Audit log append failed (non-fatal)', error: err.message })
    }

    const text = rawText + renderProvenanceBlock(receipt)
    logInfo('/generate', {
      success: true,
      text_length: text.length,
      hash: receipt.fingerprint,
      audit_sequence: auditEntry?.sequence ?? null,
    })

    // FIX 2: Mark payment credential as used AFTER successful generation
    if (sessionId) {
      await redisSet(`payment:used:stripe:${sessionId}`, 86400)
    }
    if (oxapayTrackId) {
      await redisSet(`payment:used:oxapay:${oxapayTrackId}`, 86400)
    }

    res.status(200).json({
      text,
      isPremium: true,
      receipt,
      audit: auditEntry
        ? { sequence: auditEntry.sequence, entry_hash: auditEntry.entry_hash, prev_hash: auditEntry.prev_hash }
        : null,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      logError('/generate', { message: 'Generate timeout' })
      return res.status(504).json({ error: 'Generation timed out. Please try again.' })
    }
    logError('/generate', { message: err.message, stack: err.stack })
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
}
