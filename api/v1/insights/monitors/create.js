// api/v1/insights/monitors/create.js
// POST /v1/insights/monitors
// Creates a new keyword monitor for the authenticated user.
// Auth: Bearer sk_live_... with insights: true in keyData
//
// Body: {
//   name: string,
//   keywords: [{ keyword: string, subreddits?: string[], productContext?: string }],
//   productContext?: string,   // global context applied to all keywords
//   alertEmail?: string        // defaults to key owner email
// }

import { authenticate } from '../../../../lib/api-auth.js'
import { getRedis } from '../../../../lib/redis.js'
import { randomBytes } from 'crypto'

const PLAN_LIMITS = {
  starter: { monitors: 3,   keywords: 20  },
  growth:  { monitors: 20,  keywords: 100 },
  scale:   { monitors: 100, keywords: 500 },
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
      error: {
        code: 'INSIGHTS_ACCESS_REQUIRED',
        message: 'This endpoint requires an Insights subscription',
        hint: 'Join the waitlist at ebenova.dev/insights',
      },
    })
  }

  const body = await parseBody(req)
  const { name, keywords = [], productContext, alertEmail } = body
  const plan = auth.keyData.insightsPlan || 'starter'
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: '"name" is required' },
    })
  }

  if (!Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: '"keywords" array must have at least 1 entry' },
    })
  }

  if (keywords.length > limits.keywords) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'KEYWORD_LIMIT_EXCEEDED',
        message: `Your ${plan} plan allows max ${limits.keywords} keywords per monitor`,
      },
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
  // Check monitor count
  const existingIds = await redis.smembers(`insights:monitors:${owner}`) || []
  if (existingIds.length >= limits.monitors) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'MONITOR_LIMIT_REACHED',
        message: `Your ${plan} plan allows max ${limits.monitors} monitors. Upgrade at ebenova.dev/insights`,
      },
    })
  }

  // Sanitize keywords
  const cleanKeywords = keywords
    .map(k => {
      if (typeof k === 'string') return { keyword: k.trim(), subreddits: [], productContext: '' }
      return {
        keyword: String(k.keyword || '').trim(),
        subreddits: Array.isArray(k.subreddits) ? k.subreddits.slice(0, 10) : [],
        productContext: String(k.productContext || '').slice(0, 500),
      }
    })
    .filter(k => k.keyword.length > 1)

  const monitorId = `mon_${randomBytes(12).toString('hex')}`
  const now = new Date().toISOString()

  const monitor = {
    id: monitorId,
    owner,
    name: name.trim().slice(0, 100),
    keywords: cleanKeywords,
    productContext: typeof productContext === 'string' ? productContext.slice(0, 2000) : '',
    alertEmail: alertEmail || owner,
    active: true,
    plan,
    createdAt: now,
    lastPollAt: null,
    totalMatchesFound: 0,
  }

  await redis.set(`insights:monitor:${monitorId}`, JSON.stringify(monitor))
  await redis.sadd(`insights:monitors:${owner}`, monitorId)
  await redis.sadd('insights:active_monitors', monitorId)

  return res.status(201).json({
    success: true,
    monitor_id: monitorId,
    name: monitor.name,
    keyword_count: cleanKeywords.length,
    keywords: cleanKeywords.map(k => k.keyword),
    plan,
    alert_email: monitor.alertEmail,
    active: true,
    created_at: now,
    next_poll_eta: 'Within 15 minutes',
  })
  } catch (err) {
    console.error('[insights/monitors/create] Redis error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to create monitor' } })
  }
}
