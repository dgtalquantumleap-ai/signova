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

const INSIGHTS_PLAN_MAP = {
  insights_starter: 'starter',
  insights_growth:  'growth',
  insights_scale:   'scale',
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

async function provisionInsightsKey(redis, email, insightsPlan, stripeCustomerId, stripeSubscriptionId) {
  // For Insights, we add insights:true to the key.
  // If the customer already has a main API key, upgrade it in place.
  // Otherwise create a new free-tier key with insights enabled.
  const existingKeyRef = await redis.get(`customer:${stripeCustomerId}:apikey`)

  if (existingKeyRef) {
    const raw = await redis.get(apiKeyRedisKey(existingKeyRef))
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      parsed.insights = true
      parsed.insightsPlan = insightsPlan
      parsed.disabled = false
      parsed.stripeSubscriptionId = stripeSubscriptionId
      await redis.set(apiKeyRedisKey(existingKeyRef), JSON.stringify(parsed))
      console.log(`Updated existing key for ${email} → insights: true, insightsPlan: ${insightsPlan}`)
      return { key: existingKeyRef, isNew: false }
    }
  }

  // No existing key — provision a new free key with Insights enabled
  const key = generateKey()
  const keyData = {
    owner: email,
    tier: 'free',
    monthlyLimit: 5,
    label: `Insights ${insightsPlan.charAt(0).toUpperCase() + insightsPlan.slice(1)}`,
    createdAt: new Date().toISOString(),
    disabled: false,
    insights: true,
    insightsPlan,
    stripeCustomerId,
    stripeSubscriptionId,
  }

  await redis.set(apiKeyRedisKey(key), JSON.stringify(keyData))
  await redis.set(`customer:${stripeCustomerId}:apikey`, key)
  await redis.set(`customer:${stripeCustomerId}:email`, email)
  console.log(`Provisioned Insights key for ${email} → insightsPlan: ${insightsPlan}`)
  return { key, isNew: true }
}

async function provisionScopeGuardKey(redis, email, tier, stripeCustomerId, stripeSubscriptionId) {
  // Scope Guard Pro: upgrade existing key with scopeGuard access, or create a new one.
  // The tier from checkout metadata determines the API tier (defaults to 'growth').
  const resolvedTier = tier || 'growth'
  const existingKeyRef = await redis.get(`customer:${stripeCustomerId}:apikey`)

  if (existingKeyRef) {
    const raw = await redis.get(apiKeyRedisKey(existingKeyRef))
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      parsed.scopeGuard = true
      parsed.scopeGuardPlan = 'pro'
      parsed.tier = resolvedTier
      parsed.monthlyLimit = TIER_LIMITS[resolvedTier] || parsed.monthlyLimit
      parsed.disabled = false
      parsed.stripeSubscriptionId = stripeSubscriptionId
      await redis.set(apiKeyRedisKey(existingKeyRef), JSON.stringify(parsed))
      console.log(`Updated existing key for ${email} → scopeGuard: true, tier: ${resolvedTier}`)
      return { key: existingKeyRef, isNew: false }
    }
  }

  // No existing key — provision a new one with Scope Guard enabled
  const key = generateKey()
  const keyData = {
    owner: email,
    tier: resolvedTier,
    monthlyLimit: TIER_LIMITS[resolvedTier] || 500,
    label: `Scope Guard Pro`,
    createdAt: new Date().toISOString(),
    disabled: false,
    scopeGuard: true,
    scopeGuardPlan: 'pro',
    stripeCustomerId,
    stripeSubscriptionId,
  }

  await redis.set(apiKeyRedisKey(key), JSON.stringify(keyData))
  await redis.set(`customer:${stripeCustomerId}:apikey`, key)
  await redis.set(`customer:${stripeCustomerId}:email`, email)
  await redis.set(`owner:${email.toLowerCase().trim()}`, key)
  console.log(`Provisioned Scope Guard Pro key for ${email} → tier: ${resolvedTier}`)
  return { key, isNew: true }
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
  // Reverse lookup: owner:{email} → key (used by /v1/keys/self-serve)
  await redis.set(`owner:${email.toLowerCase().trim()}`, key)

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
        const tier    = subscription.metadata?.tier    || session.metadata?.tier    || 'starter'
        const product = subscription.metadata?.product || session.metadata?.product || 'api'

        if (!email) {
          console.error('No email found for checkout session:', session.id)
          break
        }

        if (product === 'insights') {
          const insightsPlan = INSIGHTS_PLAN_MAP[tier] || 'starter'
          const { key, isNew } = await provisionInsightsKey(
            redis, email, insightsPlan, session.customer, session.subscription,
          )
          if (isNew) await sendInsightsWelcomeEmail(email, key, insightsPlan)
        } else if (product === 'scope-guard-pro') {
          const { key, isNew } = await provisionScopeGuardKey(
            redis, email, tier, session.customer, session.subscription,
          )
          if (isNew) await sendWelcomeEmail(email, key, tier)
        } else {
          const { key, isNew } = await provisionKey(
            redis, email, tier, session.customer, session.subscription,
          )
          if (isNew) await sendWelcomeEmail(email, key, tier)
        }

        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const tier    = sub.metadata?.tier
        const product = sub.metadata?.product || 'api'
        if (!tier) break

        const customerId = sub.customer
        const existingKey = await redis.get(`customer:${customerId}:apikey`)
        if (!existingKey) break

        const keyData = await redis.get(apiKeyRedisKey(existingKey))
        if (!keyData) break

        const parsed = typeof keyData === 'string' ? JSON.parse(keyData) : keyData

        if (product === 'insights') {
          parsed.insights = sub.status === 'active'
          parsed.insightsPlan = INSIGHTS_PLAN_MAP[tier] || 'starter'
        } else if (product === 'scope-guard-pro') {
          parsed.scopeGuard = sub.status === 'active'
          parsed.scopeGuardPlan = sub.status === 'active' ? 'pro' : null
          parsed.tier = tier
          parsed.monthlyLimit = TIER_LIMITS[tier] || parsed.monthlyLimit
        } else {
          parsed.tier = tier
          parsed.monthlyLimit = TIER_LIMITS[tier] || parsed.monthlyLimit
        }
        parsed.disabled = sub.status !== 'active'
        await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const product = sub.metadata?.product || 'api'
        if (product === 'insights') {
          // Remove Insights access but keep the key active for main API
          const existingKey = await redis.get(`customer:${sub.customer}:apikey`)
          if (existingKey) {
            const raw = await redis.get(apiKeyRedisKey(existingKey))
            if (raw) {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
              parsed.insights = false
              parsed.insightsPlan = null
              await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
              console.log(`Removed Insights access for customer ${sub.customer}`)
            }
          }
        } else if (product === 'scope-guard-pro') {
          // Remove Scope Guard access but keep the key active for main API
          const existingKey = await redis.get(`customer:${sub.customer}:apikey`)
          if (existingKey) {
            const raw = await redis.get(apiKeyRedisKey(existingKey))
            if (raw) {
              const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
              parsed.scopeGuard = false
              parsed.scopeGuardPlan = null
              await redis.set(apiKeyRedisKey(existingKey), JSON.stringify(parsed))
              console.log(`Removed Scope Guard access for customer ${sub.customer}`)
            }
          }
        } else {
          await disableKey(redis, sub.customer, 'subscription_cancelled')
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        // Grace period — don't immediately disable, just log
        // After 3 failed attempts Stripe will fire subscription.deleted
        console.log(`Payment failed for customer ${invoice.customer} — invoice ${invoice.id}`)
        // Alert via email so we can follow up proactively before key is disabled
        await sendPaymentFailedAlert(invoice, redis).catch(e => console.error('payment_failed alert error:', e.message))
        break
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return res.status(500).json({ error: 'Handler failed' })
  }
}

async function sendPaymentFailedAlert(invoice, redis) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return

  // Resolve customer email from Redis (already stored at provisioning time)
  const email = await redis.get(`customer:${invoice.customer}:email`).catch(() => null)

  const attemptCount = invoice.attempt_count || 1
  const amountDue = invoice.amount_due ? `${(invoice.amount_due / 100).toFixed(2)}` : 'unknown'
  const invoiceUrl = invoice.hosted_invoice_url || 'https://billing.stripe.com'

  // Alert us internally
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Ebenova Billing <billing@ebenova.dev>',
        to: 'info@ebenova.net',
        subject: `⚠️ Payment failed — ${email || invoice.customer} (attempt ${attemptCount}/3)`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
          <h2 style="color:#c0392b;margin-bottom:8px">⚠️ Payment failed</h2>
          <p style="color:#555;margin-bottom:20px">Stripe could not collect payment. Key is still active (grace period).</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#888">Customer</td><td style="padding:6px 0">${email || invoice.customer}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Amount due</td><td style="padding:6px 0">${amountDue}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Attempt</td><td style="padding:6px 0">${attemptCount} of 3</td></tr>
            <tr><td style="padding:6px 0;color:#888">Invoice ID</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${invoice.id}</td></tr>
          </table>
          <div style="margin-top:24px">
            <a href="${invoiceUrl}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 22px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px;">View invoice in Stripe →</a>
          </div>
          <p style="color:#aaa;font-size:12px;margin-top:20px">Key will auto-disable after 3 failed attempts (Stripe default). Reach out to customer proactively.</p>
        </div>`,
      }),
    })
  } catch (err) {
    console.error('sendPaymentFailedAlert internal email error:', err.message)
  }

  // Also email the customer with the payment link
  if (email) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: 'Ebenova Billing <billing@ebenova.dev>',
          to: email,
          subject: 'Action needed: payment failed for your Ebenova subscription',
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;">
            <h2 style="color:#1a1a1a;margin-bottom:8px">We couldn't process your payment</h2>
            <p style="color:#555;margin-bottom:20px">Your Ebenova subscription payment of <strong>${amountDue}</strong> failed. Your API key is still active while we retry, but please update your payment method to avoid interruption.</p>
            <a href="${invoiceUrl}" style="display:inline-block;background:#c9a84c;color:#0e0e0e;padding:14px 28px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Pay now →</a>
            <p style="color:#aaa;font-size:13px;margin-top:24px">Questions? Reply to this email or contact <a href="mailto:billing@ebenova.dev" style="color:#c9a84c">billing@ebenova.dev</a></p>
          </div>`,
        }),
      })
    } catch (err) {
      console.error('sendPaymentFailedAlert customer email error:', err.message)
    }
  }
}

async function sendInsightsWelcomeEmail(email, apiKey, insightsPlan) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return
  const planLabels = { starter: 'Starter (3 monitors)', growth: 'Growth (20 monitors)', scale: 'Scale (100 monitors)' }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Ebenova Insights <insights@ebenova.dev>',
        to: email,
        reply_to: 'info@ebenova.net',
        subject: `Your Ebenova Insights key — ${planLabels[insightsPlan] || insightsPlan}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;">
            <h1 style="font-size:22px;color:#1a1a1a;margin-bottom:8px">📡 Insights access activated</h1>
            <p style="color:#555;margin-bottom:24px">You're on <strong>${planLabels[insightsPlan]}</strong>. Here's your API key to access the Insights API and set up monitors.</p>
            <div style="background:#1a1a1a;border-radius:8px;padding:20px;margin-bottom:24px">
              <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">API Key (has Insights access)</p>
              <code style="color:#c9a84c;font-family:monospace;font-size:14px;word-break:break-all">${apiKey}</code>
            </div>
            <p style="color:#555;font-size:14px;margin-bottom:16px">Add it to your MCP config or API requests:</p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin-bottom:28px">
              <code style="font-family:monospace;font-size:12px;color:#333">Authorization: Bearer ${apiKey}</code>
            </div>
            <a href="https://ebenova.dev/insights" style="display:inline-block;background:#c9a84c;color:#0e0e0e;padding:14px 28px;border-radius:8px;font-weight:600;text-decoration:none;">Go to Insights dashboard →</a>
            <p style="color:#999;font-size:13px;margin-top:28px">Questions? Reply to this email — I'll set up your first monitor for you.</p>
          </div>`,
      }),
    })
  } catch (err) { console.error('Insights welcome email failed:', err.message) }
}

async function sendWelcomeEmail(email, apiKey, tier) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('[billing/webhook] RESEND_API_KEY not set — skipping welcome email')
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
      console.error(`[billing/webhook] Resend error ${resp.status}:`, body)
    } else {
      console.log(`[billing/webhook] Welcome email sent to ${email}`)
    }
  } catch (err) {
    // Non-fatal — key is already provisioned
    console.error('[billing/webhook] sendWelcomeEmail failed:', err.message)
  }
}
