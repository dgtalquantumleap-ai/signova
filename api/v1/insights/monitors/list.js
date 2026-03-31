// api/v1/insights/monitors/list.js
// GET /v1/insights/monitors
// Lists all monitors owned by the authenticated user.

import { authenticate } from '../../../../lib/api-auth.js'
import { getRedis } from '../../../../lib/redis.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } })
  }

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  if (!auth.keyData.insights) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSIGHTS_ACCESS_REQUIRED', message: 'Requires Insights subscription', hint: 'ebenova.dev/insights' },
    })
  }

  const redis = getRedis()
  const owner = auth.keyData.owner
  const monitorIds = await redis.smembers(`insights:monitors:${owner}`) || []

  if (monitorIds.length === 0) {
    return res.status(200).json({ success: true, monitors: [], total: 0 })
  }

  const monitors = []
  for (const id of monitorIds) {
    const raw = await redis.get(`insights:monitor:${id}`)
    if (!raw) continue
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw
    const matchCount = await redis.zcard(`insights:matches:${id}`) || 0

    monitors.push({
      monitor_id: m.id,
      name: m.name,
      keyword_count: m.keywords?.length || 0,
      keywords: m.keywords?.map(k => k.keyword) || [],
      active: m.active,
      total_matches: matchCount,
      last_poll_at: m.lastPollAt,
      created_at: m.createdAt,
    })
  }

  monitors.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return res.status(200).json({
    success: true,
    monitors,
    total: monitors.length,
  })
}
