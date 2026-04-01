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

function buildPrompt(docType, fields) {
  const fieldSummary = Object.entries(fields)
    .filter(([, v]) => v && (typeof v === 'string' ? v.trim() : true))
    .map(([k, v]) => {
      const display = Array.isArray(v) ? v.join(', ') : v
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
      return `${label}: ${display}`
    })
    .join('\n')
  const docName = docType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return `Generate a professional, comprehensive ${docName} document for the following:\n\n${fieldSummary}\n\nRequirements:\n- Formal legal language\n- Clear numbered sections\n- All standard clauses\n- Actual values only — no placeholders\n- End with signature block\n- No disclaimers\n\nOutput the complete document only.`
}

async function generateOneDocument(docType, fields, jurisdiction) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY not set')
  const enrichedFields = { ...fields, jurisdiction }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90000)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      system: 'You are an expert legal document drafter. Generate comprehensive, professional legal documents. Use formal legal language, clear numbered sections, all standard clauses. Never add disclaimers or suggestions to consult a lawyer. The document ends cleanly after the signature block.',
      messages: [{ role: 'user', content: buildPrompt(docType, enrichedFields) }],
    }),
    signal: controller.signal,
  })
  clearTimeout(timeoutId)
  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`)
  const data = await response.json()
  return data.content[0]?.text || ''
}

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

  const results = []
  let successCount = 0

  // Generate each document sequentially — direct Anthropic call (no self-HTTP-loop)
  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]
    try {
      const text = await generateOneDocument(
        doc.document_type,
        doc.fields,
        doc.jurisdiction || 'Nigeria',
      )
      await recordUsage(auth)  // charge one document per successful generation
      successCount++
      results.push({
        index: i,
        document_type: doc.document_type,
        success: true,
        document: text,
        error: null,
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

  const failed = results.length - successCount

  return res.status(200).json({
    success: true,
    total: documents.length,
    succeeded: successCount,
    failed,
    results,
    usage: buildUsageBlock(auth, successCount),
  })
}
