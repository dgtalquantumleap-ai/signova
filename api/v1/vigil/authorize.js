// api/v1/vigil/authorize.js — POST /v1/vigil/authorize
// Proximity-based card authorization using the built-in Vigil engine.
// Falls back to external VIGIL_API_URL if set (future: dedicated Vigil backend).
import { authenticate, recordUsage, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'
import { decide } from '../../../lib/vigil-engine.js'
import {
  AUTH_TIERS, setCors, parseBody, checkVigilQuota, recordVigilUsage,
  getCardData, getGpsData, saveCardData,
} from '../../../lib/vigil-helpers.js'

// Simple in-memory demo rate limiter (per cold-start, good enough for demo abuse prevention)
const demoIpWindow = new Map()
function demoRateOk(ip) {
  const now = Date.now()
  const entry = demoIpWindow.get(ip) || { count: 0, ts: now }
  if (now - entry.ts > 60_000) { demoIpWindow.set(ip, { count: 1, ts: now }); return true }
  if (entry.count >= 10) return false
  entry.count++; demoIpWindow.set(ip, entry); return true
}

export default async function handler(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const body = await parseBody(req)

  // ── Demo mode — no auth required, local engine only ──
  if (body.demo === true) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown'
    if (!demoRateOk(ip)) {
      return res.status(429).json({ success: false, error: { code: 'DEMO_RATE_LIMITED', message: 'Too many demo requests. Sign up for a free API key.' } })
    }
    const required = ['card_id', 'merchant_name', 'merchant_country', 'amount_cents', 'currency']
    for (const f of required) {
      if (!body[f]) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: `Required: ${f}` } })
    }
    try {
      const event = {
        card_id: body.card_id,
        amount_cents: body.amount_cents,
        currency: body.currency,
        merchant: { name: body.merchant_name, country: body.merchant_country, mcc: body.mcc || null, lat: body.merchant_lat || null, lng: body.merchant_lng || null },
      }
      // Demo card profiles — pre-seeded, no Redis needed
      const DEMO_PROFILES = {
        card_01: { card_id: 'card_01', is_active: true, mode: 'home', radius_km: 50, home_lat: 51.0447, home_lng: -114.0719, travel_plans: [] },
        card_02: { card_id: 'card_02', is_active: true, mode: 'travel', radius_km: 50, home_lat: 43.6532, home_lng: -79.3832, travel_plans: [{ country: 'GB' }, { country: 'FR' }] },
        card_03: { card_id: 'card_03', is_active: true, mode: 'lockdown', radius_km: 50, home_lat: 40.7128, home_lng: -74.006, travel_plans: [] },
      }
      const card = DEMO_PROFILES[body.card_id] || DEMO_PROFILES['card_01']
      const gps = { lat: card.home_lat, lng: card.home_lng, accuracy_m: 20, age_ms: 5000, spoofed: false }
      const decision = decide(event, card, gps)
      return res.status(200).json({
        success: true,
        demo: true,
        authorization: {
          approved: decision.approved,
          reason_code: decision.reason_code,
          distance_km: decision.distance_km,
          processing_ms: decision.processing_ms,
          card_id: body.card_id,
          card_mode: card.mode,
          engine: 'demo',
        },
        transaction: { merchant_name: body.merchant_name, merchant_country: body.merchant_country, amount_cents: body.amount_cents, currency: body.currency },
      })
    } catch (err) {
      logError('vigil/authorize/demo', err)
      return res.status(500).json({ success: false, error: { code: 'DEMO_FAILED', message: 'Demo authorization failed.' } })
    }
  }

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  // Tier gating — Starter+ required
  if (!AUTH_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'Card authorization requires Starter plan or above', hint: 'Upgrade at ebenova.dev/pricing' },
    })
  }

  // Validate body BEFORE tracking (don't waste quota on bad requests)
  if (!body || typeof body !== 'object') return res.status(400).json({ success: false, error: { code: 'INVALID_BODY' } })
  const required = ['card_id', 'merchant_name', 'merchant_country', 'amount_cents', 'currency']
  for (const f of required) {
    if (!body[f]) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: `Required: ${f}` } })
  }

  // Check Vigil-specific monthly quota
  const quota = await checkVigilQuota(auth)
  if (!quota.ok) return res.status(429).json({ success: false, error: quota.error })

  await trackRequest(auth, req)

  // ── Try external Vigil backend first (if configured) ──
  const VIGIL_URL = process.env.VIGIL_API_URL
  if (VIGIL_URL) {
    try {
      const up = await fetch(`${VIGIL_URL}/api/v1/fraud/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VIGIL_API_SECRET || ''}`,
        },
        body: JSON.stringify(body),
      })
      const data = await up.json()
      if (up.ok) {
        await recordUsage(auth)
        await recordVigilUsage(auth)
        return res.status(200).json({ success: true, ...data, _usage: buildUsageBlock(auth) })
      }
      // If upstream fails, fall through to local engine
      console.warn('[vigil] Upstream returned', up.status, '— falling back to local engine')
    } catch (err) {
      console.warn('[vigil] Upstream unreachable — falling back to local engine:', err.message)
    }
  }

  // ── Local Vigil Engine (proximity-based authorization) ──
  try {
    // Build event object for the engine
    const event = {
      card_id: body.card_id,
      amount_cents: body.amount_cents,
      currency: body.currency,
      merchant: {
        name: body.merchant_name,
        country: body.merchant_country,
        mcc: body.mcc || null,
        lat: body.merchant_lat || null,
        lng: body.merchant_lng || null,
      },
    }

    // Get card + GPS from Redis (or use defaults if card not registered)
    let card = await getCardData(auth, body.card_id)
    if (!card) {
      // Auto-register card with sensible defaults on first authorization
      card = {
        card_id: body.card_id,
        is_active: true,
        mode: 'normal', // normal | travel | lockdown
        radius_km: 25,  // default 25km proximity radius
        home_lat: body.merchant_lat || null,
        home_lng: body.merchant_lng || null,
        travel_plans: [],
        created_at: new Date().toISOString(),
      }
      await saveCardData(auth, body.card_id, card)
    }

    const gps = await getGpsData(auth, body.card_id)

    // Run the decision engine
    const decision = decide(event, card, gps)

    await recordUsage(auth)
    await recordVigilUsage(auth)

    return res.status(200).json({
      success: true,
      authorization: {
        approved: decision.approved,
        reason_code: decision.reason_code,
        distance_km: decision.distance_km,
        processing_ms: decision.processing_ms,
        card_id: body.card_id,
        card_mode: card.mode,
        engine: 'local', // vs 'remote' when using external backend
      },
      transaction: {
        merchant_name: body.merchant_name,
        merchant_country: body.merchant_country,
        amount_cents: body.amount_cents,
        currency: body.currency,
      },
      _usage: buildUsageBlock(auth),
    })
  } catch (err) {
    logError('vigil/authorize', err)
    return res.status(500).json({
      success: false,
      error: { code: 'AUTHORIZATION_FAILED', message: 'Fraud check failed. Please retry.' },
    })
  }
}
