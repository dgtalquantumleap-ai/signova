// api/stripe-checkout.js
// Creates a Stripe Checkout Session for Signova document purchase
// Replaces Polar checkout — YOU are the merchant, not a MoR

import Stripe from 'stripe'
import { parseBody } from '../lib/parse-body.js'
import { logError } from '../lib/logger.js'

// ─────────────────────────────────────────────────────────────────────────────
// TIER SETS MUST MATCH between this file and api/v1/pricing/detect-region.js.
// If you add or remove a country here, update detect-region.js in the same PR.
// Divergence would cause the visitor to see one price and be charged another,
// which is a consumer-protection violation in most destinations we serve.
//
// Tier logic runs ENTIRELY SERVER-SIDE. We never trust a tier sent from the
// browser — a user in London cannot post {tier:'africa'} and pay $4.99. The
// only input is the Vercel edge header x-vercel-ip-country, which the client
// cannot forge.
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
  if (AFRICA_COUNTRIES.has(country)) return { tier: 'africa', unitAmount: 499 }
  if (EMERGING_COUNTRIES.has(country)) return { tier: 'emerging', unitAmount: 799 }
  return { tier: 'western', unitAmount: 1499 }
}

// Stripe client initialised lazily inside handler — avoids boot crash when env var missing
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { docType, docName } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  // Server-side tier detection. We intentionally ignore any `tier` field the
  // client may have sent in the body — the only authoritative input is the
  // Vercel edge header, which the browser cannot set. See note at top of file.
  const country = req.headers['x-vercel-ip-country'] || 'XX'
  const { tier, unitAmount } = detectTier(country)

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Server misconfigured — missing Stripe key' })
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/preview?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/preview?payment=cancelled`,
      metadata: {
        docType: docType || '',
        docName: docName || '',
        // Tier + country are stored in metadata so stripe-verify.js and any
        // downstream reporting can reconstruct what the visitor actually paid
        // and why. unitAmount is also recorded so we can spot drift between
        // tier → unitAmount derivation across versions of this file.
        tier,
        country,
        unitAmount: String(unitAmount),
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
