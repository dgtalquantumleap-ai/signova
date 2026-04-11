// api/v1/insights/poll.js
// POST /v1/insights/poll — cron endpoint to poll Reddit/Nairaland for all active monitors.
// Protected by POLL_CRON_SECRET header to prevent unauthorized triggers.
//
// Usage:
//   curl -X POST https://api.ebenova.dev/v1/insights/poll \
//     -H "Content-Type: application/json" \
//     -H "Authorization: Bearer $POLL_CRON_SECRET"
//
// Vercel cron config (add to vercel.json):
//   "crons": [{ "path": "/v1/insights/poll", "schedule": "*/15 * * * *" }]

import { getRedis } from '../../../../lib/redis.js'
import { pollInsights } from '../../../../lib/insights-poller.js'

const POLL_SECRET = process.env.POLL_CRON_SECRET || ''

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  // Auth: require POLL_CRON_SECRET
  const auth = req.headers['authorization'] || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!POLL_SECRET || provided !== POLL_SECRET) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } })
  }

  let redis
  try {
    redis = getRedis()
  } catch (_err) {
    return res.status(500).json({ success: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'Redis unavailable' } })
  }

  try {
    const result = await pollInsights(redis)
    return res.status(200).json(result)
  } catch (_err) {
    console.error('[insights/poll] Fatal error:', err.message)
    return res.status(500).json({
      success: false,
      error: { code: 'POLL_FAILED', message: err.message },
    })
  }
}
