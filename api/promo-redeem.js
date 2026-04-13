// Promo code redemption — bypasses payment, grants one free document download

// ── In-memory rate limiter (5 attempts per IP per hour) ─────────────────────
const PROMO_RATE = new Map()
function isPromoRateLimited(ip) {
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

// ── Persistent use tracking via Upstash Redis ──────────────────────────────
// Falls back to in-memory if Redis env vars are missing (local dev)
const CODE_USE_COUNT_FALLBACK = new Map()

async function getUseCount(code) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return CODE_USE_COUNT_FALLBACK.get(code) || 0
  try {
    const r = await fetch(`${url}/get/promo_uses:${code}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    return parseInt(json.result || '0', 10)
  } catch { return CODE_USE_COUNT_FALLBACK.get(code) || 0 }
}

async function incrementUseCount(code) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    CODE_USE_COUNT_FALLBACK.set(code, (CODE_USE_COUNT_FALLBACK.get(code) || 0) + 1)
    return
  }
  try {
    await fetch(`${url}/incr/promo_uses:${code}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch { CODE_USE_COUNT_FALLBACK.set(code, (CODE_USE_COUNT_FALLBACK.get(code) || 0) + 1) }
}

const VALID_CODES = {
  PRODUCTHUNT: {
    expiresAt: new Date('2026-04-09T23:59:59Z'),
    maxUses: 100,
    description: 'Product Hunt launch — 1 free document',
  },
  SIGNOVA10: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 500,
    description: 'General discount — 1 free document',
  },
  OLUMIDE: {
    expiresAt: new Date('2027-12-31T23:59:59Z'),
    maxUses: 9999,
    description: 'Founder access — unlimited testing',
  },
  AFRICA: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 1200,
    description: 'Taryl African Founders Community — 1 free document per member',
  },
  KREDO: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 20,
    description: 'Kredo partnership — 1 free document for Kredo early users',
  },
  // ── Accelerator cohort codes ──────────────────────────────────────────────
  MEST2026: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 100,
    description: 'MEST cohort — 1 free document per founder',
  },
  CCHUBNIG: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 200,
    description: 'CcHUB Nigeria — 1 free document per member',
  },
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
  TEF2026: {
    expiresAt: new Date('2026-12-31T23:59:59Z'),
    maxUses: 1000,
    description: 'Tony Elumelu Foundation — 1 free document per entrepreneur',
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
  if (isPromoRateLimited(ip)) {
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

  // Enforce maxUses — persisted in Upstash Redis across cold starts
  const currentUses = await getUseCount(upperCode)
  if (currentUses >= promo.maxUses) {
    return res.status(400).json({ valid: false, error: 'This promo code has reached its usage limit.' })
  }
  await incrementUseCount(upperCode)

  const secret = process.env.PROMO_SECRET || 'signova_promo_2026'
  const timestamp = Date.now()
  const payload = `${upperCode}::${timestamp}`

  const { createHmac } = await import('crypto')
  const sig = createHmac('sha256', secret).update(payload).digest('hex').slice(0, 16)
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
