// api/v1/insights/monitors/delete.js
// DELETE /v1/insights/monitors?id=mon_xxx
// Soft-deletes a monitor (marks inactive, removes from polling queue).

import { authenticate } from '../../../../lib/api-auth.js'
import { getRedis } from '../../../../lib/redis.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use DELETE' } })
  }

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  if (!auth.keyData.insights) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSIGHTS_ACCESS_REQUIRED', message: 'Requires Insights subscription' },
    })
  }

  const monitorId = req.query?.id
    || (req.url ? new URL(req.url, 'http://x').searchParams.get('id') : null)

  if (!monitorId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_ID', message: 'Provide ?id=mon_xxx as a query parameter' },
    })
  }

  const redis = getRedis()
  const owner = auth.keyData.owner

  const raw = await redis.get(`insights:monitor:${monitorId}`)
  if (!raw) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Monitor not found' } })
  }

  const monitor = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (monitor.owner !== owner) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your monitor' } })
  }

  // Soft delete
  monitor.active = false
  monitor.deletedAt = new Date().toISOString()
  await redis.set(`insights:monitor:${monitorId}`, JSON.stringify(monitor))
  await redis.srem('insights:active_monitors', monitorId)
  await redis.srem(`insights:monitors:${owner}`, monitorId)

  return res.status(200).json({
    success: true,
    monitor_id: monitorId,
    deleted: true,
    message: 'Monitor deactivated and removed from polling queue.',
  })
}
