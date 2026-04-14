// api/scope-guard-checkout.js
// Creates a Stripe Checkout Session for Scope Guard Pro subscription ($9.99/mo)

import Stripe from 'stripe'
import { parseBody } from '../lib/parse-body.js'
import { logError, logInfo } from '../lib/logger.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Server misconfigured — missing Stripe key' })
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Scope Guard Pro',
              description: 'Unlimited scope violation analyses, 500 documents/month, change order generation, 18 jurisdictions',
            },
            unit_amount: 999, // $9.99 in cents
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/scope-guard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/scope-guard?upgrade=cancelled`,
      customer_email: email || undefined,
      metadata: {
        product: 'scope-guard-pro',
      },
      allow_promotion_codes: true,
    })

    logInfo('/scope-guard-checkout', { sessionId: session.id })
    res.status(200).json({ url: session.url })
  } catch (err) {
    logError('/scope-guard-checkout', { message: err.message, stack: err.stack })
    res.status(500).json({ error: 'Could not create checkout session. Please try again.' })
  }
}
