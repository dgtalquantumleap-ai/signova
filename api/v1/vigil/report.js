// api/v1/vigil/report.js — POST /v1/vigil/report
// AML compliance report generation using Claude Sonnet.
// Scale+ tier required.
import { authenticate, recordUsage, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'
import {
  REPORT_TIERS, setCors, parseBody, recordVigilUsage, getCardData,
} from '../../../lib/vigil-helpers.js'

function buildReportPrompt(cardId, cardData, params) {
  const period = params.period || 'last 30 days'
  const reportType = params.report_type || 'standard'

  return `You are a compliance officer AI generating an AML (Anti-Money Laundering) report. Generate a professional, audit-ready compliance report.

CARD/ACCOUNT: ${cardId}
REPORT PERIOD: ${period}
REPORT TYPE: ${reportType}

CARD PROFILE:
${cardData ? JSON.stringify(cardData, null, 2) : 'New card — no historical profile available.'}

AUTHORIZATION SUMMARY:
${params.authorization_summary ? JSON.stringify(params.authorization_summary, null, 2) : 'No authorization data provided.'}

FLAGGED TRANSACTIONS:
${params.flagged_transactions ? JSON.stringify(params.flagged_transactions, null, 2) : 'No flagged transactions.'}

Generate a structured AML compliance report in JSON with this exact format:
{
  "report_id": "AML-<8 random hex chars>",
  "report_type": "${reportType}",
  "generated_at": "<ISO timestamp>",
  "period": "${period}",
  "card_id": "${cardId}",
  "executive_summary": "2-3 sentence overview of compliance posture",
  "risk_assessment": {
    "overall_risk": "low|medium|high|critical",
    "risk_score": 0.0-1.0,
    "risk_factors": [
      { "factor": "...", "severity": "low|medium|high", "detail": "..." }
    ]
  },
  "transaction_analysis": {
    "total_transactions": 0,
    "flagged_count": 0,
    "patterns_detected": ["..."],
    "geographic_anomalies": ["..."],
    "velocity_concerns": ["..."]
  },
  "compliance_status": {
    "kyc_verified": true,
    "sanctions_clear": true,
    "pep_check": "clear|flagged|pending",
    "adverse_media": "clear|flagged"
  },
  "recommendations": [
    { "priority": "high|medium|low", "action": "...", "deadline": "..." }
  ],
  "regulatory_notes": "Relevant regulations or filing requirements"
}

Return ONLY the JSON object, no markdown fences or extra text.`
}

export default async function handler(req, res) {
  setCors(res, 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  // Tier gating — Scale+ required for AML reports
  if (!REPORT_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({
      success: false,
      error: { code: 'TIER_REQUIRED', message: 'AML report generation requires Scale plan or above', hint: 'Upgrade at ebenova.dev/pricing' },
    })
  }

  const body = await parseBody(req)
  if (!body.card_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'Required: card_id' },
    })
  }

  await trackRequest(auth, req)

  // ── Try external backend first ──
  const VIGIL_URL = process.env.VIGIL_API_URL
  if (VIGIL_URL) {
    try {
      const up = await fetch(`${VIGIL_URL}/api/v1/fraud/report`, {
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
        await recordVigilUsage(auth, 'aml_reports')
        return res.status(200).json({ success: true, ...data, _usage: buildUsageBlock(auth) })
      }
      console.warn('[vigil] Upstream report returned', up.status, '— falling back to local AI')
    } catch (err) {
      console.warn('[vigil] Upstream report unreachable:', err.message)
    }
  }

  // ── Local AML report with Claude Sonnet ──
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logError('vigil/report', { code: 'SERVER_MISCONFIGURED', message: 'ANTHROPIC_API_KEY not set' })
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'AI service not configured' } })
  }

  try {
    const cardData = await getCardData(auth, body.card_id)
    const prompt = buildReportPrompt(body.card_id, cardData, body)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiData.content?.[0]?.text) throw new Error('No AI response received')

    let report
    try {
      const raw = aiData.content[0].text.replace(/```json\n?|\n?```/g, '').trim()
      report = JSON.parse(raw)
    } catch {
      throw new Error('Failed to parse AI report response')
    }

    await recordUsage(auth)
    await recordVigilUsage(auth, 'aml_reports')

    return res.status(200).json({
      success: true,
      report: {
        ...report,
        model: 'claude-sonnet-4-5',
        generated_by: 'ebenova-vigil',
      },
      _usage: buildUsageBlock(auth),
    })
  } catch (err) {
    logError('vigil/report', err)
    return res.status(500).json({
      success: false,
      error: { code: 'REPORT_FAILED', message: 'AML report generation failed. Please retry.' },
    })
  }
}
