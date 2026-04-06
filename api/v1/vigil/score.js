// api/v1/vigil/score.js — GET /v1/vigil/score?card_id=
// Live risk score 0–100 for a card. Proxied to Vigil.
import { authenticate, trackRequest } from '../../../lib/api-auth.js'
import { logError } from '../../../lib/logger.js'

const VIGIL_URL = process.env.VIGIL_API_URL

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })
  await trackRequest(auth, req)

  if (!VIGIL_URL) {
    return res.status(503).json({ success: false, error: { code: 'VIGIL_UNAVAILABLE', message: 'Vigil service not configured. Set VIGIL_API_URL.' } })
  }

  const cardId = req.query?.card_id
  if (!cardId) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Required query param: card_id' } })

  try {
    const up = await fetch(`${VIGIL_URL}/api/v1/fraud/score/${encodeURIComponent(cardId)}`, {
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await up.json()
    if (!up.ok) return res.status(up.status).json({ success: false, error: data })
    return res.status(200).json({ success: true, ...data })
  } catch (err) {
    logError('vigil/score', err)
    return res.status(503).json({ success: false, error: { code: 'VIGIL_UNAVAILABLE', message: 'Vigil service unavailable.' } })
  }
}
