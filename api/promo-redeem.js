// Promo code redemption — bypasses payment, grants one free document download

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
    maxUses: 1200,
    description: 'Taryl African Founders Community — 1 free document per member',
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

  const { code, docType, docName } = req.body

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
