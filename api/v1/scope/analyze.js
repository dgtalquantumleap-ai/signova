// api/v1/scope/analyze.js
// POST /v1/scope/analyze
// Analyzes a client message against a contract for scope violations.
// Pro tier required.

import { authenticate } from '../../../lib/api-auth.js'

const PRO_TIERS = ['growth', 'scale', 'enterprise']

async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && req.body !== null) return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function buildAnalysisPrompt(contractText, clientMessage, channel) {
  return `You are a contract enforcement AI. Analyze the client's message against the original contract and identify any scope violations.

## ORIGINAL CONTRACT:
${contractText}

## CLIENT MESSAGE (via ${channel || 'unknown channel'}):
${clientMessage}

## YOUR TASK:
1. Identify all violations (SCOPE, REVISION, TIMELINE, PAYMENT, IP, TERMINATION)
2. For each violation, cite the specific contract section if possible
3. Generate 3 professional response options (PUSHBACK, CHANGE_ORDER, FIRM)
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

  const body = await parseBody(req)
  const { contract_text, client_message, communication_channel = 'email' } = body

  if (!contract_text || typeof contract_text !== 'string' || contract_text.trim().length < 50) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CONTRACT', message: 'contract_text is required (min 50 characters)' },
    })
  }
  if (!client_message || typeof client_message !== 'string' || client_message.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_MESSAGE', message: 'client_message is required' },
    })
  }

  if (contract_text.length > 50000) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONTRACT_TOO_LONG', message: 'contract_text must be under 50,000 characters' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'AI service not configured' } })

  try {
    const prompt = buildAnalysisPrompt(contract_text, client_message, communication_channel)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
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

    return res.status(200).json({
      success: true,
      violation_detected: result.violation_detected,
      violations: result.violations || [],
      response_options: result.response_options || [],
      suggested_change_order: result.suggested_change_order || null,
      summary: result.summary || '',
      meta: {
        contract_length: contract_text.length,
        message_length: client_message.length,
        channel: communication_channel,
      },
    })
  } catch (err) {
    console.error('[scope/analyze] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'ANALYSIS_FAILED', message: err.message } })
  }
}
