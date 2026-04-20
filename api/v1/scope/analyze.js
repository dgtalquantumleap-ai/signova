// api/v1/scope/analyze.js
// POST /v1/scope/analyze
// Analyzes a client message against a contract for scope violations.
// Pro tier required.

import { authenticate, recordUsage, buildUsageBlock } from '../../../lib/api-auth.js'
import { getRedis } from '../../../lib/redis.js'
import { ScopeGuardAnalyzeSchema, formatValidationError } from '../../../lib/validators.js'
import { logError, logRequest, logDetailedError } from '../../../lib/logger.js'
import { buildJurisdictionContext, jurisdictionDisplayName } from '../../../lib/jurisdiction-context.js'

const PRO_TIERS = ['growth', 'scale', 'enterprise']

function scopeGuardRedisKey(apiKey, stat) {
  const year = new Date().getUTCFullYear()
  const month = String(new Date().getUTCMonth() + 1).padStart(2, '0')
  return `scope_guard:${apiKey}:${year}-${month}:${stat}`
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && req.body !== null) return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function buildAnalysisPrompt(contractText, clientMessage, channel, jurisdiction) {
  // Jurisdiction-aware prompt assembly. The context block (CAMA / ERA 1996 /
  // BCEA / Employment Act 2007 / etc.) is prepended BEFORE the generic
  // analyst persona so Claude reads it as the authoritative legal
  // grounding for the analysis. When jurisdiction is undefined, the helper
  // returns a Commonwealth-baseline + anti-US-default block.
  const jurisdictionContext = buildJurisdictionContext(jurisdiction)
  const jurisdictionLabel = jurisdictionDisplayName(jurisdiction)
  return `${jurisdictionContext}

When identifying breaches, cite specific statutory provisions from the jurisdiction context above where they bear on the dispute. When drafting responses, reference the governing law named above and any relevant case authority you can support. Do not invoke statutes from other jurisdictions.

You are a contract enforcement AI advising a service provider whose contract is governed by ${jurisdictionLabel}. Analyze the client's message against the original contract and identify any scope violations.

## ORIGINAL CONTRACT:
${contractText}

## CLIENT MESSAGE (via ${channel || 'unknown channel'}):
${clientMessage}

## YOUR TASK:
1. Identify all violations (SCOPE, REVISION, TIMELINE, PAYMENT, IP, TERMINATION)
2. For each violation, cite the specific contract section if possible AND any applicable statute from the jurisdiction context above
3. Generate 3 professional response options (PUSHBACK, CHANGE_ORDER, FIRM) — use formal correspondence appropriate to ${jurisdictionLabel}
4. If a change order is appropriate, suggest pricing/timeline estimates

Respond ONLY with valid JSON in this exact format:
{
  "violation_detected": true,
  "violations": [
    {
      "type": "SCOPE|REVISION|TIMELINE|PAYMENT|IP|TERMINATION",
      "severity": "LOW|MEDIUM|HIGH",
      "description": "Clear explanation of the violation",
      "contract_reference": "Section X.X or clause name if identifiable",
      "client_claim": "What the client is requesting/implying"
    }
  ],
  "response_options": [
    {
      "type": "PUSHBACK",
      "label": "Friendly Pushback",
      "draft": "Full email/message draft...",
      "recommended": false
    },
    {
      "type": "CHANGE_ORDER",
      "label": "Propose Change Order",
      "draft": "Full email/message draft with change order offer...",
      "recommended": true
    },
    {
      "type": "FIRM",
      "label": "Firm Contract Reference",
      "draft": "Full email/message draft citing contract...",
      "recommended": false
    }
  ],
  "suggested_change_order": {
    "applicable": true,
    "additional_work_description": "Brief description",
    "estimated_hours": 10,
    "suggested_rate_usd": 80,
    "suggested_cost_usd": 800,
    "timeline_extension_days": 5,
    "notes": "Optional context"
  },
  "summary": "One sentence summary of what was detected"
}`
}

export default async function handler(req, res) {
  const startTime = Date.now()
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  // Auth
  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  // Pro tier gate
  if (!PRO_TIERS.includes(auth.keyData.tier)) {
    logError('POST /v1/scope/analyze', { 
      code: 'PRO_REQUIRED',
      tier: auth.keyData.tier,
    })
    return res.status(403).json({
      success: false,
      error: {
        code: 'PRO_REQUIRED',
        message: 'Scope Guard requires a Pro plan (Growth, Scale, or Enterprise)',
        hint: 'Upgrade at https://ebenova.dev/pricing',
        upgrade_url: 'https://ebenova.dev/pricing',
      },
    })
  }

  // Validate input with Zod
  const body = await parseBody(req)
  let validated
  try {
    validated = ScopeGuardAnalyzeSchema.parse(body)
  } catch (err) {
    logError('POST /v1/scope/analyze', { 
      code: 'VALIDATION_ERROR',
      details: formatValidationError(err)
    })
    return res.status(400).json({ 
      success: false, 
      error: formatValidationError(err)
    })
  }

  const { contract_text, client_message, channel, jurisdiction } = validated

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    logError('POST /v1/scope/analyze', { 
      code: 'SERVER_MISCONFIGURED',
      message: 'ANTHROPIC_API_KEY not set'
    })
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'AI service not configured' } })
  }

  try {
    const prompt = buildAnalysisPrompt(contract_text, client_message, channel, jurisdiction)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiData.content?.[0]?.text) throw new Error('No AI response')

    let result
    try {
      const raw = aiData.content[0].text.replace(/```json\n?|\n?```/g, '').trim()
      result = JSON.parse(raw)
    } catch {
      throw new Error('Failed to parse AI response')
    }

    // Track Scope Guard usage
    try {
      const redis = getRedis()
      await redis.incr(scopeGuardRedisKey(auth.key, 'analyze_calls'))
      
      if (result.violation_detected) {
        await redis.incr(scopeGuardRedisKey(auth.key, 'violations_detected'))
      }

      // Track response types chosen
      if (result.response_options && Array.isArray(result.response_options)) {
        for (const option of result.response_options) {
          if (option.recommended) {
            if (option.type === 'FIRM') {
              await redis.incr(scopeGuardRedisKey(auth.key, 'firm_responses'))
            } else if (option.type === 'PUSHBACK') {
              await redis.incr(scopeGuardRedisKey(auth.key, 'pushback_responses'))
            } else if (option.type === 'CHANGE_ORDER') {
              await redis.incr(scopeGuardRedisKey(auth.key, 'change_orders_pending'))
            }
          }
        }
      }
    } catch (statsErr) {
      console.error('[scope/analyze] stats tracking error:', statsErr.message)
      // Don't fail the request if stats tracking fails
    }

    await recordUsage(auth)

    logRequest('POST /v1/scope/analyze', 'POST', 200, Date.now() - startTime, { 
      tier: auth.keyData?.tier,
      violation_detected: result.violation_detected,
    })

    return res.status(200).json({
      success: true,
      violation_detected: result.violation_detected,
      violations: result.violations || [],
      response_options: result.response_options || [],
      suggested_change_order: result.suggested_change_order || null,
      summary: result.summary || '',
      usage: buildUsageBlock(auth),
      meta: {
        contract_length: contract_text.length,
        message_length: client_message.length,
        channel,
      },
    })
  } catch (err) {
    logDetailedError('POST /v1/scope/analyze', err, { 
      tier: auth.keyData?.tier,
      contract_length: contract_text.length,
    })
    return res.status(500).json({ success: false, error: { code: 'ANALYSIS_FAILED', message: err.message } })
  }
}
