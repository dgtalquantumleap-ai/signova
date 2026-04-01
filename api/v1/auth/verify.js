// api/v1/auth/verify.js
// POST /v1/auth/verify
// Verifies a magic link token and returns a session + user's API keys.

import { getRedis, apiKeyRedisKey } from '../../../lib/redis.js'
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
  if (req.method !== 'POST') return res.status(405).json({ success: false })

  const body = await parseBody(req)
  const { token } = body

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Token required' } })
  }

  try {
    const redis = getRedis()

    // Look up the token
    const raw = await redis.get(`magic:${token}`)
    if (!raw) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Link expired or already used. Request a new one.' },
      })
    }

    const { email, expiresAt } = typeof raw === 'string' ? JSON.parse(raw) : raw

    if (Date.now() > expiresAt) {
      await redis.del(`magic:${token}`)
      return res.status(401).json({
        success: false,
        error: { code: 'EXPIRED_TOKEN', message: 'Link has expired. Request a new one.' },
      })
    }

    // Consume the token (one-time use)
    await redis.del(`magic:${token}`)

    // Find or create user record
    const userKey = `user:${email}`
    let userData = await redis.get(userKey)

    if (!userData) {
      // New user — create record and provision a free API key
      const freeApiKey = `sk_live_${randomBytes(24).toString('hex')}`
      const now = new Date().toISOString()

      const newUser = {
        email,
        created_at: now,
        api_keys: [freeApiKey],
        tier: 'free',
        stripe_customer_id: null,
      }

      // Store user
      await redis.set(userKey, JSON.stringify(newUser))

      // Provision the free key — use camelCase to match api-auth.js expectations
      const keyData = {
        owner: email,
        tier: 'free',
        monthlyLimit: 5,
        label: 'Default key',
        createdAt: now,
        disabled: false,
      }
      await redis.set(apiKeyRedisKey(freeApiKey), JSON.stringify(keyData))

      userData = newUser
    } else {
      userData = typeof userData === 'string' ? JSON.parse(userData) : userData
    }

    // Create a session token (24h)
    const sessionToken = randomBytes(32).toString('hex')
    await redis.set(`session:${sessionToken}`, JSON.stringify({ email, created_at: Date.now() }), { ex: 86400 })

    // Fetch key details for all user keys
    const keyDetails = await Promise.all(
      (userData.api_keys || []).map(async k => {
        const kd = await redis.get(apiKeyRedisKey(k))
        if (!kd) return null
        const parsed = typeof kd === 'string' ? JSON.parse(kd) : kd
        // Expose the key string itself for the dashboard, plus all metadata
        return { key: k, ...parsed }
      })
    )

    return res.status(200).json({
      success: true,
      session_token: sessionToken,
      user: {
        email: userData.email,
        tier: userData.tier,
        insights: userData.insights || false,
        insightsPlan: userData.insightsPlan || null,
        created_at: userData.created_at,
        stripe_customer_id: userData.stripe_customer_id || null,
      },
      api_keys: keyDetails.filter(Boolean),
    })
  } catch (err) {
    console.error('[auth/verify] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
}
