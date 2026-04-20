// api/v1/insights/subscribe.js
// POST /v1/insights/subscribe
// Adds email to Insights waitlist and sends confirmation email.
// Body: { email, plan? }

import { getRedis } from '../../../lib/redis.js'

async function sendResendEmail({ from, to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not set' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { success: false, error: err.message || 'Resend API error' }
  }
  return { success: true }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  // Vercel pre-parses JSON body into req.body
  const body = (req.body && typeof req.body === 'object') ? req.body : {}
  const email = body.email
  const plan = body.plan || 'starter'

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_EMAIL', message: 'A valid email is required' },
    })
  }

  const normalizedEmail = email.toLowerCase().trim()

  try {
    const redis = getRedis()
    const existing = await redis.get(`insights:waitlist:${normalizedEmail}`)
    if (existing) {
      return res.status(200).json({
        success: true,
        already_on_waitlist: true,
        message: "You're already on the waitlist — we'll email you when access opens.",
      })
    }

    await redis.sadd('insights:waitlist', normalizedEmail)
    await redis.set(`insights:waitlist:${normalizedEmail}`, JSON.stringify({
      email: normalizedEmail,
      plan,
      joinedAt: new Date().toISOString(),
      source: req.headers['referer'] || 'direct',
    }))
  } catch (err) {
    console.error('[insights/subscribe] Redis error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to save' } })
  }

  if (process.env.RESEND_API_KEY) {
    await sendResendEmail({
      from: 'Ebenova Insights <insights@ebenova.dev>',
      reply_to: 'info@ebenova.net',
      to: normalizedEmail,
      subject: "You're on the Insights waitlist",
      html: buildConfirmationEmail(normalizedEmail, plan),
    }).catch(err => console.error('[insights/subscribe] Resend confirmation error:', err.message))

    await sendResendEmail({
      from: 'Insights Waitlist <insights@ebenova.dev>',
      to: process.env.ALERT_EMAIL || 'info@ebenova.net',
      subject: `New Insights waitlist: ${normalizedEmail} (${plan})`,
      html: `<p><strong>${normalizedEmail}</strong> joined the Insights waitlist.<br>Plan interest: <strong>${plan}</strong><br>Time: ${new Date().toUTCString()}</p><p>Reply directly to close them.</p>`,
    }).catch(err => console.error('[insights/subscribe] Resend alert error:', err.message))
  }

  return res.status(200).json({
    success: true,
    mode: 'waitlist',
    message: "You're on the waitlist. We'll email you when access opens.",
    plan,
  })
}

function buildConfirmationEmail(_email, _plan) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f5f5f5;">
  <div style="background:#0e0e0e;padding:24px;border-radius:8px;margin-bottom:20px;">
    <div style="font-size:18px;font-weight:700;color:#f0ece4;">Ebenova Insights</div>
    <div style="font-size:13px;color:#9a9690;margin-top:4px;">Reddit monitoring for growing products</div>
  </div>
  <div style="background:#fff;padding:24px;border-radius:8px;border:1px solid #eee;">
    <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">You are on the waitlist</h2>
    <p style="color:#555;line-height:1.6;margin:0 0 16px;">
      We are opening to beta customers soon. You will get access at the founding member rate of
      <strong>$49/month</strong> locked for life as long as you stay subscribed.
    </p>
    <p style="color:#555;line-height:1.6;margin:0 0 20px;">
      While you wait: reply to this email with the keywords and products you want to monitor.
      I will have your setup ready the moment we open beta.
    </p>
    <div style="padding:16px;background:#f9f9f9;border-left:4px solid #c9a84c;border-radius:4px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a08c00;margin-bottom:8px;">What you are getting</div>
      <ul style="margin:0;padding-left:18px;color:#444;font-size:14px;line-height:2;">
        <li>Real-time Reddit and Nairaland keyword alerts</li>
        <li>AI reply drafts that sound human, not promotional</li>
        <li>Founding member rate locked for life</li>
        <li>Free upgrade to semantic search V2</li>
      </ul>
    </div>
    <p style="color:#888;font-size:13px;margin:0;">
      The Ebenova team<br>
      <a href="mailto:info@ebenova.net" style="color:#c9a84c;">info@ebenova.net</a>
    </p>
  </div>
</body>
</html>`
}
