// api/v1/scope/change-order.js
// POST /v1/scope/change-order
// Generates a formal change order document.
// Pro tier required.

import { authenticate, recordUsage, buildUsageBlock } from '../../../lib/api-auth.js'

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

function buildChangeOrderPrompt(params) {
  const {
    original_contract_summary, freelancer_name, client_name,
    original_scope, additional_work, additional_cost,
    currency = 'USD', timeline_extension_days, jurisdiction = 'International',
    contract_date, change_order_number = 1,
  } = params

  return `Generate a formal, professional Change Order document with the following details.

CHANGE ORDER DETAILS:
- Change Order Number: #${change_order_number}
- Freelancer/Service Provider: ${freelancer_name || 'Service Provider'}
- Client: ${client_name || 'Client'}
- Original Contract Date: ${contract_date || 'As previously agreed'}
- Original Scope Summary: ${original_scope || original_contract_summary || 'As defined in original agreement'}
- Additional Work Requested: ${additional_work}
- Additional Cost: ${currency} ${additional_cost}
- Timeline Extension: ${timeline_extension_days ? `${timeline_extension_days} business days` : 'To be mutually agreed'}
- Governing Law: ${jurisdiction}

Generate a complete, professional change order document that:
1. References the original agreement
2. Clearly defines the additional scope
3. States the additional compensation
4. Includes payment terms for the additional work (due upon approval or milestone)
5. States the revised timeline
6. Includes signature blocks for both parties
7. Uses appropriate legal language for ${jurisdiction}

Format as a complete document ready to send. Use professional formatting with clear sections.`
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  if (!PRO_TIERS.includes(auth.keyData.tier)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PRO_REQUIRED',
        message: 'Scope Guard requires a Pro plan',
        hint: 'Upgrade at https://ebenova.dev/pricing',
        upgrade_url: 'https://ebenova.dev/pricing',
      },
    })
  }

  const body = await parseBody(req)
  const { additional_work, additional_cost, freelancer_name, client_name } = body

  if (!additional_work || typeof additional_work !== 'string') {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'additional_work is required' },
    })
  }
  if (!additional_cost || isNaN(Number(additional_cost))) {
    return res.status(400).json({
      success: false,
      error: { code: 'MISSING_FIELD', message: 'additional_cost is required (number)' },
    })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } })

  try {
    const prompt = buildChangeOrderPrompt(body)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiData.content?.[0]?.text) throw new Error('No AI response')

    const document = aiData.content[0].text

    await recordUsage(auth)

    return res.status(200).json({
      success: true,
      document,
      change_order_details: {
        freelancer_name: freelancer_name || 'Service Provider',
        client_name: client_name || 'Client',
        additional_work,
        additional_cost: Number(additional_cost),
        currency: body.currency || 'USD',
        timeline_extension_days: body.timeline_extension_days || null,
        jurisdiction: body.jurisdiction || 'International',
        generated_at: new Date().toISOString(),
      },
      usage: buildUsageBlock(auth),
    })
  } catch (err) {
    console.error('[scope/change-order] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'GENERATION_FAILED', message: err.message } })
  }
}
