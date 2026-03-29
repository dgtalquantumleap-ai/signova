// api/scope-guard-analyze.js
// POST /api/scope-guard-analyze
// Consumer-facing Scope Guard — no auth required
// Uses Groq for free tier (3 analyses per IP per day)
// Separate from /api/v1/scope/analyze which requires API key auth

const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_PER_WINDOW = 3

const ipStore = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = ipStore.get(ip)
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_PER_WINDOW) return true
  entry.count++
  return false
}

function getRemainingUses(ip) {
  const now = Date.now()
  const entry = ipStore.get(ip)
  if (!entry || now > entry.resetAt) return MAX_PER_WINDOW
  return Math.max(0, MAX_PER_WINDOW - entry.count)
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

function buildAnalysisPrompt(contractText, clientMessage, channel) {
  return `You are a contract enforcement AI. Analyze the client's message against the original contract and identify any scope violations.

## ORIGINAL CONTRACT:
${contractText}

## CLIENT MESSAGE (via ${channel || 'email'}):
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
    "suggested_cost_usd": 800,
    "timeline_extension_days": 5
  },
  "summary": "One sentence summary of what was detected"
}`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'

  // Check rate limit BEFORE processing
  const remaining = getRemainingUses(ip)
  if (remaining <= 0) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'You have used all 3 free analyses for today. Resets in 24 hours.',
        upgrade_url: 'https://www.getsignova.com/scope-guard',
      },
      remaining_uses: 0,
    })
  }

  const body = await parseBody(req)
  const { contract_text, client_message, communication_channel = 'email' } = body

  if (!contract_text || typeof contract_text !== 'string' || contract_text.trim().length < 50) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CONTRACT', message: 'Contract text is required (min 50 characters)' },
    })
  }
  if (!client_message || typeof client_message !== 'string' || client_message.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_MESSAGE', message: 'Client message is required' },
    })
  }
  if (contract_text.length > 20000) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONTRACT_TOO_LONG', message: 'Contract text must be under 20,000 characters for free tier' },
    })
  }

  // Use Groq for free tier (fast + cheap)
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'AI service not configured' } })
  }

  try {
    const prompt = buildAnalysisPrompt(contract_text, client_message, communication_channel)

    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a contract enforcement AI. Always respond with valid JSON only. No markdown, no backticks, no explanation.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.choices?.[0]?.message?.content
    if (!rawText) throw new Error('No AI response')

    let result
    try {
      const cleaned = rawText.replace(/```json\n?|\n?```/g, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      throw new Error('Failed to parse AI response')
    }

    // Count usage AFTER successful analysis
    if (isRateLimited(ip)) {
      // Edge case: was not limited before but became limited during processing
      // Still return the result since we already computed it
    }

    return res.status(200).json({
      success: true,
      violation_detected: result.violation_detected || false,
      violations: result.violations || [],
      response_options: result.response_options || [],
      suggested_change_order: result.suggested_change_order || null,
      summary: result.summary || '',
      remaining_uses: Math.max(0, getRemainingUses(ip) - 1),
      meta: {
        contract_length: contract_text.length,
        message_length: client_message.length,
        channel: communication_channel,
        tier: 'free',
      },
    })
  } catch (err) {
    console.error('[scope-guard-analyze] error:', err.message)
    return res.status(500).json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: 'Analysis failed. Please try again.' },
    })
  }
}
