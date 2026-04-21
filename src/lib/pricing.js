// src/lib/pricing.js
//
// Client-side pricing helper. Fetches the visitor's regional tier from
// /api/v1/pricing/detect-region and returns a stable shape for UI use.
//
// ─────────────────────────────────────────────────────────────────────────────
// Tier table MUST match api/v1/pricing/detect-region.js and api/stripe-checkout.js.
// If you add a tier or change a USD amount, update all three in the same PR.
// ─────────────────────────────────────────────────────────────────────────────
//
// Display convention:
//   - Stripe-paying visitors (everyone except NG) always see the USD tier price.
//     No local-currency approximation. The old CURRENCY_MAP was replaced because
//     maintaining 49 rows × 3 tiers drifts with FX and creates bait-and-switch
//     risk at checkout.
//   - Nigerian visitors (NG) see a compound "₦6,900 via Paystack · $4.99 via card"
//     because they have two payment rails priced differently. That's computed
//     in the UI, not here — this module stays payment-agnostic.

export const PRICING_TIERS = {
  africa:   { priceUsd: 4.99,  unitAmount: 499,  display: '$4.99',  label: 'Africa' },
  emerging: { priceUsd: 7.99,  unitAmount: 799,  display: '$7.99',  label: 'Emerging markets' },
  western:  { priceUsd: 14.99, unitAmount: 1499, display: '$14.99', label: 'Standard' },
}

// Safe revenue-protecting fallback. If region detection fails for any reason
// (network error, malformed response, edge function cold-miss), we show the
// highest tier rather than underpricing. This is reversed server-side by
// stripe-checkout.js anyway — the user's final charge is determined there,
// not here — but we keep the UI consistent.
const FALLBACK = { tier: 'western', country: 'unknown', paystackAvailable: false, ...PRICING_TIERS.western }

/**
 * Fetch the visitor's regional pricing. Safe to call on component mount.
 *
 * @returns {Promise<{
 *   tier: 'africa'|'emerging'|'western',
 *   country: string,
 *   priceUsd: number,
 *   unitAmount: number,
 *   display: string,
 *   label: string,
 *   paystackAvailable: boolean,
 * }>}
 */
export async function fetchUserPricing() {
  try {
    const res = await fetch('/api/v1/pricing/detect-region', { cache: 'no-store' })
    if (!res.ok) throw new Error(`Region detection failed: ${res.status}`)
    const data = await res.json()
    if (!data.tier || !PRICING_TIERS[data.tier]) return FALLBACK
    return {
      tier: data.tier,
      country: data.country || 'unknown',
      paystackAvailable: Boolean(data.paystackAvailable),
      ...PRICING_TIERS[data.tier],
    }
  } catch {
    return FALLBACK
  }
}
