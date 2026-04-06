// api/v1/auth/magic-link.js
// POST /v1/auth/magic-link
// Sends a magic link to the user's email for passwordless login.

import { getRedis } from '../../../lib/redis.js'
import { randomBytes } from 'crypto'

async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && req.body !== null) return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const body = await parseBody(req)
  const { email } = body

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'Valid email required' } })
  }

  const normalizedEmail = email.toLowerCase().trim()
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + 15 * 60 * 1000 // 15 minutes

  try {
    const redis = getRedis()
    // Store token → email mapping (15 min TTL)
    await redis.set(`magic:${token}`, JSON.stringify({ email: normalizedEmail, expiresAt }), { ex: 900 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.getsignova.com'
    const magicLink = `${baseUrl}/dashboard?token=${token}`

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) throw new Error('Email service not configured')

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'Ebenova <noreply@getsignova.com>',
        to: normalizedEmail,
        subject: 'Your Ebenova login link',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#1a1a1a">Sign in to Ebenova</h2>
            <p style="color:#555">Click the button below to sign in. This link expires in 15 minutes.</p>
            <a href="${magicLink}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
              Sign In to Dashboard
            </a>
            <p style="color:#888;font-size:13px">If you didn't request this, ignore this email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
            <p style="color:#aaa;font-size:12px">Ebenova · Legal Infrastructure API · <a href="https://ebenova.dev">ebenova.dev</a></p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      console.error('[magic-link] Resend error:', errBody)
      throw new Error('Failed to send email')
    }

    return res.status(200).json({
      success: true,
      message: 'Magic link sent. Check your email.',
      expires_in: 900,
    })
  } catch (err) {
    console.error('[magic-link] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'SEND_FAILED', message: err.message } })
  }
}
