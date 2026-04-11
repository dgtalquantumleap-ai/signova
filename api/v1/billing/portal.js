// api/v1/billing/portal.js
// POST https://api.ebenova.dev/v1/billing/portal
// Creates a Stripe Customer Portal session so users can manage their subscription.
// Requires: Authorization: Bearer sk_live_...

import Stripe from 'stripe'
import { authenticate } from '../../../lib/api-auth.js'

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

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Billing not configured' } })
  }

  const body = await parseBody(req)
  const returnUrl = body.return_url || 'https://ebenova.dev/dashboard'

  // Look up Stripe customer ID for this API key
  const stripeCustomerId = auth.keyData?.stripeCustomerId
  if (!stripeCustomerId) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'NO_SUBSCRIPTION',
        message: 'No Stripe subscription found for this API key',
        hint: 'Upgrade at ebenova.dev/pricing',
      },
    })
  }

  try {
    const stripe = new Stripe(stripeKey)
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    })

    return res.status(200).json({
      success: true,
      portal_url: session.url,
    })
  } catch (err) {
    console.error('Portal error:', err)
    return res.status(500).json({
      success: false,
      error: { code: 'STRIPE_ERROR', message: err.message },
    })
  }
}
