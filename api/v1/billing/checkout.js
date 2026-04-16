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
import { parseBody } from '../../lib/parse-body.js'

const PRICE_IDS = {
  // Main API plans (ebenova.dev/dashboard)
  starter:           process.env.STRIPE_PRICE_STARTER,            // $29/mo
  growth:            process.env.STRIPE_PRICE_GROWTH,             // $79/mo
  scale:             process.env.STRIPE_PRICE_SCALE,              // $199/mo
  // Insights plans (ebenova.dev/insights)
  insights_starter:  process.env.STRIPE_PRICE_INSIGHTS_STARTER,   // $49/mo
  insights_growth:   process.env.STRIPE_PRICE_INSIGHTS_GROWTH,    // $99/mo
  insights_scale:    process.env.STRIPE_PRICE_INSIGHTS_SCALE,     // $249/mo
}

const TIER_LABELS = {
  starter:          'Starter — 100 docs/month',
  growth:           'Growth — 500 docs/month',
  scale:            'Scale — 2,000 docs/month',
  insights_starter: 'Insights Starter — 3 monitors, 20 keywords',
  insights_growth:  'Insights Growth — 20 monitors, 100 keywords',
  insights_scale:   'Insights Scale — 100 monitors, 500 keywords',
}

const INSIGHTS_TIERS = new Set(['insights_starter', 'insights_growth', 'insights_scale'])


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
    success_url,
    cancel_url,
  } = body

  const isInsights = INSIGHTS_TIERS.has(tier)
  const defaultSuccess = isInsights
    ? 'https://ebenova.dev/insights?subscribed=1'
    : 'https://ebenova.dev/dashboard?subscribed=1'
  const defaultCancel = isInsights
    ? 'https://ebenova.dev/insights'
    : 'https://ebenova.dev/pricing'

  const finalSuccessUrl = success_url || defaultSuccess
  const finalCancelUrl  = cancel_url  || defaultCancel

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
      success_url: `${finalSuccessUrl}${finalSuccessUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: finalCancelUrl,
      metadata: { tier, product: isInsights ? 'insights' : 'api' },
      subscription_data: {
        metadata: { tier, product: isInsights ? 'insights' : 'api' },
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
