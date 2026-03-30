// api/v1/documents/batch.js
// POST /v1/documents/batch
// Generate multiple documents in a single API call
// Max 10 documents per batch
// Each document uses the same generation pipeline as /v1/documents/generate

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

const API_BASE = 'https://www.getsignova.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })

  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  const body = await parseBody(req)
  const { documents } = body

  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'documents must be a non-empty array' },
    })
  }

  if (documents.length > 10) {
    return res.status(400).json({
      success: false,
      error: { code: 'BATCH_TOO_LARGE', message: 'Maximum 10 documents per batch' },
    })
  }

  // Validate each document has required fields
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    if (!doc.document_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: `documents[${i}].document_type is required` },
      })
    }
    if (!doc.fields || typeof doc.fields !== 'object') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: `documents[${i}].fields is required` },
      })
    }
  }

  const apiKey = req.headers['authorization']?.replace('Bearer ', '').trim()
  const results = []

  // Generate each document sequentially (parallel would hit rate limits)
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    try {
      const r = await fetch(`${API_BASE}/v1/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          document_type: doc.document_type,
          fields: doc.fields,
          jurisdiction: doc.jurisdiction || 'Nigeria',
        }),
      })
      const data = await r.json()
      results.push({
        index: i,
        document_type: doc.document_type,
        success: data.success || false,
        document: data.document || null,
        error: data.error || null,
      })
    } catch (err) {
      results.push({
        index: i,
        document_type: doc.document_type,
        success: false,
        document: null,
        error: { code: 'GENERATION_FAILED', message: err.message },
      })
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  return res.status(200).json({
    success: true,
    total: documents.length,
    succeeded,
    failed,
    results,
    usage: buildUsageBlock(auth),
  })
}
