// api/stripe-checkout.js
// Creates a Stripe Checkout Session for Signova document purchase
// Replaces Polar checkout — YOU are the merchant, not a MoR

import Stripe from 'stripe'
import { parseBody } from '../lib/parse-body.js'
import { logError, logInfo } from '../lib/logger.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { docType, docName } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Signova Legal Document: ${docName || docType}`,
              description: 'AI-generated legal document template — instant PDF download',
            },
            unit_amount: 499, // $4.99 in cents
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/preview?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/preview?payment=cancelled`,
      metadata: {
        docType: docType || '',
        docName: docName || '',
      },
      // Collect email for receipt
      customer_email: undefined, // Let Stripe collect it
      billing_address_collection: 'auto',
      // Automatic tax calculation (optional — requires Stripe Tax setup)
      // automatic_tax: { enabled: true },
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    logError('/stripe-checkout', { message: err.message, stack: err.stack })
    res.status(500).json({ error: err.message })
  }
}
