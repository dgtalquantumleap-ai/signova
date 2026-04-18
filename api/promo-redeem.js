// Promo code redemption — bypasses payment, grants one free document download

import { createHash } from 'node:crypto'

// ── In-memory rate limiter fallback (5 attempts per IP per hour) ─────────────
const PROMO_RATE = new Map()
function isPromoRateLimitedInMemory(ip) {
  const now = Date.now()
  const entry = PROMO_RATE.get(ip)
  if (!entry || now > entry.resetAt) {
    PROMO_RATE.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

async function isPromoRateLimited(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // No Redis — fall back to in-memory (acceptable for local dev)
    return isPromoRateLimitedInMemory(ip)
  }
  const key = `promo_ratelimit:${ip}`
  try {
    // INCR + EXPIRE pattern: atomic count increment, set TTL only on first hit
    const incrRes = await fetch(`${url}/incr/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const incrJson = await incrRes.json()
    const count = parseInt(incrJson.result, 10)
    if (count === 1) {
      // First request in window — set 1 hour TTL
      await fetch(`${url}/expire/${key}/3600`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    return count > 5
  } catch {
    return isPromoRateLimitedInMemory(ip)
  }
}

// ── High-cap abuse protection threshold ──────────────────────────────────
// Codes with maxUses >= HIGH_CAP_THRESHOLD get two extra anti-abuse checks:
//   1. Per-email dedup (one redemption per email per code, if email provided)
//   2. Per-IP usage cap (up to HIGH_CAP_PER_IP_LIMIT redemptions per IP per code
//      — covers families, co-working spaces, carrier-grade NAT while still
//      bounding viral abuse)
// Small codes (personal + small-cohort, < 100 uses) skip these checks entirely
// because the maxUses cap already bounds their worst case to ~$1-2 of AI cost.
const HIGH_CAP_THRESHOLD = 100
const HIGH_CAP_PER_IP_LIMIT = 5
const IP_USE_TTL_SECONDS = 30 * 24 * 60 * 60  // 30 days
const EMAIL_USE_TTL_SECONDS = 365 * 24 * 60 * 60  // 1 year

// Hash before storing as key material — avoids leaking raw emails / IPs into
// Redis and avoids key-length issues. `createHash` imported at top of file.
function hashKey(parts) {
  return createHash('sha256').update(parts.join('::')).digest('hex')
}

// Per-IP usage counter per code. INCR + EXPIRE-on-first-hit pattern mirrors
// the rate limiter above. Returns { ok, count }. ok=false means this IP has
// already redeemed the code too many times.
async function checkAndIncrementIpUse(ip, code) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const key = `promo_ip_used:${hashKey([ip, code])}`
  if (!url || !token) {
    // In-memory fallback — use the same Map as codeUseCount; key is the full
    // ip+code hash so no collision with promo-use counters
    const current = CODE_USE_COUNT_FALLBACK.get(key) || 0
    const next = current + 1
    if (next > HIGH_CAP_PER_IP_LIMIT) return { ok: false, count: current }
    CODE_USE_COUNT_FALLBACK.set(key, next)
    return { ok: true, count: next }
  }
  try {
    const r = await fetch(`${url}/incr/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = await r.json()
    const count = parseInt(j.result, 10)
    if (count === 1) {
      await fetch(`${url}/expire/${key}/${IP_USE_TTL_SECONDS}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    if (count > HIGH_CAP_PER_IP_LIMIT) {
      // Undo the increment — this redemption won't proceed
      await fetch(`${url}/decr/${key}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return { ok: false, count: count - 1 }
    }
    return { ok: true, count }
  } catch {
    // On Redis failure, fail open (don't block legit users over infra flakes)
    return { ok: true, count: 1 }
  }
}

// Per-email-per-code dedup. Returns { ok: false } if this email already used
// this code, { ok: true } otherwise. On ok:true we SET the key so future
// attempts are blocked. If Redis is unavailable we fail open.
async function claimEmailForCode(email, code) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const key = `promo_email_used:${hashKey([email.toLowerCase().trim(), code])}`
  if (!url || !token) {
    if (CODE_USE_COUNT_FALLBACK.has(key)) return { ok: false }
    CODE_USE_COUNT_FALLBACK.set(key, 1)
    return { ok: true }
  }
  try {
    // SETNX: set only if not exists, atomic claim. TTL set separately.
    const r = await fetch(`${url}/setnx/${key}/1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = await r.json()
    if (j.result === 0 || j.result === '0') return { ok: false }  // key existed
    await fetch(`${url}/expire/${key}/${EMAIL_USE_TTL_SECONDS}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return { ok: true }
  } catch {
    return { ok: true }  // fail open on Redis errors
  }
}

// Compensating action if a later check fails after we already incremented
// the main use counter. Keeps the total accurate.
async function rollbackUseCount(code) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    const current = CODE_USE_COUNT_FALLBACK.get(code) || 0
    if (current > 0) CODE_USE_COUNT_FALLBACK.set(code, current - 1)
    return
  }
  try {
    await fetch(`${url}/decr/promo_uses:${code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch { /* best-effort rollback */ }
}

// ── Persistent use tracking via Upstash Redis ──────────────────────────────
// Falls back to in-memory if Redis env vars are missing (local dev)
const CODE_USE_COUNT_FALLBACK = new Map()

async function atomicIncrementUseCount(code, maxUses) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // In-memory fallback — also atomic within a single process
    const current = CODE_USE_COUNT_FALLBACK.get(code) || 0
    const newCount = current + 1
    if (newCount > maxUses) return { ok: false }
    CODE_USE_COUNT_FALLBACK.set(code, newCount)
    return { ok: true, count: newCount }
  }
  try {
    // INCR returns the new value atomically
    const r = await fetch(`${url}/incr/promo_uses:${code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    const newCount = parseInt(json.result, 10)
    if (newCount > maxUses) {
      // Undo the increment — limit exceeded
      await fetch(`${url}/decr/promo_uses:${code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      return { ok: false }
    }
    return { ok: true, count: newCount }
  } catch {
    // Fallback on Redis error
    const current = CODE_USE_COUNT_FALLBACK.get(code) || 0
    const newCount = current + 1
    if (newCount > maxUses) return { ok: false }
    CODE_USE_COUNT_FALLBACK.set(code, newCount)
    return { ok: true, count: newCount }
  }
}

const VALID_CODES = {
  OLUMIDE: {
    expiresAt: new Date('2027-12-31T23:59:59Z'),
    maxUses: 50,
    description: 'Founder access — internal testing only',
  },
  AFRICA: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 300,
    description: 'Taryl African Founders Community — 1 free document per member',
  },
  FUTUREAFRICA: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 500,
    description: 'Future Africa community — 1 free document per member',
  },
  KATE: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 50,
    description: 'KATE promo — 1 free document per use',
  },
  IRENE: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 20,
    description: 'IRENE promo — 1 free document per use',
  },
  KREDO: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 20,
    description: 'Kredo partnership — 1 free document for Kredo early users',
  },
  // ── Accelerator cohort codes ──────────────────────────────────────────────
  BAOBAB26: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 80,
    description: 'Baobab Network cohort — 1 free document per founder',
  },
  ACCLAFRICA: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 50,
    description: 'Accelerate Africa cohort — 1 free document per founder',
  },
  ROSEMARY: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 10,
    description: 'Single-use promo — 1 free document',
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Rate limit by IP — prevent brute-force code guessing
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  if (await isPromoRateLimited(ip)) {
    return res.status(429).json({ valid: false, error: 'Too many attempts. Please try again later.' })
  }

  const { code, docType, docName, email } = req.body

  if (!code || !docType) {
    return res.status(400).json({ error: 'Missing code or docType' })
  }

  const upperCode = code.toUpperCase().trim()
  const promo = VALID_CODES[upperCode]

  if (!promo) {
    return res.status(400).json({ valid: false, error: 'Invalid promo code.' })
  }

  const now = new Date()
  if (now > promo.expiresAt) {
    return res.status(400).json({ valid: false, error: 'This promo code has expired.' })
  }

  // Enforce maxUses — persisted in Upstash Redis across cold starts (atomic)
  const result = await atomicIncrementUseCount(upperCode, promo.maxUses)
  if (!result.ok) {
    return res.status(400).json({ valid: false, error: 'This promo code has reached its usage limit.' })
  }

  // High-cap abuse protections (only for codes with maxUses >= HIGH_CAP_THRESHOLD).
  // Small codes (personal + small-cohort) skip this block — their own maxUses
  // cap already bounds worst-case damage. Big community codes get:
  //   - Per-IP cap of 5 redemptions per code (covers families / co-working / CGNAT
  //     while stopping viral abuse where one IP burns 50+ seats)
  //   - Per-email dedup (if caller provides email) — one redemption per email
  //     per code, 1-year memory
  if (promo.maxUses >= HIGH_CAP_THRESHOLD) {
    const ipCheck = await checkAndIncrementIpUse(ip, upperCode)
    if (!ipCheck.ok) {
      await rollbackUseCount(upperCode)
      return res.status(400).json({
        valid: false,
        error: 'This code has been redeemed too many times from your location. If you\u2019re part of this community, please contact the admin for a personal code.',
      })
    }
    if (email && typeof email === 'string' && email.includes('@')) {
      const emailCheck = await claimEmailForCode(email, upperCode)
      if (!emailCheck.ok) {
        await rollbackUseCount(upperCode)
        return res.status(400).json({
          valid: false,
          error: 'This promo code has already been redeemed with this email address.',
        })
      }
    }
  }

  const secret = process.env.PROMO_SECRET
  if (!secret) return res.status(500).json({ valid: false, error: 'Server misconfigured — promo system unavailable.' })
  const timestamp = Date.now()
  const payload = `${upperCode}::${timestamp}`

  const { createHmac } = await import('crypto')
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  const token = Buffer.from(`${payload}:${sig}`).toString('base64url')

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Signova <noreply@getsignova.com>',
        to: 'info@ebenova.net',
        subject: `Promo used: ${upperCode} — ${docName}`,
        html: `<p>Code <strong>${upperCode}</strong> redeemed for <strong>${docName}</strong></p>`,
      }),
    })
  } catch {
    // Ignore notification errors
  }

  return res.status(200).json({
    valid: true,
    token,
    message: `Code applied! Your free ${docName} download is unlocked.`,
  })
}
