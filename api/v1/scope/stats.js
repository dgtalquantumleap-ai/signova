// api/v1/scope/stats.js
// GET /v1/scope/stats
// Returns Scope Guard usage stats for the authenticated key
// Pro tier required

import { authenticate } from '../../../lib/api-auth.js'
import { getRedis } from '../../../lib/redis.js'

const PRO_TIERS = ['growth', 'scale', 'enterprise']

function scopeGuardRedisKey(apiKey, stat) {
  const year = new Date().getUTCFullYear()
  const month = String(new Date().getUTCMonth() + 1).padStart(2, '0')
  return `scope_guard:${apiKey}:${year}-${month}:${stat}`
}

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

  if (!PRO_TIERS.includes(auth.keyData.tier)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PRO_REQUIRED',
        message: 'Scope Guard stats requires a Pro plan',
        hint: 'Upgrade at https://ebenova.dev/pricing',
      },
    })
  }

  try {
    const redis = getRedis()
    
    // Fetch current month stats
    const analyzeCalls = await redis.get(scopeGuardRedisKey(auth.key, 'analyze_calls'))
    const changeOrdersGenerated = await redis.get(scopeGuardRedisKey(auth.key, 'change_orders_generated'))
    const violationsDetected = await redis.get(scopeGuardRedisKey(auth.key, 'violations_detected'))
    const firmsResponses = await redis.get(scopeGuardRedisKey(auth.key, 'firm_responses'))
    const pushbackResponses = await redis.get(scopeGuardRedisKey(auth.key, 'pushback_responses'))

    // Fetch last 3 months history
    const history = []
    const now = new Date()
    for (let i = 0; i < 3; i++) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const monthStr = `${year}-${month}`
      
      const calls = await redis.get(`scope_guard:${auth.key}:${monthStr}:analyze_calls`)
      const orders = await redis.get(`scope_guard:${auth.key}:${monthStr}:change_orders_generated`)
      
      history.push({
        month: monthStr,
        analyze_calls: calls ? parseInt(calls, 10) : 0,
        change_orders_generated: orders ? parseInt(orders, 10) : 0,
      })
    }

    const nextMonthReset = new Date()
    nextMonthReset.setUTCMonth(nextMonthReset.getUTCMonth() + 1, 1)
    nextMonthReset.setUTCHours(0, 0, 0, 0)

    return res.status(200).json({
      success: true,
      current_month: {
        analyze_calls: analyzeCalls ? parseInt(analyzeCalls, 10) : 0,
        change_orders_generated: changeOrdersGenerated ? parseInt(changeOrdersGenerated, 10) : 0,
        violations_detected: violationsDetected ? parseInt(violationsDetected, 10) : 0,
        response_breakdown: {
          firm_responses: firmsResponses ? parseInt(firmsResponses, 10) : 0,
          pushback_responses: pushbackResponses ? parseInt(pushbackResponses, 10) : 0,
          change_order_responses: changeOrdersGenerated ? parseInt(changeOrdersGenerated, 10) : 0,
        },
      },
      history: history.reverse(),
      resets_at: nextMonthReset.toISOString(),
    })
  } catch (err) {
    console.error('[scope/stats] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'STATS_FAILED', message: err.message } })
  }
}
