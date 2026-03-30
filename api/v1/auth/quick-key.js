// api/v1/auth/quick-key.js
// POST /v1/auth/quick-key
// Instantly generates a free tier API key without requiring authentication
// Used for fast onboarding from marketing site

import { getRedis, apiKeyRedisKey } from '../../../lib/redis.js'
import { randomBytes } from 'crypto'

function generateKey() {
  return `sk_live_${randomBytes(24).toString('hex')}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })
  }

  try {
    const redis = getRedis()
    if (!redis) {
      return res.status(500).json({ success: false, error: { code: 'SERVICE_ERROR', message: 'Redis not available' } })
    }

    // Generate new key
    const key = generateKey()
    const now = new Date()
    const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    nextReset.setUTCHours(0, 0, 0, 0)

    // Store key metadata in Redis
    const keyData = {
      owner: `quickstart-${Date.now()}`, // Anonymous identifier
      tier: 'free',
      monthlyLimit: 5,
      label: 'Free tier (quick start)',
      createdAt: now.toISOString(),
      disabled: false,
    }

    await redis.set(apiKeyRedisKey(key), JSON.stringify(keyData))

    // Store usage counter (starts at 0)
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    await redis.set(`usage:${key}:${monthKey}`, '0')

    // Set expiration: 30 days for unused free keys (auto-cleanup)
    await redis.expire(apiKeyRedisKey(key), 30 * 24 * 60 * 60)

    return res.status(200).json({
      success: true,
      key,
      tier: 'free',
      monthlyLimit: 5,
      documentTypes: 27,
      jurisdictions: 18,
      resets_at: nextReset.toISOString(),
      message: 'Your API key is ready! You can generate 5 documents this month.',
      nextSteps: {
        docs: 'https://api.ebenova.dev/docs',
        upgrade: 'https://api.ebenova.dev/dashboard',
        example: {
          endpoint: 'POST https://api.ebenova.dev/v1/documents/generate',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: {
            document_type: 'nda',
            fields: {
              disclosingParty: 'Acme Inc.',
              receivingParty: 'John Smith',
              purpose: 'Partnership discussion',
              duration: '2 years',
              mutual: 'Yes',
            },
            jurisdiction: 'Nigeria',
          },
        },
      },
    })
  } catch (err) {
    console.error('[auth/quick-key] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'GENERATION_FAILED', message: err.message } })
  }
}
