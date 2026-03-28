// api/mcp.js — HTTP MCP endpoint (Streamable HTTP transport)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const API_BASE = 'https://www.getsignova.com'

function getApiKey(req) {
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim()
  if (auth) return auth
  try {
    const u = new URL(req.url, API_BASE)
    return u.searchParams.get('EBENOVA_API_KEY') || ''
  } catch { return '' }
}

function apiHeaders(key) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
}

async function callApi(path, body, key) {
  const r = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: apiHeaders(key), body: JSON.stringify(body) })
  return r.json()
}

async function getApi(path, key) {
  const r = await fetch(`${API_BASE}${path}`, { method: 'GET', headers: apiHeaders(key) })
  return r.json()
}

function buildServer(apiKey) {
  const server = new McpServer({ name: 'ebenova-legal-docs', version: '1.0.0' })

  server.tool('generate_legal_document', {
    description: 'Generate a professionally drafted legal document. 27 document types, 18 jurisdictions.',
    inputSchema: z.object({
      document_type: z.enum([
        'nda','freelance-contract','service-agreement','consulting-agreement',
        'independent-contractor','business-partnership','joint-venture',
        'distribution-agreement','supply-agreement','business-proposal','purchase-agreement',
        'employment-offer-letter','non-compete-agreement','loan-agreement',
        'payment-terms-agreement','shareholder-agreement','hire-purchase',
        'tenancy-agreement','quit-notice','deed-of-assignment','power-of-attorney',
        'landlord-agent-agreement','facility-manager-agreement',
        'privacy-policy','terms-of-service','mou','letter-of-intent',
      ]),
      fields: z.record(z.union([z.string(), z.array(z.string())])),
      jurisdiction: z.string().optional(),
    }),
  }, async ({ document_type, fields, jurisdiction }) => {
    const data = await callApi('/v1/documents/generate', { document_type, fields, jurisdiction }, apiKey)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Failed'}` }], isError: true }
    return { content: [{ type: 'text', text: data.document }] }
  })

  server.tool('extract_from_conversation', {
    description: 'Extract legal document fields from a raw conversation (WhatsApp, email, chat).',
    inputSchema: z.object({
      conversation: z.string(),
      target_document: z.string().optional(),
      auto_generate: z.boolean().optional().default(false),
    }),
  }, async ({ conversation, target_document, auto_generate }) => {
    const data = await callApi('/v1/extract/conversation', { conversation, target_document, auto_generate }, apiKey)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
  })

  server.tool('list_document_types', {
    description: 'List all 27 supported legal document types grouped by category.',
    inputSchema: z.object({}),
  }, async () => {
    const data = await getApi('/v1/documents/types', apiKey)
    if (!data.success) return { content: [{ type: 'text', text: 'Error fetching types.' }], isError: true }
    const lines = [`${data.total} document types:`]
    for (const [cat, docs] of Object.entries(data.grouped || {})) {
      lines.push(`\n${cat}:`)
      for (const d of docs) lines.push(`  - ${d.type}: ${d.label}`)
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  })

  server.tool('check_usage', {
    description: 'Check monthly document quota and usage.',
    inputSchema: z.object({}),
  }, async () => {
    const data = await getApi('/v1/keys/usage', apiKey)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    const cm = data.current_month
    return { content: [{ type: 'text', text: `${cm.documents_used}/${cm.monthly_limit} used (${cm.documents_remaining} remaining)` }] }
  })

  return server
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const apiKey = getApiKey(req)
  const server = buildServer(apiKey)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

  await server.connect(transport)

  // Parse body for Vercel (body may already be parsed or raw)
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = undefined }
  }

  await transport.handleRequest(req, res, body)
}
