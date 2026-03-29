// api/mcp.js — HTTP MCP endpoint (Streamable HTTP, stateless, no Zod)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

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

function buildServer(apiKey) {
  const server = new McpServer({ name: 'ebenova-legal-docs', version: '1.0.0' })

  server.tool(
    'generate_legal_document',
    'Generate a professionally drafted legal document. 27 document types, 18 jurisdictions.',
    {
      type: 'object',
      properties: {
        document_type: { type: 'string', description: 'Type of document e.g. nda, freelance-contract, tenancy-agreement' },
        fields: { type: 'object', description: 'Document fields as key-value pairs', additionalProperties: true },
        jurisdiction: { type: 'string', description: 'Governing jurisdiction e.g. Nigeria, UK, US' },
      },
      required: ['document_type', 'fields'],
    },
    async ({ document_type, fields, jurisdiction }) => {
      const data = await callApi('/v1/documents/generate', { document_type, fields, jurisdiction }, apiKey)
      if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Failed'}` }], isError: true }
      return { content: [{ type: 'text', text: data.document }] }
    }
  )

  server.tool(
    'extract_from_conversation',
    'Extract legal document fields from a raw conversation (WhatsApp, email, chat).',
    {
      type: 'object',
      properties: {
        conversation: { type: 'string', description: 'Raw conversation text, max 10,000 characters' },
        target_document: { type: 'string', description: 'Target document type (AI suggests if omitted)' },
        auto_generate: { type: 'boolean', description: 'If true, also generate the full document' },
      },
      required: ['conversation'],
    },
    async ({ conversation, target_document, auto_generate }) => {
      const data = await callApi('/v1/extract/conversation', { conversation, target_document, auto_generate }, apiKey)
      if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'list_document_types',
    'List all 27 supported legal document types grouped by category.',
    { type: 'object', properties: {} },
    async () => {
      const data = await getApi('/v1/documents/types', apiKey)
      if (!data.success) return { content: [{ type: 'text', text: 'Error fetching types.' }], isError: true }
      const lines = [`${data.total} document types:`]
      for (const [cat, docs] of Object.entries(data.grouped || {})) {
        lines.push(`\n${cat}:`)
        for (const d of docs) lines.push(`  - ${d.type}: ${d.label}`)
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  server.tool(
    'check_usage',
    'Check monthly document quota and remaining usage.',
    { type: 'object', properties: {} },
    async () => {
      const data = await getApi('/v1/keys/usage', apiKey)
      if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
      const cm = data.current_month
      return { content: [{ type: 'text', text: `${cm.documents_used}/${cm.monthly_limit} used (${cm.documents_remaining} remaining)` }] }
    }
  )

  return server
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const apiKey = getApiKey(req)
    const server = buildServer(apiKey)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)

    let body = req.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = undefined }
    }

    await transport.handleRequest(req, res, body)
  } catch (err) {
    console.error('[mcp] handler error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message, stack: err.stack })
    }
  }
}
