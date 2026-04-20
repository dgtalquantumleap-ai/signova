// api/v1/keys/self-serve.js
// POST /v1/keys/self-serve
//
// Lets a user look up their own API key by email after a Stripe checkout.
// Body: { email, session_id }
//
// Flow:
//   1. Verify the Stripe session is paid (payment_status === 'paid')
//   2. Look up the key via owner:{email} in Redis
//   3. Return the key data (key string, tier, monthlyLimit)
//
// This is called from the dashboard after Stripe redirects back with
// ?subscribed=1&session_id=cs_xxx so the user can see their key.

import Stripe from 'stripe'
import { getRedis, apiKeyRedisKey } from '../../../lib/redis.js'
import { parseBody } from '../../../lib/parse-body.js'
import { applyCorsHeaders, handleOptions } from '../../../lib/cors-middleware.js'

export default async function handler(req, res) {
  applyCorsHeaders(req, res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Billing not configured' } })
  }

  const body = await parseBody(req)
  const { email, session_id } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'email is required' },
    })
  }

  if (!session_id || typeof session_id !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'session_id is required' },
    })
  }

  // ── Verify Stripe session is actually paid ───────────────────────────────
  try {
    const stripe  = new Stripe(stripeKey)
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status !== 'paid') {
      return res.status(402).json({
        success: false,
        error: { code: 'PAYMENT_INCOMPLETE', message: 'Session has not been paid yet' },
      })
    }

    // Confirm the email matches the session (anti-enumeration)
    const sessionEmail = (
      session.customer_details?.email ||
      session.customer_email ||
      ''
    ).toLowerCase().trim()

    const providedEmail = email.toLowerCase().trim()

    if (sessionEmail && sessionEmail !== providedEmail) {
      return res.status(403).json({
        success: false,
        error: { code: 'EMAIL_MISMATCH', message: 'Email does not match this session' },
      })
    }
  } catch (err) {
    console.error('[self-serve] Stripe session lookup failed:', err.message)
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SESSION', message: 'Could not verify Stripe session' },
    })
  }

  // ── Look up key in Redis ─────────────────────────────────────────────────
  try {
    const redis          = getRedis()
    const normalEmail    = email.toLowerCase().trim()
    const key            = await redis.get(`owner:${normalEmail}`)

    if (!key) {
      // Key may not be provisioned yet (webhook slightly delayed) — tell client to retry
      return res.status(404).json({
        success: false,
        error: {
          code:    'KEY_NOT_FOUND',
          message: 'API key not yet provisioned. Please wait a moment and try again.',
        },
      })
    }

    const raw     = await redis.get(apiKeyRedisKey(key))
    const keyData = typeof raw === 'string' ? JSON.parse(raw) : raw

    if (!keyData) {
      return res.status(404).json({
        success: false,
        error: { code: 'KEY_DATA_MISSING', message: 'Key record missing — contact support' },
      })
    }

    return res.status(200).json({
      success:       true,
      api_key:       key,
      tier:          keyData.tier,
      monthly_limit: keyData.monthlyLimit,
      label:         keyData.label,
      created_at:    keyData.createdAt,
      disabled:      keyData.disabled ?? false,
    })
  } catch (err) {
    console.error('[self-serve] Redis lookup failed:', err.message)
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to look up API key' },
    })
  }
}
