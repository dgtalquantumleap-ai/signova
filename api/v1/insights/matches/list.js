// api/v1/insights/matches/list.js
// GET /v1/insights/matches?monitorId=mon_xxx&limit=20&offset=0
// Returns paginated matches for a monitor, newest first.

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
      error: { code: 'INSIGHTS_ACCESS_REQUIRED', message: 'Requires Insights subscription' },
    })
  }

  const params = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams)
  const monitorId = params.monitorId || params.monitor_id
  const limit = Math.min(parseInt(params.limit || '20', 10), 100)
  const offset = Math.max(parseInt(params.offset || '0', 10), 0)

  if (!monitorId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_PARAM', message: 'monitorId is required. GET /v1/insights/matches?monitorId=mon_xxx' },
    })
  }

  let redis
  try {
    redis = getRedis()
  } catch {
    return res.status(500).json({ success: false, error: { code: 'STORAGE_UNAVAILABLE', message: 'Redis unavailable' } })
  }

  const owner = auth.keyData.owner

  try {
    const raw = await redis.get(`insights:monitor:${monitorId}`)
    if (!raw) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Monitor not found' } })
    }

    const monitor = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (monitor.owner !== owner) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your monitor' } })
    }

    // Matches stored as Redis LIST by the monitor worker (lpush), newest entries at head
    const total = await redis.llen(`insights:matches:${monitorId}`) || 0
    const matchIds = await redis.lrange(
      `insights:matches:${monitorId}`,
      offset,
      offset + limit - 1
    ) || []

    const matches = []
    for (const matchId of matchIds) {
      const matchRaw = await redis.get(`insights:match:${monitorId}:${matchId}`)
      if (!matchRaw) continue
      const m = typeof matchRaw === 'string' ? JSON.parse(matchRaw) : matchRaw
      matches.push({
        match_id: m.id,
        keyword: m.keyword,
        title: m.title,
        url: m.url,
        subreddit: m.subreddit,
        author: m.author,
        upvotes: m.score,
        comments: m.comments,
        body_preview: (m.body || '').slice(0, 300),
        has_draft: !!m.draft,
        draft: m.draft || null,
        feedback: m.feedback || null,
        approved_subreddit: m.approved ?? true,
        found_at: m.createdAt,
      })
    }

    return res.status(200).json({
      success: true,
      monitor_id: monitorId,
      matches,
      pagination: { total, limit, offset, has_more: offset + limit < total },
    })
  } catch (err) {
    console.error('[insights/matches/list] Redis error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to list matches' } })
  }
}
