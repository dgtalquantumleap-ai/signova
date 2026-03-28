// api/v1/billing/webhook.js
// POST https://api.ebenova.dev/v1/billing/webhook
// Stripe webhook handler — provisions/updates API keys on subscription events.
//
// Register this URL in Stripe dashboard:
//   stripe.com → Developers → Webhooks → Add endpoint
//   URL: https://api.ebenova.dev/v1/billing/webhook
//   Events to listen for:
//     - checkout.session.completed
//     - customer.subscription.updated
//     - customer.subscription.deleted
//     - invoice.payment_failed

import Stripe from 'stripe'
import { getRedis, apiKeyRedisKey } from '../../../lib/redis.js'
import { randomBytes } from 'crypto'

const TIER_LIMITS = {
  starter: 100,
  growth:  500,
  scale:   2000,
}

function generateKey() {
  return `sk_live_${randomBytes(24).toString('hex')}`
}

// Raw body needed for Stripe signature verification
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function provisionKey(redis, email, tier, stripeCustomerId, stripeSubscriptionId) {
  // Check if this customer already has a key — update rather than create new
  const existingKeyRef = await redis.get(`customer:${stripeCustomerId}:apikey`)

  if (existingKeyRef) {
    // Update existing key's tier + limit
    const keyData = await redis.get(apiKeyRedisKey(existingKeyRef))
    if (keyData) {
      const parsed = typeof keyData === 'string' ? JSON.parse(keyData) : keyData
      parsed.tier = tier
      parsed.monthlyLimit = TIER_LIMITS[tier] || 100
      parsed.disabled = false
      parsed.stripeSubscriptionId = stripeSubscriptionId
      await redis.set(apiKeyRedisKey(existingKeyRef), JSON.stringify(parsed))
      console.log(`Updated existing key for ${email} → tier: ${tier}`)
      return { key: existingKeyRef, isNew: false }
    }
  }

  // Create new key
  const key = generateKey()
  const keyData = {
    owner: email,
    tier,
    monthlyLimit: TIER_LIMITS[tier] || 100,
    label: `${tier.charAt(0).toUpperCase() + tier.slice(1)} subscription`,
    createdAt: new Date().toISOString(),
    disabled: false,
    stripeCustomerId,
    stripeSubscriptionId,
  }

  await redis.set(apiKeyRedisKey(key), JSON.stringify(keyData))
  await redis.set(`customer:${stripeCustomerId}:apikey`, key)
  await redis.set(`customer:${stripeCustomerId}:email`, email)

  console.log(`Provisioned new key for ${email} → tier: ${tier}`)
  return { key, isNew: true }
}

async function disableKey(redis, stripeCustomerId, reason) {
  const existingKey = await redis.get(`customer:${stripeCustomerId}:apikey`)
  if (!existingKey) return

  const keyData = await redis.get(apiKeyRedisKey(existingKey))
  if (!keyData) return

  const parsed = typeof keyData === 'string' ? JSON.parse(keyData) : keyData
  parsed.disabled = true
  parsed.disabledReason = reason
  parsed.tier = 'free'
  parsed.monthlyLimit = 5
  await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
  console.log(`Disabled key for customer ${stripeCustomerId} — reason: ${reason}`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    const stripe = new Stripe(stripeKey)
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('Redis unavailable:', err.message)
    return res.status(500).json({ error: 'Storage unavailable' })
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break

        const stripe = new Stripe(stripeKey)
        const subscription = await stripe.subscriptions.retrieve(session.subscription)
        const customer = await stripe.customers.retrieve(session.customer)

        const email = customer.email || session.customer_details?.email
        const tier = subscription.metadata?.tier || session.metadata?.tier || 'starter'

        if (!email) {
          console.error('No email found for checkout session:', session.id)
          break
        }

        const { key, isNew } = await provisionKey(
          redis, email, tier,
          session.customer,
          session.subscription,
        )

        // Send key to user via email (Resend)
        if (isNew) {
          await sendWelcomeEmail(email, key, tier)
        }

        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const tier = sub.metadata?.tier
        if (!tier) break

        const customerId = sub.customer
        const existingKey = await redis.get(`customer:${customerId}:apikey`)
        if (!existingKey) break

        const keyData = await redis.get(apiKeyRedisKey(existingKey))
        if (!keyData) break

        const parsed = typeof keyData === 'string' ? JSON.parse(keyData) : keyData
        parsed.tier = tier
        parsed.monthlyLimit = TIER_LIMITS[tier] || parsed.monthlyLimit
        parsed.disabled = sub.status !== 'active'
        await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await disableKey(redis, sub.customer, 'subscription_cancelled')
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        // Grace period — don't immediately disable, just log
        // After 3 failed attempts Stripe will fire subscription.deleted
        console.log(`Payment failed for customer ${invoice.customer} — invoice ${invoice.id}`)
        break
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Handler failed' })
  }
}

async function sendWelcomeEmail(email, apiKey, tier) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  const tierLabels = { starter: 'Starter (100 docs/mo)', growth: 'Growth (500 docs/mo)', scale: 'Scale (2,000 docs/mo)' }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Ebenova API <api@ebenova.dev>',
        to: email,
        subject: `Your Ebenova API key — ${tierLabels[tier] || tier}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;">
            <h1 style="font-size:24px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">
              Your API key is ready 🎉
            </h1>
            <p style="color:#555;margin-bottom:32px;">
              Thanks for subscribing to Ebenova ${tierLabels[tier] || tier}. 
              Here's your API key — store it somewhere safe.
            </p>

            <div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:32px;">
              <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">
                Your API Key
              </p>
              <code style="color:#c9a84c;font-family:monospace;font-size:14px;word-break:break-all;">
                ${apiKey}
              </code>
            </div>

            <p style="color:#555;font-size:14px;margin-bottom:24px;">
              Add it to your requests like this:
            </p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:32px;">
              <code style="font-family:monospace;font-size:12px;color:#333;">
                Authorization: Bearer ${apiKey}
              </code>
            </div>

            <div style="margin-bottom:32px;">
              <a href="https://ebenova.dev/docs" 
                 style="display:inline-block;background:#c9a84c;color:#0e0e0e;padding:14px 28px;
                        border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">
                View Documentation →
              </a>
            </div>

            <p style="color:#999;font-size:13px;">
              Questions? Reply to this email or reach us at 
              <a href="mailto:api@ebenova.dev" style="color:#c9a84c;">api@ebenova.dev</a>
            </p>
          </div>
        `,
      }),
    })
  } catch (err) {
    console.error('Welcome email failed:', err.message)
    // Non-fatal
  }
}
