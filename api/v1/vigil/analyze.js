// api/v1/vigil/analyze.js — POST /v1/vigil/analyze
// AI-powered fraud pattern analysis using Claude Haiku.
// Growth+ tier required.
import { authenticate, recordUsage, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'
import {
  AI_TIERS, setCors, parseBody, recordVigilUsage, getCardData,
} from '../../../lib/vigil-helpers.js'

function buildAnalysisPrompt(transaction, cardData, recentHistory) {
  return `You are a fraud detection AI analyst for a card authorization system. Analyze this transaction for fraud indicators.

TRANSACTION:
${JSON.stringify(transaction, null, 2)}

CARD PROFILE:
${cardData ? JSON.stringify(cardData, null, 2) : 'No card profile registered yet (first-time card).'}

RECENT AUTHORIZATION HISTORY:
${recentHistory ? JSON.stringify(recentHistory, null, 2) : 'No recent history available.'}

Analyze for the following fraud patterns:
1. **Velocity** — Unusual transaction frequency or escalating amounts
2. **Geography** — Transaction country vs. home country mismatch
3. **MCC Risk** — High-risk merchant category codes (gambling, crypto, etc.)
4. **Time-of-day** — Transactions at unusual hours for the cardholder's timezone
5. **Amount anomaly** — Unusually large or pattern-breaking amounts

Return a JSON object with this exact structure:
{
  "risk_level": "low" | "medium" | "high" | "critical",
  "risk_score": 0.0-1.0,
  "fraud_indicators": [
    { "type": "velocity|geography|mcc|time|amount", "severity": "low|medium|high", "description": "..." }
  ],
  "recommendation": "approve" | "review" | "decline" | "block_card",
  "explanation": "One paragraph summary of analysis",
  "suggested_actions": ["action1", "action2"]
}

Return ONLY the JSON object, no markdown fences or extra text.`
}

export default async function handler(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  // Tier gating — Growth+ required for AI analysis
  if (!AI_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'AI fraud analysis requires Growth plan or above', hint: 'Upgrade at ebenova.dev/pricing' },
    })
  }

  const body = await parseBody(req)
  if (!body.transaction && !body.card_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'Required: transaction object or card_id' },
    })
  }

  await trackRequest(auth, req)

  // ── Try external backend first ──
  const VIGIL_URL = process.env.VIGIL_API_URL
  if (VIGIL_URL) {
    try {
      const up = await fetch(`${VIGIL_URL}/api/v1/fraud/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VIGIL_API_SECRET || ''}`,
        },
        body: JSON.stringify(body),
      })
      const data = await up.json()
      if (up.ok) {
        await recordUsage(auth)
        await recordVigilUsage(auth, 'ai_analyses')
        return res.status(200).json({ success: true, ...data, _usage: buildUsageBlock(auth) })
      }
      console.warn('[vigil] Upstream analyze returned', up.status, '— falling back to local AI')
    } catch (err) {
      console.warn('[vigil] Upstream analyze unreachable:', err.message)
    }
  }

  // ── Local AI analysis with Claude Haiku ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logError('vigil/analyze', { code: 'SERVER_MISCONFIGURED', message: 'ANTHROPIC_API_KEY not set' })
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'AI service not configured' } })
  }

  try {
    const transaction = body.transaction || {
      card_id: body.card_id,
      merchant_name: body.merchant_name,
      merchant_country: body.merchant_country,
      amount_cents: body.amount_cents,
      currency: body.currency,
      mcc: body.mcc,
      timestamp: body.timestamp || new Date().toISOString(),
    }

    const cardData = body.card_id ? await getCardData(auth, body.card_id) : null
    const prompt = buildAnalysisPrompt(transaction, cardData, body.recent_history || null)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20250929',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiData.content?.[0]?.text) throw new Error('No AI response received')

    let analysis
    try {
      const raw = aiData.content[0].text.replace(/```json\n?|\n?```/g, '').trim()
      analysis = JSON.parse(raw)
    } catch {
      throw new Error('Failed to parse AI analysis response')
    }

    await recordUsage(auth)
    await recordVigilUsage(auth, 'ai_analyses')

    return res.status(200).json({
      success: true,
      analysis: {
        ...analysis,
        model: 'claude-haiku-4-5',
        analyzed_at: new Date().toISOString(),
      },
      _usage: buildUsageBlock(auth),
    })
  } catch (err) {
    logError('vigil/analyze', err)
    return res.status(500).json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: 'AI fraud analysis failed. Please retry.' },
    })
  }
}
