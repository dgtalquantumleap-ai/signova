// api/v1/insights/matches/draft.js
// POST /v1/insights/matches/draft
// Regenerates an AI reply draft for a specific Reddit match.
// Uses Claude Haiku 4.5 for all plans.
//
// Body: { matchId, monitorId }

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

function buildPrompt(match, productContext) {
  return `You are a Reddit community member who genuinely helps people. You are NOT a marketer.

PRODUCT CONTEXT (what you're an expert in):
${productContext || '(No product context provided — give general helpful advice only)'}

REDDIT POST:
Title: ${match.title}
Subreddit: r/${match.subreddit}
Body: ${(match.body || match.body_preview || '').slice(0, 600) || '(no body text)'}

TASK: Write a helpful Reddit reply. Strict rules:
- Sound like a real Reddit user: casual, direct, no corporate language
- Give genuine advice first. Mention your product ONLY if it directly solves the exact problem
- Never use: "check out", "I recommend", "great tool", "you should try"
- If you mention a product: use "I use" or "there's something called"
- Never include a URL unless the person explicitly asked for one
- Max 4 sentences. No bullet points. No markdown. Don't start with "I"
- If a helpful reply would sound like an ad, respond with exactly: SKIP

Reply text only. No labels, no explanation.`
}

async function generateDraft(match, productContext) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: buildPrompt(match, productContext) }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.content?.[0]?.text?.trim() || null
    return text === 'SKIP' ? null : text
  } catch { return null }
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
  const { matchId, monitorId } = body

  if (!matchId || !monitorId) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELDS', message: 'matchId and monitorId are required' },
    })
  }

  const redis = getRedis()
  const owner = auth.keyData.owner

  // ── Daily regeneration cap to prevent AI API cost abuse ──────────────────
  const today = new Date().toISOString().slice(0, 10)
  const regenKey = `insights:regen:${auth.key}:${today}`
  const REGEN_LIMITS = { insights_starter: 10, insights_growth: 50, insights_scale: 200 }
  const plan = auth.keyData.insightsPlan || 'starter'
  const dailyCap = REGEN_LIMITS[`insights_${plan}`] || REGEN_LIMITS.insights_starter
  const regenCount = await redis.incr(regenKey)
  if (regenCount === 1) await redis.expire(regenKey, 86400)
  if (regenCount > dailyCap) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'REGEN_LIMIT_REACHED',
        message: `Daily draft regeneration limit reached (${dailyCap}/day for ${plan} plan)`,
        hint: 'Upgrade your Insights plan or wait until tomorrow',
      },
    })
  }

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

  const draft = await generateDraft(match, monitor.productContext)

  match.draft = draft
  match.draftGeneratedAt = new Date().toISOString()
  match.draftModel = 'claude-haiku-4-5-20251001'
  await redis.set(`insights:match:${monitorId}:${matchId}`, JSON.stringify(match))

  return res.status(200).json({
    success: true,
    match_id: matchId,
    draft: draft || null,
    has_draft: !!draft,
    skipped: !draft,
    model_used: match.draftModel,
    generated_at: match.draftGeneratedAt,
  })
}
