// api/mcp.js
// HTTP MCP endpoint for Smithery and other HTTP MCP clients.
// Implements MCP Streamable HTTP transport (POST /api/mcp)
// Auth: Bearer token = EBENOVA_API_KEY (passed by Smithery via ?EBENOVA_API_KEY= or Authorization header)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

const API_BASE = 'https://www.getsignova.com'

function getApiKey(req) {
  const auth = req.headers['authorization'] || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  const url = new URL(req.url, 'https://www.getsignova.com')
  return url.searchParams.get('EBENOVA_API_KEY') || ''
}

function apiHeaders(key) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }
}

async function callApi(path, body, key) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: apiHeaders(key), body: JSON.stringify(body),
  })
  return res.json()
}

async function getApi(path, key) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'GET', headers: apiHeaders(key) })
  return res.json()
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const apiKey = getApiKey(req)

  const server = new McpServer({ name: 'ebenova-legal-docs', version: '1.0.0' })

  server.tool('generate_legal_document', {
    description: 'Generate a professionally drafted legal document. Supports 27 document types across 18 jurisdictions.',
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
      ]).describe('The type of legal document to generate'),
      fields: z.record(z.union([z.string(), z.array(z.string())])).describe('Document-specific fields'),
      jurisdiction: z.string().optional().describe('Governing jurisdiction'),
    }),
  }, async ({ document_type, fields, jurisdiction }) => {
    const data = await callApi('/v1/documents/generate', { document_type, fields, jurisdiction }, apiKey)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Generation failed'}` }], isError: true }
    return { content: [{ type: 'text', text: data.document }] }
  })

  server.tool('extract_from_conversation', {
    description: 'Extract legal document fields from a raw conversation (WhatsApp, email, chat).',
    inputSchema: z.object({
      conversation: z.string().describe('Raw conversation text. Max 10,000 characters.'),
      target_document: z.string().optional().describe('Target document type. If omitted, AI suggests best type.'),
      auto_generate: z.boolean().optional().default(false).describe('If true, generate the full document after extraction.'),
    }),
  }, async ({ conversation, target_document, auto_generate }) => {
    const data = await callApi('/v1/extract/conversation', { conversation, target_document, auto_generate }, apiKey)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Extraction failed'}` }], isError: true }
    return { content: [{ type: 'text', text: JSON.stringify(data.extracted_fields, null, 2) }] }
  })

  server.tool('list_document_types', {
    description: 'List all 27 supported legal document types grouped by category.',
    inputSchema: z.object({}),
  }, async () => {
    const data = await getApi('/v1/documents/types', apiKey)
    if (!data.success) return { content: [{ type: 'text', text: 'Error fetching document types.' }], isError: true }
    const lines = [`${data.total} document types available:`]
    for (const [cat, docs] of Object.entries(data.grouped || {})) {
      lines.push(`\n${cat}:`)
      for (const doc of docs) lines.push(`  - ${doc.type}: ${doc.label}`)
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  })

  server.tool('check_usage', {
    description: 'Check documents generated this month and remaining quota.',
    inputSchema: z.object({}),
  }, async () => {
    const data = await getApi('/v1/keys/usage', apiKey)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    const cm = data.current_month
    return { content: [{ type: 'text', text: `${cm.documents_used}/${cm.monthly_limit} documents used (${cm.documents_remaining} remaining)` }] }
  })

  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP transport error', message: err.message })
    }
  }
}
