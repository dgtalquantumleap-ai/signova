// api/mcp.js — MCP Streamable HTTP endpoint for Smithery/MCPize/Claude.ai
// Pure JSON-RPC implementation, no SDK dependency (avoids Zod version conflicts)
// Spec: https://modelcontextprotocol.io/specification/2024-11-05/transports

const TOOLS = [
  {
    name: 'generate_legal_document',
    description: 'Generate a professionally drafted legal document. 27 document types, 18 jurisdictions including Nigeria, UK, US, Canada, Ghana, Kenya, UAE and more.',
    inputSchema: {
      type: 'object',
      properties: {
        document_type: { type: 'string', description: 'e.g. nda, freelance-contract, tenancy-agreement, privacy-policy' },
        fields: { type: 'object', description: 'Document-specific fields as key-value pairs', additionalProperties: true },
        jurisdiction: { type: 'string', description: 'e.g. Nigeria, United Kingdom, United States' },
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
        auto_generate: { type: 'boolean', description: 'If true, generate the full document after extraction' },
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
    description: 'Get field schemas for document types — required fields, types, labels, placeholders.',
    inputSchema: {
      type: 'object',
      properties: {
        document_type: { type: 'string', description: 'Specific type to get schema for, or omit for all types.' },
      },
    },
  },
  {
    name: 'batch_generate_documents',
    description: 'Generate up to 10 legal documents in a single call.',
    inputSchema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          description: 'Array of {document_type, fields, jurisdiction?} objects',
          items: {
            type: 'object',
            properties: {
              document_type: { type: 'string' },
              fields: { type: 'object', additionalProperties: true },
              jurisdiction: { type: 'string' },
            },
            required: ['document_type', 'fields'],
          },
        },
      },
      required: ['documents'],
    },
  },
  {
    name: 'analyze_scope_creep',
    description: 'Analyze a client message against an original contract to detect scope violations and draft professional responses.',
    inputSchema: {
      type: 'object',
      properties: {
        contract_text: { type: 'string', description: 'Full text of the original contract (min 50 chars)' },
        client_message: { type: 'string', description: "The client's request or message to analyze" },
        communication_channel: { type: 'string', description: 'email, whatsapp, slack, or other' },
      },
      required: ['contract_text', 'client_message'],
    },
  },
  {
    name: 'generate_change_order',
    description: 'Generate a formal change order document when additional work is requested beyond the original contract scope.',
    inputSchema: {
      type: 'object',
      properties: {
        freelancer_name: { type: 'string' },
        client_name: { type: 'string' },
        original_scope: { type: 'string', description: 'Brief description of original agreed work' },
        additional_work: { type: 'string', description: 'Description of the new/additional work' },
        additional_cost: { type: 'number', description: 'Additional cost in the specified currency' },
        currency: { type: 'string', description: 'e.g. USD, NGN, GBP' },
        timeline_extension_days: { type: 'number', description: 'Extra business days needed' },
        jurisdiction: { type: 'string' },
      },
      required: ['additional_work', 'additional_cost'],
    },
  },
  {
    name: 'link_contract_payment',
    description: 'Link a generated contract to a payment reference (bank transfer, invoice, etc). Creates a bidirectional association for lookup by contract ID or payment ref.',
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
  // ── Vigil Fraud Alert tools ───────────────────────────────────────────────
  {
    name: 'vigil_authorize',
    description: 'Run a card transaction through the Vigil proximity fraud engine. Returns approve/decline with distance from home, risk score, and fraud alert if triggered. Requires card_id + merchant location + amount.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier (e.g. card_01)' },
        merchant_name: { type: 'string', description: 'Merchant name' },
        merchant_city: { type: 'string', description: 'City where transaction is occurring' },
        merchant_country: { type: 'string', description: '2-letter ISO country code, e.g. CA, US, GB' },
        merchant_lat: { type: 'number', description: 'Merchant latitude' },
        merchant_lng: { type: 'number', description: 'Merchant longitude' },
        amount_cents: { type: 'number', description: 'Transaction amount in cents' },
        currency: { type: 'string', description: 'ISO currency code, e.g. cad, usd' },
        merchant_mcc: { type: 'string', description: 'Merchant category code (optional)' },
      },
      required: ['card_id', 'merchant_name', 'merchant_country', 'amount_cents', 'currency'],
    },
  },
  {
    name: 'vigil_analyze_transaction',
    description: 'AI-powered fraud analysis for a transaction. Returns risk score 0–100, reasoning, contributing factors, recommended action, and pre-written SMS alert copy. Uses Claude Haiku.',
    inputSchema: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'Transaction ID from vigil_authorize result' },
      },
      required: ['transaction_id'],
    },
  },
  {
    name: 'vigil_get_risk_score',
    description: 'Get the live risk profile (score 0–100) for a card with explanation of contributing factors.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'vigil_generate_aml_report',
    description: 'Generate a full AML (Anti-Money Laundering) compliance report for a card over a date range. Uses Claude Sonnet. Requires Scale plan or above.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
        period_start: { type: 'string', description: 'Start date ISO string e.g. 2026-03-01' },
        period_end: { type: 'string', description: 'End date ISO string e.g. 2026-03-31' },
      },
      required: ['card_id'],
    },
  },
]

const API_BASE = 'https://api.ebenova.dev'

// ── Body parsing — same pattern as working API routes ──────────────────────
// Vercel pre-parses req.body for application/json requests.
// If req.body is already a parsed object, use it directly.
// Otherwise fall back to reading the raw stream (handles edge cases).
async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', () => resolve({}))
  })
}

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

function ok(id, result) { return { jsonrpc: '2.0', id: id ?? null, result } }
function err(id, code, message) { return { jsonrpc: '2.0', id: id ?? null, error: { code, message } } }
function text(str) { return { content: [{ type: 'text', text: str }] } }

// ── MCP message handler ────────────────────────────────────────────────────
async function handleMessage(msg, apiKey) {
  const { id, method, params } = msg || {}

  if (!method) return err(id, -32600, 'Invalid Request: missing method')

  // ── Lifecycle ────────────────────────────────────────────────────────────
  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'ebenova-legal-docs', version: '1.2.2' },
    })
  }

  if (method === 'notifications/initialized') return null  // one-way, no response

  if (method === 'ping') return ok(id, {})

  // ── Tools ────────────────────────────────────────────────────────────────
  if (method === 'tools/list') return ok(id, { tools: TOOLS })

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params || {}
    if (!name) return err(id, -32602, 'Invalid params: missing tool name')
    try {
      const result = await callTool(name, args, apiKey)
      return ok(id, result)
    } catch (e) {
      return ok(id, text(`Error: ${e.message}`))
    }
  }

  return err(id, -32601, `Method not found: ${method}`)
}

async function callTool(name, args, apiKey) {
  if (name === 'generate_legal_document') {
    const data = await callApi('/v1/documents/generate', args, apiKey)
    return text(data.success ? data.document : `Error: ${data.error?.message || 'Failed'}`)
  }

  if (name === 'extract_from_conversation') {
    const data = await callApi('/v1/extract/conversation', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    if (args.auto_generate && data.document) return text(data.document)
    return text(JSON.stringify({ suggested_document: data.suggested_document, extracted_fields: data.extracted_fields, missing_fields: data.missing_fields }, null, 2))
  }

  if (name === 'list_document_types') {
    const data = await getApi('/v1/documents/types', apiKey)
    if (!data.success) return text('Error fetching types.')
    const lines = [`${data.total} document types:`]
    for (const [cat, docs] of Object.entries(data.grouped || {})) {
      lines.push(`\n${cat.replace(/_/g, ' ')}:`)
      for (const d of docs) lines.push(`  - ${d.type}: ${d.label}`)
    }
    return text(lines.join('\n'))
  }

  if (name === 'check_usage') {
    const data = await getApi('/v1/keys/usage', apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const cm = data.current_month
    return text(`${cm.documents_used}/${cm.monthly_limit} documents used (${cm.documents_remaining} remaining). Resets ${new Date(cm.resets_at).toLocaleDateString()}`)
  }

  if (name === 'get_document_templates') {
    const type = args.document_type
    const path = type ? `/v1/documents/templates?type=${encodeURIComponent(type)}` : '/v1/documents/templates'
    const data = await getApi(path, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    if (type && data.fields) {
      const lines = [`${data.label} (${data.category})`, `Fields:`]
      for (const f of data.fields) lines.push(`  - ${f.key}: ${f.label} (${f.type}${f.required ? ', required' : ''})${f.placeholder ? ` — e.g. "${f.placeholder}"` : ''}`)
      return text(lines.join('\n'))
    }
    return text(`${data.total} templates:\n` + data.templates.map(t => `  - ${t.type}: ${t.label} (${t.field_count} fields)`).join('\n'))
  }

  if (name === 'batch_generate_documents') {
    const data = await callApi('/v1/documents/batch', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const lines = [`Batch: ${data.succeeded}/${data.total} succeeded`]
    for (const r of data.results) lines.push(`  [${r.index}] ${r.document_type}: ${r.success ? '✓' : '✗ ' + r.error?.message}`)
    return text(lines.join('\n'))
  }

  if (name === 'analyze_scope_creep') {
    const data = await callApi('/v1/scope/analyze', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const lines = [data.summary || '']
    if (data.violations?.length) {
      lines.push(`\nViolations detected (${data.violations.length}):`)
      for (const v of data.violations) lines.push(`  [${v.severity}] ${v.type}: ${v.description}${v.contract_reference ? ` (${v.contract_reference})` : ''}`)
    }
    if (data.response_options?.length) {
      lines.push('\nDrafted responses:')
      for (const r of data.response_options) lines.push(`\n--- ${r.label}${r.recommended ? ' (RECOMMENDED)' : ''} ---\n${r.draft}`)
    }
    return text(lines.join('\n'))
  }

  if (name === 'generate_change_order') {
    const data = await callApi('/v1/scope/change-order', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    return text(data.document)
  }

  if (name === 'link_contract_payment') {
    const data = await callApi('/v1/contracts/link', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const l = data.link
    return text(`Linked contract ${l.contract_id} to payment ${l.payment_ref} (${l.payment_status}, ${l.payment_currency} ${l.payment_amount || 'N/A'})`)
  }

  if (name === 'lookup_contract_link') {
    const params = args.contract_id ? `contract_id=${args.contract_id}` : `payment_ref=${args.payment_ref}`
    const data = await getApi(`/v1/contracts/link?${params}`, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message || 'Not found'}`)
    const l = data.link
    return text(`Contract: ${l.contract_id}\nPayment Ref: ${l.payment_ref}\nStatus: ${l.payment_status}\nAmount: ${l.payment_currency} ${l.payment_amount || 'N/A'}\nLinked: ${l.linked_at}\nParties: ${(l.parties || []).join(', ') || 'N/A'}`)
  }

  // ── Vigil Fraud Alert tools ───────────────────────────────────────────────
  if (name === 'vigil_authorize') {
    const data = await callApi('/v1/vigil/authorize', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message || 'Authorization failed'}`)
    const d = data.decision || data
    return text(`Decision: ${d.approved ? '✅ APPROVED' : '❌ DECLINED'}\nCard: ${args.card_id} | Amount: ${args.currency?.toUpperCase()} ${(args.amount_cents/100).toFixed(2)}\nMerchant: ${args.merchant_name}, ${args.merchant_country}\nRisk score: ${d.risk_score ?? 'N/A'}/100 | Distance: ${d.distance_km != null ? d.distance_km + ' km from home' : 'N/A'}\n${d.alert_id ? `⚠️ Alert created: ${d.alert_id}` : ''}`)
  }

  if (name === 'vigil_analyze_transaction') {
    const data = await callApi('/v1/vigil/analyze', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const a = data.analysis || data
    const lines = [`AI Fraud Analysis — txn ${args.transaction_id}`, `Risk: ${a.risk_score ?? '?'}/100 — ${a.recommendation ?? ''}`, '']
    if (a.risk_factors?.length) { lines.push('Risk factors:'); a.risk_factors.forEach(f => lines.push(`  • ${f}`)) }
    if (a.sms_copy) lines.push(`\nSMS alert: "${a.sms_copy}"`)
    return text(lines.join('\n'))
  }

  if (name === 'vigil_get_risk_score') {
    const data = await getApi(`/v1/vigil/score?card_id=${encodeURIComponent(args.card_id)}`, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const r = data.risk_profile || data
    return text(`Risk Profile — ${args.card_id}\nScore: ${r.score ?? '?'}/100 (${r.level ?? 'unknown'})\n${r.explanation ?? ''}`)
  }

  if (name === 'vigil_generate_aml_report') {
    const data = await callApi('/v1/vigil/report', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    return text(data.report || JSON.stringify(data, null, 2))
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
}

// ── Vercel handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, accept')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET — MCP spec: return 405 if SSE not supported (tells clients to use POST only)
  if (req.method === 'GET') {
    return res.status(405).json({ error: 'SSE not supported. Use POST for JSON-RPC.' })
  }

  // DELETE — MCP session termination (stateless, always succeed)
  if (req.method === 'DELETE') return res.status(200).end()

  if (req.method !== 'POST') return res.status(405).end()

  try {
    const apiKey = getApiKey(req)
    const body = await parseBody(req)

    // Handle batch (array) or single message
    const messages = Array.isArray(body) ? body : [body]
    const responses = []

    for (const msg of messages) {
      const response = await handleMessage(msg, apiKey)
      if (response !== null) responses.push(response)
    }

    res.setHeader('Content-Type', 'application/json')
    if (responses.length === 0) return res.status(202).end()
    const payload = Array.isArray(body) ? responses : responses[0]
    return res.status(200).json(payload)
  } catch (e) {
    console.error('[mcp]', e.message)
    return res.status(500).json(err(null, -32603, 'Internal error'))
  }
}
