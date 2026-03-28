// api/v1/keys/usage.js
// GET https://api.ebenova.dev/v1/keys/usage
// Returns usage stats for the authenticated API key.
// Requires: Authorization: Bearer sk_live_...

import { authenticate } from '../../../lib/api-auth.js'
import { getRedis, usageRedisKeyForMonth } from '../../../lib/redis.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } })
  }

  const auth = await authenticate(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error })
  }

  // Build 3-month usage history
  const history = []
  try {
    const redis = getRedis()
    const now = new Date()

    for (let i = 0; i < 3; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const yearMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      const raw = await redis.get(usageRedisKeyForMonth(auth.key, yearMonth))
      history.push({ month: yearMonth, documents_generated: raw ? parseInt(raw, 10) : 0 })
    }
  } catch (err) {
    console.error('Usage history error:', err)
    // Non-fatal — still return current month stats
  }

  const nextReset = new Date()
  nextReset.setUTCMonth(nextReset.getUTCMonth() + 1, 1)
  nextReset.setUTCHours(0, 0, 0, 0)

  return res.status(200).json({
    success: true,
    key: {
      owner: auth.keyData.owner,
      tier: auth.keyData.tier,
      label: auth.keyData.label || null,
      created_at: auth.keyData.createdAt,
    },
    current_month: {
      documents_used: auth.usedThisMonth,
      documents_remaining: Math.max(0, auth.monthlyLimit - auth.usedThisMonth),
      monthly_limit: auth.monthlyLimit,
      resets_at: nextReset.toISOString(),
    },
    history,
  })
}
