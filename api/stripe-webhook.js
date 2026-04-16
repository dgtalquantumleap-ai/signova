// api/stripe-webhook.js — DEPRECATED
// Canonical handler is at api/v1/billing/webhook.js
// This file exists only to return 410 for any stale Stripe webhook registrations.
// Remove this URL from Stripe dashboard: stripe.com → Developers → Webhooks
export default async function handler(_req, res) {
  res.status(410).json({
    error: 'This webhook URL is deprecated. The active endpoint is /v1/billing/webhook.'
  })
}
