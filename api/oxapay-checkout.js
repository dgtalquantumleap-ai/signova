// api/oxapay-checkout.js
// Creates an Oxapay USDT/crypto invoice for Signova document purchase.
//
// Pricing is server-side tiered — same $4.99 / $7.99 / $14.99 USD tiers
// as Stripe, derived from x-vercel-ip-country. The frontend can still
// pass an explicit `amount` override (e.g. for future promo flows), but
// when it's absent we derive from the tier just like stripe-checkout.js.
//
// ─────────────────────────────────────────────────────────────────────────────
// TIER SETS MUST MATCH api/stripe-checkout.js and api/v1/pricing/detect-region.js.
// If you add or remove a country here, update the other two in the same PR.
// ─────────────────────────────────────────────────────────────────────────────

const AFRICA_COUNTRIES = new Set([
  'NG', 'KE', 'GH', 'ZA', 'TZ', 'UG', 'RW', 'CI', 'SN', 'CM', 'EG', 'MA', 'ET',
  'ZW', 'BW', 'NA', 'ZM', 'MW', 'BJ', 'BF', 'ML', 'MZ', 'AO', 'SL', 'LR', 'TG',
])

const EMERGING_COUNTRIES = new Set([
  // Core emerging (Asia)
  'IN', 'PK', 'BD', 'LK', 'NP', 'PH', 'ID', 'VN', 'TH', 'MY', 'KH', 'MM',
  // LATAM
  'BR', 'MX', 'CO', 'AR', 'CL', 'PE',
  // MENA (Turkey only — Egypt/Morocco stay in Africa tier)
  'TR',
  // Eastern Europe
  'PL', 'RO', 'HU', 'UA',
])

function detectTier(country) {
  if (AFRICA_COUNTRIES.has(country)) return { tier: 'africa', priceUsd: 4.99 }
  if (EMERGING_COUNTRIES.has(country)) return { tier: 'emerging', priceUsd: 7.99 }
  return { tier: 'western', priceUsd: 14.99 }
}

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
  const { docType, docName, currency = 'USD', description, lifetime = 30 } = body

  // Server-side tier detection from Vercel edge header. The client cannot
  // forge x-vercel-ip-country, so this is the authoritative source — same
  // pattern as stripe-checkout.js.
  const country = req.headers['x-vercel-ip-country'] || 'XX'
  const { tier, priceUsd } = detectTier(country)

  // Allow an explicit override from trusted server-side callers (promo
  // flows, tests). Any override MUST be a positive number; anything else
  // falls back to the tier-derived amount.
  const amount = (typeof body.amount === 'number' && body.amount > 0)
    ? body.amount
    : priceUsd

  const origin = req.headers.origin || 'https://getsignova.com'

  try {
    const response = await fetch('https://api.oxapay.com/merchants/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: process.env.OXAPAY_MERCHANT_KEY,
        amount,
        currency,
        lifeTime: lifetime,
        feePaidByPayer: 1,
        callbackUrl: `${origin}/api/oxapay-webhook`,
        returnUrl: `${origin}/preview?payment=oxapay_success`,
        description: description || `Signova — ${docName || 'Document'}`,
        orderId: `${docType || 'payment'}_${Date.now()}`,
      }),
    })

    const json = await response.json()

    // OxaPay returns result: 100 for success
    if (json.result !== 100) {
      console.error('OxaPay checkout error:', JSON.stringify(json))
      throw new Error(json.message || 'Could not create payment invoice.')
    }

    res.status(200).json({
      url: json.payLink,
      trackId: json.trackId,
      // Echo back what we actually billed so the frontend can display it
      // consistently and stripe-verify-style sanity checks can compare.
      amount,
      tier,
      country,
    })
  } catch (err) {
    console.error('OxaPay checkout error:', err)
    res.status(500).json({ error: err.message })
  }
}
