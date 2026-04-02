// api/v1/vigil/report.js — POST /v1/vigil/report
// AML compliance report generation (Claude Sonnet). Enterprise-tier feature.
import { authenticate, recordUsage, buildUsageBlock, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'

const VIGIL_URL = process.env.VIGIL_API_URL || 'http://localhost:3000'

async function parseBody(req) {
  if (req.body && typeof req.body === 'object' && req.body !== null) return req.body
  return new Promise((resolve) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  const REPORT_TIERS = ['scale', 'enterprise']
  if (!REPORT_TIERS.includes(auth.keyData?.tier)) {
    return res.status(403).json({ success: false, error: { code: 'TIER_REQUIRED', message: 'AML report generation requires Scale plan or above', hint: 'Upgrade at ebenova.dev/pricing' } })
  }

  await trackRequest(auth, req)
  const body = await parseBody(req)
  if (!body.card_id) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Required: card_id' } })

  try {
    const up = await fetch(`${VIGIL_URL}/api/v1/fraud/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await up.json()
    if (!up.ok) return res.status(up.status).json({ success: false, error: data })
    await recordUsage(auth)
    return res.status(200).json({ success: true, ...data, _usage: buildUsageBlock(auth) })
  } catch (err) {
    logError('vigil/report', err)
    return res.status(503).json({ success: false, error: { code: 'VIGIL_UNAVAILABLE', message: 'Vigil service unavailable.' } })
  }
}
