// api/stripe-webhook.js
// POST https://api.ebenova.dev/stripe-webhook  (or /api/stripe-webhook via Vercel rewrite)
//
// Stripe webhook endpoint that:
//   1. Verifies the Stripe signature (raw body required — NEVER parse before verify)
//   2. checkout.session.completed  → provisions API key in Redis + emails user
//   3. customer.subscription.deleted → disables the key in Redis
//
// Redis key schema:
//   apikey:{key}        → JSON { owner, tier, monthlyLimit, label, createdAt, disabled }
//   usage:{key}:{YYYY-MM} → integer
//   owner:{email}       → key   (reverse lookup so dashboard can find key by email)
//   customer:{id}:apikey → key  (Stripe customer → key)
//   customer:{id}:email  → email

import Stripe from 'stripe'
import { Redis } from '@upstash/redis'
import { randomBytes } from 'crypto'

// ─── Constants ──────────────────────────────────────────────────────────────

const TIER_LIMITS = {
  free:       5,
  starter:    100,
  growth:     500,
  scale:      2000,
  enterprise: 99999,
}

// Normalise insights tier names → base tier for key limits
const INSIGHTS_TIER_MAP = {
  insights_starter: 'starter',
  insights_growth:  'growth',
  insights_scale:   'scale',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Missing Upstash env vars')
  return new Redis({ url, token })
}

function generateKey() {
  return `sk_live_${randomBytes(24).toString('hex')}`
}

function apiKeyRedisKey(key) {
  return `apikey:${key}`
}

/** Collect raw request body as a Buffer (required for Stripe sig verification). */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    )
    req.on('end',   () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ─── Key provisioning ───────────────────────────────────────────────────────

async function provisionKey(redis, email, tier, stripeCustomerId, stripeSubscriptionId) {
  const normalEmail = email.toLowerCase().trim()

  // Check if this Stripe customer already has a key — update in place
  const existingKey = await redis.get(`customer:${stripeCustomerId}:apikey`)
  if (existingKey) {
    const raw = await redis.get(apiKeyRedisKey(existingKey))
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      parsed.tier              = tier
      parsed.monthlyLimit      = TIER_LIMITS[tier] ?? 100
      parsed.disabled          = false
      parsed.stripeSubscriptionId = stripeSubscriptionId
      await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
      console.log(`[stripe-webhook] Updated key for ${normalEmail} → tier: ${tier}`)
      return { key: existingKey, isNew: false }
    }
  }

  // New key
  const key = generateKey()
  const keyData = {
    owner:               normalEmail,
    tier,
    monthlyLimit:        TIER_LIMITS[tier] ?? 100,
    label:               `${tier.charAt(0).toUpperCase() + tier.slice(1)} subscription`,
    createdAt:           new Date().toISOString(),
    disabled:            false,
    stripeCustomerId,
    stripeSubscriptionId,
  }

  await redis.set(apiKeyRedisKey(key), JSON.stringify(keyData))
  await redis.set(`customer:${stripeCustomerId}:apikey`, key)
  await redis.set(`customer:${stripeCustomerId}:email`,  normalEmail)
  // Reverse lookup: owner:{email} → key (used by /v1/keys/self-serve)
  await redis.set(`owner:${normalEmail}`, key)

  console.log(`[stripe-webhook] Provisioned new key for ${normalEmail} → tier: ${tier}`)
  return { key, isNew: true }
}

async function disableKey(redis, stripeCustomerId) {
  const existingKey = await redis.get(`customer:${stripeCustomerId}:apikey`)
  if (!existingKey) return

  const raw = await redis.get(apiKeyRedisKey(existingKey))
  if (!raw) return

  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  parsed.disabled        = true
  parsed.disabledReason  = 'subscription_cancelled'
  parsed.tier            = 'free'
  parsed.monthlyLimit    = 5
  await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
  console.log(`[stripe-webhook] Disabled key for customer ${stripeCustomerId}`)
}

// ─── Email ───────────────────────────────────────────────────────────────────

async function sendWelcomeEmail(email, apiKey, tier) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[stripe-webhook] RESEND_API_KEY not set — skipping welcome email')
    return
  }

  const tierLabel = {
    starter: 'Starter',
    growth:  'Growth',
    scale:   'Scale',
  }[tier] || tier

  const monthlyLimit = TIER_LIMITS[tier] ?? 100
  const limitLabel   = monthlyLimit >= 99999
    ? 'Unlimited'
    : `${monthlyLimit.toLocaleString()} docs/month`

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:48px 24px;">

    <!-- Header -->
    <div style="margin-bottom:40px;">
      <span style="font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c9a84c;">Ebenova</span>
      <h1 style="font-size:26px;font-weight:700;color:#f0ece4;margin:12px 0 0;">Your API key is ready</h1>
      <p style="color:#888;font-size:15px;margin:8px 0 0;">
        You're subscribed to the <strong style="color:#c9a84c;">${tierLabel} plan</strong> — ${limitLabel}.
      </p>
    </div>

    <!-- Key card -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:28px;margin-bottom:32px;">
      <p style="color:#888;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">
        Your API Key
      </p>
      <div style="background:#0e0e0e;border:1px solid #333;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
        <code style="color:#c9a84c;font-family:'Courier New',Courier,monospace;font-size:13px;word-break:break-all;line-height:1.6;">
          ${apiKey}
        </code>
      </div>
      <p style="color:#e05252;font-size:13px;font-weight:600;margin:0;">
        &#9888; Store this key securely — it cannot be retrieved again
      </p>
    </div>

    <!-- Usage snippet -->
    <div style="background:#111;border-left:3px solid #c9a84c;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:32px;">
      <p style="color:#888;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">How to use</p>
      <code style="color:#f0ece4;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.8;">
        Authorization: Bearer ${apiKey}
      </code>
    </div>

    <!-- Plan details -->
    <div style="background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:24px;margin-bottom:32px;">
      <p style="color:#888;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">Plan details</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:6px 0;color:#888;">Plan</td>
          <td style="padding:6px 0;color:#f0ece4;text-align:right;">${tierLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">Monthly limit</td>
          <td style="padding:6px 0;color:#f0ece4;text-align:right;">${limitLabel}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#888;">Key prefix</td>
          <td style="padding:6px 0;color:#f0ece4;text-align:right;font-family:monospace;font-size:12px;">sk_live_...</td>
        </tr>
      </table>
    </div>

    <!-- CTAs -->
    <div style="display:flex;gap:12px;margin-bottom:40px;flex-wrap:wrap;">
      <a href="https://ebenova.dev/dashboard"
         style="display:inline-block;background:#c9a84c;color:#0e0e0e;padding:14px 26px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;margin-right:12px;margin-bottom:8px;">
        View Dashboard
      </a>
      <a href="https://ebenova.dev/docs"
         style="display:inline-block;background:transparent;color:#c9a84c;padding:14px 26px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;border:1px solid #c9a84c;margin-bottom:8px;">
        Read the Docs
      </a>
    </div>

    <!-- Footer -->
    <hr style="border:none;border-top:1px solid #1e1e1e;margin:0 0 24px;">
    <p style="color:#555;font-size:13px;margin:0;">
      Questions? Reply to this email or reach us at
      <a href="mailto:api@ebenova.dev" style="color:#c9a84c;text-decoration:none;">api@ebenova.dev</a>
    </p>
    <p style="color:#333;font-size:12px;margin:8px 0 0;">
      Ebenova &mdash; Legal &amp; Business APIs
    </p>
  </div>
</body>
</html>`

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from:    'Ebenova <api@ebenova.dev>',
        to:      email,
        subject: `Your Ebenova API key — ${tierLabel} plan`,
        html,
      }),
    })
    if (!resp.ok) {
      const body = await resp.text()
      console.error(`[stripe-webhook] Resend error ${resp.status}:`, body)
    } else {
      console.log(`[stripe-webhook] Welcome email sent to ${email}`)
    }
  } catch (err) {
    // Non-fatal — key is already provisioned
    console.error('[stripe-webhook] sendWelcomeEmail failed:', err.message)
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeKey     = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeKey || !webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET')
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  // MUST collect raw body before any JSON.parse — Stripe validates the raw bytes
  const rawBody = await getRawBody(req)
  const sig     = req.headers['stripe-signature']

  let event
  try {
    const stripe = new Stripe(stripeKey)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[stripe-webhook] Redis unavailable:', err.message)
    return res.status(500).json({ error: 'Storage unavailable' })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break

        const stripe       = new Stripe(stripeKey)
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        const customer     = await stripe.customers.retrieve(session.customer)

        const email = customer.email || session.customer_details?.email
        if (!email) {
          console.error('[stripe-webhook] No email on session:', session.id)
          break
        }

        const rawTier = subscription.metadata?.tier || session.metadata?.tier || 'starter'
        const product = subscription.metadata?.product || session.metadata?.product || 'api'

        // Resolve the base tier (handles insights_* variants too)
        const tier = INSIGHTS_TIER_MAP[rawTier] ?? (TIER_LIMITS[rawTier] !== undefined ? rawTier : 'starter')

        const { key, isNew } = await provisionKey(
          redis, email, tier, session.customer, session.subscription,
        )

        // Also ensure owner:{email} reverse-lookup is set (provisionKey only sets it on isNew)
        if (!isNew) {
          await redis.set(`owner:${email.toLowerCase().trim()}`, key)
        }

        if (isNew) {
          await sendWelcomeEmail(email, key, tier)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub     = event.data.object
        const product = sub.metadata?.product || 'api'

        if (product === 'insights') {
          // Remove Insights access but keep the key active
          const existingKey = await redis.get(`customer:${sub.customer}:apikey`)
          if (existingKey) {
            const raw = await redis.get(apiKeyRedisKey(existingKey))
            if (raw) {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
              parsed.insights     = false
              parsed.insightsPlan = null
              await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
            }
          }
        } else {
          await disableKey(redis, sub.customer)
        }
        break
      }

      default:
        // Unhandled event type — acknowledge and move on
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err)
    return res.status(500).json({ error: 'Handler failed' })
  }
}
