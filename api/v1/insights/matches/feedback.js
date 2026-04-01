// api/v1/insights/matches/feedback.js
// POST /v1/insights/matches/feedback
// Records thumbs up/down on a draft. Used to tune future AI prompts.
// Body: { matchId, monitorId, feedback: 'up' | 'down', note? }

import { authenticate } from '../../../../lib/api-auth.js'
import { getRedis } from '../../../../lib/redis.js'

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  if (!auth.keyData.insights) {
    return res.status(403).json({
      success: false,
      error: { code: 'INSIGHTS_ACCESS_REQUIRED', message: 'Requires Insights subscription' },
    })
  }

  const body = await parseBody(req)
  const { matchId, monitorId, feedback, note } = body

  if (!matchId || !monitorId || !['up', 'down'].includes(feedback)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'matchId, monitorId, and feedback (up | down) are all required',
      },
    })
  }

  const redis = getRedis()
  const owner = auth.keyData.owner

  const monitorRaw = await redis.get(`insights:monitor:${monitorId}`)
  if (!monitorRaw) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Monitor not found' } })
  }
  const monitor = typeof monitorRaw === 'string' ? JSON.parse(monitorRaw) : monitorRaw
  if (monitor.owner !== owner) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your monitor' } })
  }

  const matchRaw = await redis.get(`insights:match:${monitorId}:${matchId}`)
  if (!matchRaw) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Match not found' } })
  }
  const match = typeof matchRaw === 'string' ? JSON.parse(matchRaw) : matchRaw

  match.feedback = feedback
  match.feedbackNote = note || null
  match.feedbackAt = new Date().toISOString()
  await redis.set(`insights:match:${monitorId}:${matchId}`, JSON.stringify(match))

  // Track aggregate feedback per monitor (used for future prompt tuning)
  await redis.incr(`insights:feedback:${monitorId}:${feedback}`)

  return res.status(200).json({
    success: true,
    match_id: matchId,
    feedback,
    message: feedback === 'up'
      ? 'Marked as helpful — keep posting!'
      : "Noted. We'll refine future drafts based on your feedback.",
  })
}
