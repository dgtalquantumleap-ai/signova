// api/insights/request-access.js
// POST /api/insights/request-access
// Accepts { email }, validates, stores in Redis, and sends notification email via Resend.

import { getRedis } from '../../lib/redis.js'

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  let body = req.body
  if (!body || typeof body === 'string') {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', chunk => { data += chunk })
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON' } })
    }
  }

  const { email } = body
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_EMAIL', message: 'Valid email is required' } })
  }

  try {
    const redis = getRedis()
    const timestamp = new Date().toISOString()
    await redis.lpush('insights:access_requests', JSON.stringify({ email, requestedAt: timestamp }))

    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Ebenova Insights <info@getsignova.com>',
          to: ['akin@ebenova.dev'],
          subject: 'New Insights access request',
          text: `Email: ${email}\nRequested at: ${timestamp}`,
        }),
      })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('request-access error:', err)
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to process request' } })
  }
}
