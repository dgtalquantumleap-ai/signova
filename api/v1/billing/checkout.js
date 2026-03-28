// api/v1/billing/checkout.js
// POST https://api.ebenova.dev/v1/billing/checkout
// Creates a Stripe Checkout session for an API subscription.
// Returns a checkout URL — redirect the user there to complete payment.
//
// Request body:
// {
//   "tier": "starter" | "growth" | "scale",
//   "email": "user@example.com",       // pre-fill checkout form
//   "success_url": "https://...",       // redirect after payment (optional)
//   "cancel_url": "https://..."         // redirect on cancel (optional)
// }

import Stripe from 'stripe'

const PRICE_IDS = {
  // Set these in Vercel env vars after creating products in Stripe dashboard:
  // stripe.com/products → Create product → Add price (recurring, monthly)
  starter:    process.env.STRIPE_PRICE_STARTER,   // $29/mo
  growth:     process.env.STRIPE_PRICE_GROWTH,    // $79/mo
  scale:      process.env.STRIPE_PRICE_SCALE,     // $199/mo
}

const TIER_LABELS = {
  starter: 'Starter — 100 docs/month',
  growth:  'Growth — 500 docs/month',
  scale:   'Scale — 2,000 docs/month',
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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Billing not configured' } })
  }

  const body = await parseBody(req)
  const {
    tier,
    email,
    success_url = 'https://ebenova.dev/dashboard?subscribed=1',
    cancel_url  = 'https://ebenova.dev/pricing',
  } = body

  if (!tier || !PRICE_IDS[tier]) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TIER',
        message: `tier must be one of: ${Object.keys(PRICE_IDS).join(', ')}`,
      },
    })
  }

  const priceId = PRICE_IDS[tier]
  if (!priceId) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'PRICE_NOT_CONFIGURED',
        message: `Stripe price ID not set for tier "${tier}". Add STRIPE_PRICE_${tier.toUpperCase()} to env vars.`,
      },
    })
  }

  const stripe = new Stripe(stripeKey)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(email ? { customer_email: email } : {}),
      success_url: `${success_url}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url,
      metadata: { tier },
      subscription_data: {
        metadata: { tier },
      },
      allow_promotion_codes: true,
    })

    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      tier,
      label: TIER_LABELS[tier],
    })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return res.status(500).json({
      success: false,
      error: { code: 'STRIPE_ERROR', message: err.message },
    })
  }
}
