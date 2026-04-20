// api/mcp.js — MCP Streamable HTTP endpoint for Smithery/MCPize/Claude.ai
// Pure JSON-RPC implementation, no SDK dependency (avoids Zod version conflicts)
// Spec: https://modelcontextprotocol.io/specification/2024-11-05/transports

const TOOLS = [
  {
    name: 'generate_legal_document',
    description: 'Generate a professionally drafted legal document. 34 document types, 18 jurisdictions including Nigeria, UK, US, Canada, Ghana, Kenya, UAE and more.',
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
    description: 'List all 34 supported legal document types grouped by category.',
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
    description: 'Run a card transaction through the Vigil proximity fraud engine. Returns approve/decline with reason code, distance from device GPS, and processing time. Requires Starter+ plan.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier (e.g. card_01)' },
        merchant_name: { type: 'string', description: 'Merchant name' },
        merchant_country: { type: 'string', description: '2-letter ISO country code, e.g. CA, US, GB' },
        merchant_lat: { type: 'number', description: 'Merchant latitude (optional — uses card home if omitted)' },
        merchant_lng: { type: 'number', description: 'Merchant longitude (optional)' },
        amount_cents: { type: 'number', description: 'Transaction amount in cents' },
        currency: { type: 'string', description: 'ISO currency code, e.g. CAD, USD' },
        mcc: { type: 'string', description: 'Merchant category code (optional)' },
      },
      required: ['card_id', 'merchant_name', 'merchant_country', 'amount_cents', 'currency'],
    },
  },
  {
    name: 'vigil_register_card',
    description: 'Register a card for Vigil proximity monitoring. Set home location, radius, and mode.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Unique card identifier' },
        home_lat: { type: 'number', description: 'Home latitude' },
        home_lng: { type: 'number', description: 'Home longitude' },
        home_country: { type: 'string', description: 'Home country code' },
        radius_km: { type: 'number', description: 'Proximity radius in km (default 25)' },
        mode: { type: 'string', description: 'Card mode: normal, travel, or lockdown' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'vigil_update_card',
    description: 'Update card settings — change mode (normal/travel/lockdown), radius, or add travel plans.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
        mode: { type: 'string', description: 'Card mode: normal, travel, or lockdown' },
        radius_km: { type: 'number', description: 'New proximity radius in km' },
        is_active: { type: 'boolean', description: 'Enable/disable the card' },
        travel_plans: {
          type: 'array',
          description: 'Travel plans array',
          items: {
            type: 'object',
            properties: {
              destination_country: { type: 'string' },
              start_date: { type: 'string' },
              end_date: { type: 'string' },
              is_active: { type: 'boolean' },
            },
          },
        },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'vigil_submit_gps',
    description: 'Submit GPS location from a device for a card. Powers proximity-based authorization. GPS expires after 1 hour.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
        lat: { type: 'number', description: 'Device latitude' },
        lng: { type: 'number', description: 'Device longitude' },
        accuracy_meters: { type: 'number', description: 'GPS accuracy in meters' },
        is_mock_location: { type: 'boolean', description: 'Whether location is spoofed' },
        is_jailbroken: { type: 'boolean', description: 'Whether device is jailbroken/rooted' },
      },
      required: ['card_id', 'lat', 'lng'],
    },
  },
  {
    name: 'vigil_get_risk_score',
    description: 'Get the live risk score (0–1.0) for a card with breakdown of contributing factors. Requires Starter+ plan.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'vigil_analyze_transaction',
    description: 'AI-powered fraud pattern analysis using Claude Haiku. Returns risk level, fraud indicators, and recommended actions. Requires Growth+ plan.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
        merchant_name: { type: 'string', description: 'Merchant name' },
        merchant_country: { type: 'string', description: 'Merchant country code' },
        amount_cents: { type: 'number', description: 'Transaction amount in cents' },
        currency: { type: 'string', description: 'Currency code' },
        mcc: { type: 'string', description: 'Merchant category code' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'vigil_generate_aml_report',
    description: 'Generate a full AML compliance report for a card using Claude Sonnet. Includes risk assessment, transaction analysis, and compliance status. Requires Scale+ plan.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card identifier' },
        period: { type: 'string', description: 'Report period e.g. "last 30 days" or "2026-Q1"' },
        report_type: { type: 'string', description: 'Report type: standard, detailed, or regulatory' },
      },
      required: ['card_id'],
    },
  },
  {
    name: 'vigil_emergency_lockdown',
    description: 'Immediately lock down a card — blocks all transactions until manually unlocked. Use for suspected fraud.',
    inputSchema: {
      type: 'object',
      properties: {
        card_id: { type: 'string', description: 'Card to lock down' },
        reason: { type: 'string', description: 'Reason for lockdown' },
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

async function callApi(path, body, key, method = 'POST') {
  const r = await fetch(`${API_BASE}${path}`, {
    method,
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
    const a = data.authorization || data
    return text(`Decision: ${a.approved ? 'APPROVED' : 'DECLINED'}\nReason: ${a.reason_code}\nCard: ${args.card_id} (mode: ${a.card_mode || 'normal'})\nAmount: ${args.currency?.toUpperCase()} ${(args.amount_cents/100).toFixed(2)}\nMerchant: ${args.merchant_name}, ${args.merchant_country}\nDistance: ${a.distance_km != null ? a.distance_km.toFixed(1) + ' km' : 'N/A'}\nProcessing: ${a.processing_ms ?? '?'}ms`)
  }

  if (name === 'vigil_register_card') {
    const data = await callApi('/v1/vigil/card', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message || 'Registration failed'}`)
    const c = data.card
    return text(`Card registered: ${c.card_id}\nMode: ${c.mode} | Radius: ${c.radius_km}km | Active: ${c.is_active}\nHome: ${c.home_lat || 'not set'}, ${c.home_lng || 'not set'}`)
  }

  if (name === 'vigil_update_card') {
    const data = await callApi('/v1/vigil/card', args, apiKey, 'PUT')
    if (!data.success) return text(`Error: ${data.error?.message || 'Update failed'}`)
    const c = data.card
    return text(`Card updated: ${c.card_id}\nMode: ${c.mode} | Radius: ${c.radius_km}km | Active: ${c.is_active}`)
  }

  if (name === 'vigil_submit_gps') {
    const data = await callApi('/v1/vigil/gps', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message || 'GPS submission failed'}`)
    const g = data.gps
    return text(`GPS updated for ${g.card_id}\nLocation: ${g.lat}, ${g.lng} (accuracy: ${g.accuracy_meters}m)\nRecorded: ${g.recorded_at}\nExpires in: ${g.expires_in_seconds}s`)
  }

  if (name === 'vigil_get_risk_score') {
    const data = await getApi(`/v1/vigil/score?card_id=${encodeURIComponent(args.card_id)}`, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const r = data.risk || data
    return text(`Risk Profile for ${args.card_id}\nScore: ${r.score ?? '?'} (${r.level ?? 'unknown'})\nCard mode: ${r.card_mode || 'unknown'} | Active: ${r.is_active}\nStats: ${r.stats?.total_authorizations || 0} total auths, ${r.stats?.blocked_authorizations || 0} blocked (${r.stats?.block_rate || 0}%)`)
  }

  if (name === 'vigil_analyze_transaction') {
    const data = await callApi('/v1/vigil/analyze', { transaction: args }, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const a = data.analysis || data
    const lines = [`AI Fraud Analysis for ${args.card_id}`, `Risk: ${a.risk_score ?? '?'} (${a.risk_level || 'unknown'}) | Recommendation: ${a.recommendation ?? ''}`, '']
    if (a.fraud_indicators?.length) { lines.push('Fraud indicators:'); a.fraud_indicators.forEach(f => lines.push(`  [${f.severity}] ${f.type}: ${f.description}`)) }
    if (a.explanation) lines.push(`\n${a.explanation}`)
    if (a.suggested_actions?.length) { lines.push('\nSuggested actions:'); a.suggested_actions.forEach(s => lines.push(`  - ${s}`)) }
    return text(lines.join('\n'))
  }

  if (name === 'vigil_generate_aml_report') {
    const data = await callApi('/v1/vigil/report', args, apiKey)
    if (!data.success) return text(`Error: ${data.error?.message}`)
    const r = data.report
    if (typeof r === 'object') {
      const lines = [
        `AML Report: ${r.report_id || 'N/A'}`,
        `Period: ${r.period || 'N/A'}`,
        `Overall Risk: ${r.risk_assessment?.overall_risk || 'N/A'} (score: ${r.risk_assessment?.risk_score || '?'})`,
        '', r.executive_summary || '', '',
        'Recommendations:',
      ]
      if (r.recommendations?.length) r.recommendations.forEach(rec => lines.push(`  [${rec.priority}] ${rec.action}`))
      return text(lines.join('\n'))
    }
    return text(typeof r === 'string' ? r : JSON.stringify(r, null, 2))
  }

  if (name === 'vigil_emergency_lockdown') {
    const data = await callApi('/v1/vigil/card', { card_id: args.card_id, mode: 'lockdown', is_active: false }, apiKey, 'PUT')
    if (!data.success) return text(`Error: ${data.error?.message || 'Lockdown failed'}`)
    return text(`EMERGENCY LOCKDOWN: ${args.card_id}\nCard is now LOCKED. All transactions will be declined.\nReason: ${args.reason || 'Suspected fraud'}\nTo unlock: use vigil_update_card with mode "normal" and is_active true`)
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
