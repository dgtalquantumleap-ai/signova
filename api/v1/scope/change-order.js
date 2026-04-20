// api/v1/scope/change-order.js
// POST /v1/scope/change-order
// Generates a formal change order document.
// Pro tier required.

import { authenticate, recordUsage, buildUsageBlock } from '../../../lib/api-auth.js'
import { getRedis } from '../../../lib/redis.js'
import { ScopeGuardChangeOrderSchema, formatValidationError } from '../../../lib/validators.js'
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

function buildChangeOrderPrompt(params) {
  const {
    original_contract_summary, freelancer_name, client_name,
    original_scope, additional_work, additional_cost,
    currency = 'USD', timeline_extension_days, jurisdiction,
    contract_date, change_order_number = 1,
  } = params

  // Jurisdiction context — same source of truth as the analyze endpoint.
  // When jurisdiction is undefined / unrecognised, the helper returns the
  // Commonwealth-baseline + anti-US-default block, so the change order won't
  // silently drift to California / AAA arbitration.
  const jurisdictionContext = buildJurisdictionContext(jurisdiction)
  const jurisdictionLabel = jurisdictionDisplayName(jurisdiction)

  return `${jurisdictionContext}

Use legal language per the jurisdiction-specific statute context above. Cite specific statutes from that context where they bear on the change-order terms (governing law, dispute resolution, currency, statute of frauds for amendment formality, etc.). Do not invoke statutes from other jurisdictions.

Generate a formal, professional Change Order document with the following details.

CHANGE ORDER DETAILS:
- Change Order Number: #${change_order_number}
- Freelancer/Service Provider: ${freelancer_name || 'Service Provider'}
- Client: ${client_name || 'Client'}
- Original Contract Date: ${contract_date || 'As previously agreed'}
- Original Scope Summary: ${original_scope || original_contract_summary || 'As defined in original agreement'}
- Additional Work Requested: ${additional_work}
- Additional Cost: ${currency} ${additional_cost}
- Timeline Extension: ${timeline_extension_days ? `${timeline_extension_days} business days` : 'To be mutually agreed'}
- Governing Law: ${jurisdictionLabel}

Generate a complete, professional change order document that:
1. References the original agreement
2. Clearly defines the additional scope
3. States the additional compensation
4. Includes payment terms for the additional work (due upon approval or milestone)
5. States the revised timeline
6. Includes signature blocks for both parties (with witness lines where the jurisdiction context above requires them — e.g. two witnesses per party for Nigeria / Commonwealth standard)
7. Names the governing law as ${jurisdictionLabel}

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
  // Validate via Zod — gives consistent VALIDATION_ERROR shape and
  // jurisdiction enum enforcement matching the analyze endpoint.
  let validated
  try {
    validated = ScopeGuardChangeOrderSchema.parse(body)
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: formatValidationError(err),
    })
  }
  const { additional_work, additional_cost, freelancer_name, client_name } = validated

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR' } })

  try {
    const prompt = buildChangeOrderPrompt(validated)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    if (!aiData.content?.[0]?.text) throw new Error('No AI response')

    const document = aiData.content[0].text

    // Track Scope Guard usage
    try {
      const redis = getRedis()
      await redis.incr(scopeGuardRedisKey(auth.key, 'change_orders_generated'))
    } catch (statsErr) {
      console.error('[scope/change-order] stats tracking error:', statsErr.message)
      // Don't fail the request if stats tracking fails
    }

    await recordUsage(auth)

    return res.status(200).json({
      success: true,
      document,
      change_order_details: {
        freelancer_name: freelancer_name || 'Service Provider',
        client_name: client_name || 'Client',
        additional_work,
        additional_cost: Number(additional_cost),
        currency: validated.currency || 'USD',
        timeline_extension_days: validated.timeline_extension_days || null,
        jurisdiction: validated.jurisdiction || null,
        jurisdiction_label: jurisdictionDisplayName(validated.jurisdiction),
        generated_at: new Date().toISOString(),
      },
      usage: buildUsageBlock(auth),
    })
  } catch (err) {
    console.error('[scope/change-order] error:', err.message)
    return res.status(500).json({ success: false, error: { code: 'GENERATION_FAILED', message: err.message } })
  }
}
