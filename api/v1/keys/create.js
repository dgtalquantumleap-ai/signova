// api/v1/keys/create.js
// POST https://api.ebenova.dev/v1/keys/create
// Admin-only endpoint to provision new API keys.
// Protected by EBENOVA_ADMIN_SECRET env var.
//
// Request body:
// {
//   "owner": "customer@example.com",
//   "tier": "starter",           // free | starter | growth | scale | enterprise
//   "label": "My project",       // optional human-readable label
//   "monthlyLimit": 200          // optional override (defaults to tier limit)
// }

import { getRedis, apiKeyRedisKey } from '../../../lib/redis.js'
import { randomBytes } from 'crypto'

const TIER_LIMITS = {
  free:       5,
  starter:    100,
  growth:     500,
  scale:      2000,
  enterprise: 99999,
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function generateKey(env = 'live') {
  const random = randomBytes(24).toString('hex') // 48 hex chars
  return `sk_${env}_${random}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  // ── Admin auth ──────────────────────────────────────────────────────────────
  const adminSecret = process.env.EBENOVA_ADMIN_SECRET
  if (!adminSecret) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Admin secret not configured' } })
  }

  const authHeader = req.headers['authorization'] || ''
  if (authHeader.replace('Bearer ', '').trim() !== adminSecret) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid admin secret' } })
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  const body = await parseBody(req)
  const { owner, tier = 'free', label = '', monthlyLimit, env = 'live' } = body

  if (!owner || typeof owner !== 'string' || !owner.includes('@')) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'owner (email) is required' },
    })
  }

  const validTiers = Object.keys(TIER_LIMITS)
  if (!validTiers.includes(tier)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TIER', message: `tier must be one of: ${validTiers.join(', ')}` },
    })
  }

  // ── Create key ──────────────────────────────────────────────────────────────
  const key = generateKey(env === 'test' ? 'test' : 'live')
  const keyData = {
    owner: owner.toLowerCase().trim(),
    tier,
    monthlyLimit: monthlyLimit ?? TIER_LIMITS[tier],
    label: label.trim(),
    createdAt: new Date().toISOString(),
    disabled: false,
  }

  try {
    const redis = getRedis()
    await redis.set(apiKeyRedisKey(key), JSON.stringify(keyData))

    return res.status(201).json({
      success: true,
      api_key: key,
      owner: keyData.owner,
      tier: keyData.tier,
      monthly_limit: keyData.monthlyLimit,
      label: keyData.label,
      created_at: keyData.createdAt,
      note: 'Store this key securely — it cannot be retrieved again.',
    })
  } catch (err) {
    console.error('Key create error:', err)
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to save API key' } })
  }
}
