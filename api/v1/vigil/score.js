// api/v1/vigil/score.js — GET /v1/vigil/score?card_id=
// Live risk score 0–1.0 for a card, computed from authorization history.
import { authenticate, recordUsage, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'
import { computeRiskScore } from '../../../lib/vigil-engine.js'
import { getRedis } from '../../../lib/redis.js'
import {
  AUTH_TIERS, setCors, vigilRedisKey, vigilCardKey, getCardData, recordVigilUsage,
} from '../../../lib/vigil-helpers.js'

export default async function handler(req, res) {
  setCors(res, 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  // Tier gating — Starter+ required
  if (!AUTH_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'Risk scoring requires Starter plan or above', hint: 'Upgrade at ebenova.dev/pricing' },
    })
  }

  const cardId = req.query?.card_id
  if (!cardId) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Required query param: card_id' } })

  await trackRequest(auth, req)

  // ── Try external backend first ──
  const VIGIL_URL = process.env.VIGIL_API_URL
  if (VIGIL_URL) {
    try {
      const up = await fetch(`${VIGIL_URL}/api/v1/fraud/score/${encodeURIComponent(cardId)}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VIGIL_API_SECRET || ''}`,
        },
      })
      const data = await up.json()
      if (up.ok) {
        await recordUsage(auth)
        return res.status(200).json({ success: true, ...data, _usage: buildUsageBlock(auth) })
      }
      console.warn('[vigil] Upstream score returned', up.status, '— falling back to local engine')
    } catch (err) {
      console.warn('[vigil] Upstream score unreachable:', err.message)
    }
  }

  // ── Local risk score computation ──
  try {
    const redis = getRedis()
    const card = await getCardData(auth, cardId)

    if (!card) {
      return res.status(404).json({
        success: false,
        error: { code: 'CARD_NOT_FOUND', message: 'No card data found. Card is registered on first authorization.' },
      })
    }

    // Gather stats from Redis for risk computation
    const statsKey = vigilRedisKey(auth.key, `card:${cardId}:stats`)
    const stats = await redis.get(statsKey)
    const parsed = stats ? (typeof stats === 'string' ? JSON.parse(stats) : stats) : {}

    const totalAuths = parsed.total_authorizations || 0
    const blockedAuths = parsed.blocked_authorizations || 0
    const falsePositives = parsed.false_positives || 0
    const outsideRadius = parsed.outside_radius_count || 0

    const riskScore = computeRiskScore({
      blockRate: totalAuths > 0 ? blockedAuths / totalAuths : 0,
      falsePositiveRate: blockedAuths > 0 ? falsePositives / blockedAuths : 0,
      recentOutsideRadius: outsideRadius,
      hasLockedDown: card.mode === 'lockdown',
    })

    await recordUsage(auth)
    await recordVigilUsage(auth, 'score_queries')

    return res.status(200).json({
      success: true,
      risk: {
        score: riskScore,
        level: riskScore >= 0.7 ? 'high' : riskScore >= 0.4 ? 'medium' : 'low',
        card_id: cardId,
        card_mode: card.mode,
        is_active: card.is_active,
        stats: {
          total_authorizations: totalAuths,
          blocked_authorizations: blockedAuths,
          block_rate: totalAuths > 0 ? Math.round((blockedAuths / totalAuths) * 100) : 0,
          outside_radius_events: outsideRadius,
        },
      },
      _usage: buildUsageBlock(auth),
    })
  } catch (err) {
    logError('vigil/score', err)
    return res.status(500).json({
      success: false,
      error: { code: 'SCORE_FAILED', message: 'Risk score computation failed. Please retry.' },
    })
  }
}
