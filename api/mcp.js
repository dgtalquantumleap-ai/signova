// api/mcp.js — Minimal MCP HTTP handler (pure JSON-RPC, no SDK dependency)
// Implements MCP Streamable HTTP transport manually for Vercel serverless

const TOOLS = [
  {
    name: 'generate_legal_document',
    description: 'Generate a professionally drafted legal document. 27 document types, 18 jurisdictions including Nigeria, UK, US, Canada, Ghana, Kenya, UAE and more.',
    inputSchema: {
      type: 'object',
      properties: {
        document_type: { type: 'string', description: 'Type of document e.g. nda, freelance-contract, tenancy-agreement, privacy-policy' },
        fields: { type: 'object', description: 'Document-specific fields as key-value pairs', additionalProperties: true },
        jurisdiction: { type: 'string', description: 'Governing jurisdiction e.g. Nigeria, United Kingdom, United States' },
      },
      required: ['document_type', 'fields'],
    },
  },
  {
    name: 'extract_from_conversation',
    description: 'Extract structured legal document fields from a raw conversation (WhatsApp, email, chat). Optionally auto-generate the full document.',
    inputSchema: {
      type: 'object',
      properties: {
        conversation: { type: 'string', description: 'Raw conversation text, max 10,000 characters' },
        target_document: { type: 'string', description: 'Target document type (AI suggests if omitted)' },
        auto_generate: { type: 'boolean', description: 'If true, also generate the full document after extraction' },
      },
      required: ['conversation'],
    },
  },
  {
    name: 'list_document_types',
    description: 'List all 27 supported legal document types grouped by category.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_usage',
    description: 'Check how many documents have been generated this month and what quota remains.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_document_templates',
    description: 'Get field schemas for document types. Returns all required and optional fields with types, labels, and placeholders. Use this to build dynamic forms or understand what fields a document needs before generating it.',
    inputSchema: {
      type: 'object',
      properties: {
        document_type: { type: 'string', description: 'Specific document type to get schema for (e.g. nda, tenancy-agreement). Omit to list all types.' },
      },
    },
  },
  {
    name: 'batch_generate_documents',
    description: 'Generate multiple legal documents in a single call. Max 10 documents per batch. Each document is generated independently — if one fails, others still succeed.',
    inputSchema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          description: 'Array of document specs, each with document_type, fields, and optional jurisdiction',
          items: {
            type: 'object',
            properties: {
              document_type: { type: 'string', description: 'Type of document e.g. nda, freelance-contract' },
              fields: { type: 'object', description: 'Document fields as key-value pairs', additionalProperties: true },
              jurisdiction: { type: 'string', description: 'Governing jurisdiction' },
            },
            required: ['document_type', 'fields'],
          },
        },
      },
      required: ['documents'],
    },
  },
  {
    name: 'link_contract_payment',
    description: 'Link a generated contract to a payment reference (bank transfer, invoice, etc). Creates a bidirectional association so you can look up contracts by payment ref or payments by contract ID.',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Unique contract identifier' },
        document_type: { type: 'string', description: 'Type of document (e.g. tenancy-agreement)' },
        payment_ref: { type: 'string', description: 'Payment reference (bank transfer ref, invoice number, etc)' },
        payment_amount: { type: 'number', description: 'Payment amount' },
        payment_currency: { type: 'string', description: 'Currency code (e.g. NGN, USD, GBP)' },
        payment_status: { type: 'string', description: 'Status: pending, paid, overdue, disputed' },
        parties: { type: 'array', items: { type: 'string' }, description: 'Names of parties involved' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['contract_id', 'payment_ref'],
    },
  },
  {
    name: 'lookup_contract_link',
    description: 'Look up a contract-payment link by contract ID or payment reference.',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Contract ID to look up' },
        payment_ref: { type: 'string', description: 'Payment reference to look up' },
      },
    },
  },
]

const API_BASE = 'https://www.getsignova.com'

function getApiKey(req) {
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (auth) return auth
  try {
    const u = new URL(req.url, API_BASE)
    return u.searchParams.get('EBENOVA_API_KEY') || ''
  } catch { return '' }
}

async function callApi(path, body, key) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  return r.json()
}

async function getApi(path, key) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
  })
  return r.json()
}

function jsonrpc(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function jsonrpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

async function handleMessage(msg, apiKey) {
  const { id, method, params } = msg

  if (method === 'initialize') {
    return jsonrpc(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'ebenova-legal-docs', version: '1.0.0' },
    })
  }

  if (method === 'notifications/initialized') return null

  if (method === 'tools/list') {
    return jsonrpc(id, { tools: TOOLS })
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params || {}
    try {
      let text = ''
      if (name === 'generate_legal_document') {
        const data = await callApi('/v1/documents/generate', args, apiKey)
        text = data.success ? data.document : `Error: ${data.error?.message || 'Failed'}`
      } else if (name === 'extract_from_conversation') {
        const data = await callApi('/v1/extract/conversation', args, apiKey)
        text = data.success ? JSON.stringify(data, null, 2) : `Error: ${data.error?.message}`
      } else if (name === 'list_document_types') {
        const data = await getApi('/v1/documents/types', apiKey)
        if (data.success) {
          const lines = [`${data.total} document types:`]
          for (const [cat, docs] of Object.entries(data.grouped || {})) {
            lines.push(`\n${cat}:`)
            for (const d of docs) lines.push(`  - ${d.type}: ${d.label}`)
          }
          text = lines.join('\n')
        } else { text = 'Error fetching types.' }
      } else if (name === 'check_usage') {
        const data = await getApi('/v1/keys/usage', apiKey)
        if (data.success) {
          const cm = data.current_month
          text = `${cm.documents_used}/${cm.monthly_limit} used (${cm.documents_remaining} remaining)`
        } else { text = `Error: ${data.error?.message}` }
      } else if (name === 'get_document_templates') {
        const type = args.document_type
        const path = type ? `/v1/documents/templates?type=${type}` : '/v1/documents/templates'
        const data = await getApi(path, apiKey)
        if (data.success) {
          if (type && data.fields) {
            const lines = [`${data.label} (${data.category})`, `Fields:`]
            for (const f of data.fields) {
              lines.push(`  - ${f.key}: ${f.label} (${f.type}${f.required ? ', required' : ''})${f.placeholder ? ` — e.g. "${f.placeholder}"` : ''}`)
            }
            text = lines.join('\n')
          } else {
            text = `${data.total} document templates available:\n` + data.templates.map(t => `  - ${t.type}: ${t.label} (${t.field_count} fields, ${t.required_fields} required)`).join('\n')
          }
        } else { text = `Error: ${data.error?.message}` }
      } else if (name === 'batch_generate_documents') {
        const data = await callApi('/v1/documents/batch', args, apiKey)
        if (data.success) {
          const lines = [`Batch complete: ${data.succeeded}/${data.total} succeeded`]
          for (const r of data.results) {
            lines.push(`  [${r.index}] ${r.document_type}: ${r.success ? 'OK' : 'FAILED — ' + (r.error?.message || 'unknown')}`)
          }
          if (data.results.some(r => r.success && r.document)) {
            lines.push('\n--- Generated Documents ---')
            for (const r of data.results.filter(r => r.success && r.document)) {
              lines.push(`\n=== ${r.document_type} [${r.index}] ===\n${r.document.substring(0, 500)}...`)
            }
          }
          text = lines.join('\n')
        } else { text = `Error: ${data.error?.message}` }
      } else if (name === 'link_contract_payment') {
        const data = await callApi('/v1/contracts/link', args, apiKey)
        if (data.success) {
          const l = data.link
          text = `Linked contract ${l.contract_id} to payment ${l.payment_ref} (${l.payment_status}, ${l.payment_currency} ${l.payment_amount || 'N/A'})`
        } else { text = `Error: ${data.error?.message}` }
      } else if (name === 'lookup_contract_link') {
        const params = args.contract_id ? `contract_id=${args.contract_id}` : `payment_ref=${args.payment_ref}`
        const data = await getApi(`/v1/contracts/link?${params}`, apiKey)
        if (data.success) {
          const l = data.link
          text = `Contract: ${l.contract_id}\nPayment Ref: ${l.payment_ref}\nStatus: ${l.payment_status}\nAmount: ${l.payment_currency} ${l.payment_amount || 'N/A'}\nLinked: ${l.linked_at}\nParties: ${(l.parties || []).join(', ') || 'N/A'}`
        } else { text = `Error: ${data.error?.message || 'Not found'}` }
      } else {
        return jsonrpcError(id, -32601, `Unknown tool: ${name}`)
      }
      return jsonrpc(id, { content: [{ type: 'text', text }] })
    } catch (err) {
      return jsonrpc(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true })
    }
  }

  return jsonrpcError(id, -32601, `Method not found: ${method}`)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method === 'GET') {
    return res.status(200).json({ name: 'ebenova-legal-docs', version: '1.0.0', protocol: 'MCP' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const apiKey = getApiKey(req)
    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    // Vercel may not parse body for ESM functions — manually read stream if needed
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      body = await new Promise((resolve) => {
        let raw = ''
        req.on('data', chunk => { raw += chunk })
        req.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve({}) } })
        req.on('error', () => resolve({}))
      })
    }

    // Handle batch or single message
    const messages = Array.isArray(body) ? body : [body]
    const responses = []

    for (const msg of messages) {
      const response = await handleMessage(msg, apiKey)
      if (response !== null) responses.push(response)
    }

    res.setHeader('Content-Type', 'application/json')
    if (responses.length === 0) return res.status(202).end()
    if (responses.length === 1 && !Array.isArray(body)) {
      return res.status(200).json(responses[0])
    }
    return res.status(200).json(responses)
  } catch (err) {
    console.error('[mcp] error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
