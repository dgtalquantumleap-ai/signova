// api/promo-rollback.js
// Refunds a promo counter slot after a verified post-redeem step has
// terminally failed on the client — specifically, when /api/generate
// couldn't produce a premium Claude Sonnet version after the user redeemed
// the code. Without this endpoint, every regen failure permanently burned
// one of the code's maxUses slots (e.g. ROSEMARY's 10/10 would reach 10 of
// "claimed but never delivered" and the code would appear exhausted to real
// subsequent users).
//
// Security model:
//   - Caller must present the HMAC-signed token issued by /api/promo-redeem.
//     No token → no rollback. A malicious actor cannot refund arbitrary
//     codes because they don't hold valid signatures.
//   - Each token is single-use for rollback purposes. We remember the
//     rollback in Redis keyed by a hash of the token, with a 24h TTL.
//     This prevents the infinite-refund loop: redeem → rollback → redeem
//     → rollback → ... which would effectively uncap the code.
//   - The rollback key is sha256(token) rather than the token itself, so
//     even a Redis leak wouldn't expose live promo tokens.

import { rollbackUseCount } from './promo-redeem.js'
import { logError } from '../lib/logger.js'

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const ROLLBACK_TTL_SECONDS = 24 * 60 * 60 // 24h — tokens themselves expire in 2h, this is just a safety margin

// Track tokens that have already been rolled back to make rollback single-
// use per token. Falls back to in-memory Set if Redis is unavailable (dev /
// preview env). Memory fallback is best-effort only; a cold start will lose
// the set, but that's acceptable because the token itself expires in 2h.
const ROLLED_BACK_FALLBACK = new Set()

async function hasAlreadyBeenRolledBack(tokenHash) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return ROLLED_BACK_FALLBACK.has(tokenHash)
  }
  try {
    const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(`promo_rollback:${tokenHash}`)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    })
    const data = await res.json()
    return data.result !== null && data.result !== undefined
  } catch {
    return false
  }
}

async function markAsRolledBack(tokenHash) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    ROLLED_BACK_FALLBACK.add(tokenHash)
    return
  }
  try {
    await fetch(
      `${REDIS_URL}/setex/${encodeURIComponent(`promo_rollback:${tokenHash}`)}/${ROLLBACK_TTL_SECONDS}/1`,
      { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` } }
    )
  } catch (err) {
    logError('/promo-rollback', { message: 'Failed to mark token as rolled back', error: err?.message })
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token } = req.body || {}
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing token' })
  }

  // Verify the HMAC and extract the code. Reuse /api/promo-verify logic
  // rather than duplicating it — any bug fix there applies here too.
  let code
  try {
    const host = req.headers.host
    const proto = req.headers['x-forwarded-proto'] || 'https'
    const verifyRes = await fetch(`${proto}://${host}/api/promo-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const verifyData = await verifyRes.json()
    if (!verifyRes.ok || !verifyData.valid) {
      return res.status(400).json({ ok: false, error: verifyData.error || 'Invalid or expired token.' })
    }
    code = verifyData.code
  } catch (err) {
    logError('/promo-rollback', { message: 'Token verification failed', error: err?.message })
    return res.status(500).json({ ok: false, error: 'Could not verify token.' })
  }

  // Single-use rollback per token. Use a hash so the raw token never
  // appears as a Redis key (cheap defense-in-depth for the extremely
  // unlikely case someone dumps Upstash).
  const { createHash } = await import('crypto')
  const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 32)

  if (await hasAlreadyBeenRolledBack(tokenHash)) {
    // Not an error for the client — idempotent rollback means retrying is
    // safe. Caller just cares that "the slot is not burned for this token".
    return res.status(200).json({ ok: true, alreadyRolledBack: true })
  }

  try {
    await rollbackUseCount(code)
    await markAsRolledBack(tokenHash)
    return res.status(200).json({ ok: true, code })
  } catch (err) {
    logError('/promo-rollback', { message: 'Rollback failed', error: err?.message, code })
    return res.status(500).json({ ok: false, error: 'Rollback failed.' })
  }
}
