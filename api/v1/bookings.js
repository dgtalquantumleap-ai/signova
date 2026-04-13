// api/v1/bookings.js — POST /v1/bookings · GET /v1/bookings/:id
// FieldOps Agent — WhatsApp-native booking, revenue recovery, staff coordination.
// Proxied to the FieldOps Railway server with Ebenova API key auth.
//
// Required env vars:
//   FIELDOPS_API_URL      — base URL of the FieldOps Railway deployment
//   FIELDOPS_INTERNAL_KEY — internal API key for FieldOps server auth

import { authenticate, recordUsage, buildUsageBlock, trackRequest } from '../../lib/api-auth.js'
import { logError } from '../../lib/logger.js'

const FIELDOPS_URL = process.env.FIELDOPS_API_URL
if (!FIELDOPS_URL) console.warn('[fieldops] FIELDOPS_API_URL not set — /v1/bookings will return 503')

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST or GET' } })
  }

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })
  await trackRequest(auth, req)

  if (!FIELDOPS_URL) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'FIELDOPS_UNAVAILABLE',
        message: 'FieldOps service not configured. Contact api@ebenova.dev for access.',
        hint: 'Deploy the FieldOps Agent server and set FIELDOPS_API_URL.',
      },
    })
  }

  // Validate required fields for POST /v1/bookings
  let body = null
  if (req.method === 'POST') {
    body = await parseBody(req)
    const required = ['customer_name', 'customer_phone', 'service', 'date', 'time', 'address']
    const missing = required.filter(f => !body[f])
    if (missing.length) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELD', message: `Required fields: ${missing.join(', ')}` },
      })
    }
  }

  try {
    // FieldOps server uses X-Api-Key header for internal auth
    const internalKey = process.env.FIELDOPS_INTERNAL_KEY || ''
    const upstreamRes = await fetch(`${FIELDOPS_URL}/v1/bookings`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': internalKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await upstreamRes.json()
    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ success: false, error: data })
    }

    await recordUsage(auth)
    return res.status(upstreamRes.status).json({
      success: true,
      ...data,
      _usage: buildUsageBlock(auth),
    })
  } catch (err) {
    logError('v1/bookings', err)
    return res.status(503).json({
      success: false,
      error: { code: 'FIELDOPS_UNAVAILABLE', message: 'FieldOps service unavailable.' },
    })
  }
}
