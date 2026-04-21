// api/paystack-initialize.js
// Creates a Paystack transaction for Nigerian Naira payments
// Paystack docs: https://paystack.com/docs/api/transaction/#initialize

import { parseBody } from '../lib/parse-body.js'
import { logError } from '../lib/logger.js'

// ─────────────────────────────────────────────────────────────────────────────
// Paystack is the Nigerian Naira rail. This endpoint is reserved for buyers
// who would fall into the Africa pricing tier (principally Nigeria — Paystack
// itself is Nigeria-domiciled). Visitors from other tiers are routed to
// Stripe (USD cards) or Oxapay (USDT crypto) instead.
//
// The NGN amount (₦6,900 / 690000 kobo) is INTENTIONALLY decoupled from the
// USD tier value. It's a market-anchored Nigerian price point, not an FX
// conversion of $4.99. Do not change it as part of USD-tier pricing work.
// Any NGN-side price change should be a separate, deliberate PR.
//
// Tier sets MUST match api/stripe-checkout.js and api/v1/pricing/detect-region.js.
// We duplicate only the AFRICA_COUNTRIES set here because that's all Paystack
// needs to authorize; the emerging/western distinction is irrelevant to this
// rail.
// ─────────────────────────────────────────────────────────────────────────────

const AFRICA_COUNTRIES = new Set([
  'NG', 'KE', 'GH', 'ZA', 'TZ', 'UG', 'RW', 'CI', 'SN', 'CM', 'EG', 'MA', 'ET',
  'ZW', 'BW', 'NA', 'ZM', 'MW', 'BJ', 'BF', 'ML', 'MZ', 'AO', 'SL', 'LR', 'TG',
])

// Price in kobo (NGN smallest unit) — ₦6,900 = 690000 kobo.
// Market-anchored for Nigerian buyers. Not derived from USD tier pricing.
const AMOUNT_KOBO = 690000

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: 'Paystack not configured' })
  }

  // Tier guard — Paystack only serves the Africa tier. Any other region
  // gets a 403 and is steered back to the Stripe or Oxapay checkouts. This
  // blocks (for example) a UK buyer who switches to the Paystack button to
  // try to evade the $14.99 Western-tier Stripe charge.
  const country = req.headers['x-vercel-ip-country'] || 'XX'
  if (!AFRICA_COUNTRIES.has(country)) {
    return res.status(403).json({
      error: 'Paystack checkout is available for Nigerian customers only. Please use card or USDT payment.',
      code: 'PAYSTACK_REGION_BLOCKED',
      country,
    })
  }

  const { docType, docName, email } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  // Require a real email. Paystack pre-fills its checkout page with whatever
  // we send here, and shows the user a confusing 'link invalid / email
  // incomplete' error if it's our placeholder. Previously we silently
  // substituted 'customer@getsignova.com' which (a) landed users on a broken
  // Paystack page they couldn't fix, and (b) meant receipts went to an
  // address none of our customers own. 400-ing here forces the client to
  // collect a real email up front.
  const trimmedEmail = typeof email === 'string' ? email.trim() : ''
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  if (!isValidEmail) {
    return res.status(400).json({ error: 'Please enter your email to continue with Paystack.' })
  }

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: trimmedEmail,
        amount: AMOUNT_KOBO,
        currency: 'NGN',
        callback_url: `${origin}/preview?payment=paystack_success`,
        cancel_url: `${origin}/preview?payment=cancelled`,
        metadata: JSON.stringify({
          docType: docType || '',
          docName: docName || '',
          origin: 'getsignova.com',
          tier: 'africa',
          country,
        }),
      }),
    })

    const data = await response.json()

    if (!data.status) {
      logError('/paystack-initialize', { message: data.message })
      return res.status(500).json({ error: data.message || 'Paystack initialization failed' })
    }

    // Paystack returns { authorization_url, reference, access_code }
    res.status(200).json({
      url: data.data.authorization_url,
      reference: data.data.reference,
      accessCode: data.data.access_code,
    })
  } catch (err) {
    logError('/paystack-initialize', { message: err.message, stack: err.stack })
    res.status(500).json({ error: 'Could not initialize Paystack transaction' })
  }
}
