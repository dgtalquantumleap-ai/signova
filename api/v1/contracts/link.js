// api/v1/contracts/link.js
// POST /v1/contracts/link — Link a contract to a payment reference
// GET  /v1/contracts/link?contract_id=xxx — Retrieve by contract
// GET  /v1/contracts/link?payment_ref=xxx — Retrieve by payment
// Uses Upstash Redis for storage, bidirectional lookup

import { authenticate, recordUsage, buildUsageBlock } from '../../../lib/api-auth.js'

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

async function redis(cmd, args) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new Error('Redis not configured')
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd, ...args]),
  })
  const data = await r.json()
  return data.result
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  const owner = auth.keyData?.owner || 'unknown'

  // GET — retrieve a linked contract
  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://api.ebenova.dev')
    const contractId = url.searchParams.get('contract_id')
    const paymentRef = url.searchParams.get('payment_ref')

    if (!contractId && !paymentRef) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAM', message: 'Provide contract_id or payment_ref query parameter' },
      })
    }

    const key = contractId
      ? `link:c:${owner}:${contractId}`
      : `link:p:${owner}:${paymentRef}`

    try {
      const raw = await redis('GET', [key])
      if (!raw) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No link found' } })
      return res.status(200).json({ success: true, link: JSON.parse(raw) })
    } catch (err) {
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
    }
  }

  // POST — create a new link
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const body = await parseBody(req)
  const { contract_id, document_type, payment_ref, payment_amount, payment_currency, payment_status, parties, notes } = body

  if (!contract_id || typeof contract_id !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'contract_id is required' } })
  }
  if (!payment_ref || typeof payment_ref !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'payment_ref is required' } })
  }

  const link = {
    contract_id,
    document_type: document_type || 'unknown',
    payment_ref,
    payment_amount: payment_amount || null,
    payment_currency: payment_currency || 'NGN',
    payment_status: payment_status || 'pending',
    parties: parties || [],
    notes: notes || '',
    linked_at: new Date().toISOString(),
    linked_by: owner,
  }

  try {
    const TTL = 365 * 24 * 60 * 60
    const val = JSON.stringify(link)
    await redis('SET', [`link:c:${owner}:${contract_id}`, val, 'EX', String(TTL)])
    await redis('SET', [`link:p:${owner}:${payment_ref}`, val, 'EX', String(TTL)])
    await recordUsage(auth)

    return res.status(201).json({
      success: true,
      link,
      usage: buildUsageBlock(auth),
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } })
  }
}
