// api/v1/pricing/detect-region.js
// GET /api/v1/pricing/detect-region
//
// Returns which pricing tier a visitor should see based on their IP country
// (read from the Vercel edge header x-vercel-ip-country).
//
// Tier is ALWAYS re-verified server-side in stripe-checkout.js — this endpoint
// exists for display purposes only. A spoofed frontend cannot cause the user
// to actually pay the wrong price; the checkout endpoint re-derives tier from
// its own request headers, and stripe-verify.js sanity-checks the final
// amount_total.
//
// ─────────────────────────────────────────────────────────────────────────────
// TIER SETS MUST MATCH between api/stripe-checkout.js and this file.
// If you add or remove a country here, update stripe-checkout.js in the same PR.
// Mismatched sets would let a visitor see price X and get charged price Y,
// which is a consumer-protection violation in most of the destinations we serve.
// ─────────────────────────────────────────────────────────────────────────────

export const config = { runtime: 'edge' }

const AFRICA_COUNTRIES = new Set([
  'NG', 'KE', 'GH', 'ZA', 'TZ', 'UG', 'RW', 'CI', 'SN', 'CM', 'EG', 'MA', 'ET',
  'ZW', 'BW', 'NA', 'ZM', 'MW', 'BJ', 'BF', 'ML', 'MZ', 'AO', 'SL', 'LR', 'TG',
])

const EMERGING_COUNTRIES = new Set([
  // Core emerging (Asia)
  'IN', 'PK', 'BD', 'LK', 'NP', 'PH', 'ID', 'VN', 'TH', 'MY', 'KH', 'MM',
  // LATAM
  'BR', 'MX', 'CO', 'AR', 'CL', 'PE',
  // MENA (Turkey only — Egypt/Morocco stay in Africa tier per spec)
  'TR',
  // Eastern Europe
  'PL', 'RO', 'HU', 'UA',
])

// Tier → USD amount table. Kept colocated with the country sets so any
// audit can read one file to understand "what does country X pay".
const TIERS = {
  africa:   { priceUsd: 4.99,  unitAmount: 499,  display: '$4.99' },
  emerging: { priceUsd: 7.99,  unitAmount: 799,  display: '$7.99' },
  western:  { priceUsd: 14.99, unitAmount: 1499, display: '$14.99' },
}

export default async function handler(req) {
  const country = req.headers.get('x-vercel-ip-country') || 'XX'

  let tier
  if (AFRICA_COUNTRIES.has(country)) tier = 'africa'
  else if (EMERGING_COUNTRIES.has(country)) tier = 'emerging'
  else tier = 'western'

  const payload = {
    country,
    tier,
    ...TIERS[tier],
    // Paystack availability — only Nigerian buyers get the NGN rail.
    // Everyone else pays via Stripe (USD) or Oxapay (USDT).
    paystackAvailable: country === 'NG',
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Cache-Control: 1 hour per-edge. Country assignment is stable for a
      // given IP for much longer than that, but we keep the TTL short so
      // adjacent rollouts converge fast.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
