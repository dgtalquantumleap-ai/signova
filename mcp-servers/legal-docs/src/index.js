#!/usr/bin/env node
// @ebenova/legal-docs-mcp
// MCP server exposing the Ebenova Legal Document API as tools for AI agents.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { randomUUID } from 'node:crypto'
import http from 'node:http'
import { z } from 'zod'

// ─── Server factory ───────────────────────────────────────────────────────────
// Smithery requires a createSandboxServer export for tool scanning.
// The same factory is used for real connections too.

// Module-level singleton to prevent double-initialization when MCP clients
// import createSandboxServer AND run main() in the same process.
let _serverInstance = null

function createServer(config = {}) {
  if (_serverInstance && !config.EBENOVA_API_KEY) return _serverInstance

  const API_BASE = config.EBENOVA_API_BASE || process.env.EBENOVA_API_BASE || 'https://api.ebenova.dev'
  const API_KEY  = config.EBENOVA_API_KEY  || process.env.EBENOVA_API_KEY  || ''

  // Sandbox/test mode - Smithery uses this for tool scanning
  const isSandbox = API_KEY === 'sk_test_sandbox' || API_KEY === 'sandbox-test-key'

  if (!API_KEY && !isSandbox) {
    process.stderr.write('[ebenova-legal-docs-mcp] WARNING: EBENOVA_API_KEY is not set.\n')
    process.stderr.write('[ebenova-legal-docs-mcp] Get a free key at https://ebenova.dev/dashboard\n')
  }

  function apiHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` }
  }

  async function callApi(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers: apiHeaders(), body: JSON.stringify(body),
    })
    return res.json()
  }

  async function getApi(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'GET', headers: apiHeaders() })
    return res.json()
  }

  // BUG FIX: Always create a fresh McpServer instance to prevent duplicate tool registration
  // when the module is loaded multiple times (e.g., Smithery scanner + main() execution)
  const server = new McpServer({ name: 'ebenova-legal-docs', version: '1.0.0' })

  // ─── Tool: generate_legal_document ─────────────────────────────────────────

  server.tool(
    'generate_legal_document',
    {
      description: `Generate a professionally drafted legal document using the Ebenova API.

Use this tool when the user needs to create any legal document — contracts, NDAs, agreements,
privacy policies, tenancy agreements, and more. Supports 27 document types across 18 jurisdictions.

When to use:
- "Create an NDA between me and John Smith"
- "Draft a freelance contract for my client"
- "Generate a tenancy agreement for my Lagos property"
- "Write a privacy policy for my app"
- "I need a service agreement for my consulting work"`,
      inputSchema: z.object({
        document_type: z.enum([
          'nda', 'freelance-contract', 'service-agreement', 'consulting-agreement',
          'independent-contractor', 'business-partnership', 'joint-venture',
          'distribution-agreement', 'supply-agreement', 'business-proposal', 'purchase-agreement',
          'employment-offer-letter', 'non-compete-agreement', 'loan-agreement',
          'payment-terms-agreement', 'shareholder-agreement', 'hire-purchase',
          'tenancy-agreement', 'quit-notice', 'deed-of-assignment', 'power-of-attorney',
          'landlord-agent-agreement', 'facility-manager-agreement',
          'privacy-policy', 'terms-of-service', 'mou', 'letter-of-intent',
        ]).describe('The type of legal document to generate'),
        fields: z.record(z.union([z.string(), z.array(z.string())])).describe(
          'Document-specific fields as key-value pairs. Include all relevant parties, terms, dates, and conditions.'
        ),
        jurisdiction: z.string().optional().describe(
          'Governing law / jurisdiction, e.g. "Nigeria", "United States — California", "United Kingdom"'
        ),
      }),
    },
    async ({ document_type, fields, jurisdiction }) => {
      const data = await callApi('/v1/documents/generate', { document_type, fields, jurisdiction })
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Generation failed'}${data.error?.hint ? `\nHint: ${data.error.hint}` : ''}` }],
          isError: true,
        }
      }
      return {
        content: [{
          type: 'text',
          text: data.document + (data.usage
            ? `\n\n---\n*${data.usage.documents_used} / ${data.usage.monthly_limit} documents used this month — ${data.usage.documents_remaining} remaining*`
            : ''),
        }],
      }
    }
  )

  // ─── Tool: extract_from_conversation ───────────────────────────────────────

  server.tool(
    'extract_from_conversation',
    {
      description: `Extract structured legal document fields from a raw conversation (WhatsApp, email, chat).

Use this tool when the user pastes a conversation and wants to identify what legal document
should be created and what fields can be auto-populated from that conversation.

When to use:
- "Here's our WhatsApp chat, can you create a tenancy agreement from it?"
- "Extract the key terms from this email thread"
- "Turn this conversation into a contract"`,
      inputSchema: z.object({
        conversation: z.string().describe('The raw conversation text — WhatsApp, email, or any chat format. Max 10,000 characters.'),
        target_document: z.string().optional().describe('The document type to extract fields for. If omitted, the AI will suggest the best type.'),
        auto_generate: z.boolean().optional().default(false).describe('If true, generate the full document after extraction (counts as 1 document against your quota).'),
      }),
    },
    async ({ conversation, target_document, auto_generate }) => {
      const data = await callApi('/v1/extract/conversation', { conversation, target_document, auto_generate })
      if (!data.success) {
        return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Extraction failed'}` }], isError: true }
      }
      if (auto_generate && data.document) {
        return {
          content: [{
            type: 'text',
            text: [
              `**Extracted fields (${Object.keys(data.extracted_fields || {}).length} found):**`,
              JSON.stringify(data.extracted_fields, null, 2),
              data.missing_fields?.length > 0 ? `**Missing fields:** ${data.missing_fields.join(', ')}` : '',
              '', '---', '**Generated Document:**', '', data.document,
              data.usage ? `\n---\n*${data.usage.documents_used} / ${data.usage.monthly_limit} documents used this month*` : '',
            ].filter(Boolean).join('\n'),
          }],
        }
      }
      return {
        content: [{
          type: 'text',
          text: [
            `**Suggested document type:** ${data.suggested_document || 'Unknown'}${data.confidence ? ` (${Math.round(data.confidence * 100)}% confidence)` : ''}`,
            '', `**Extracted fields (${Object.keys(data.extracted_fields || {}).length} found):**`,
            JSON.stringify(data.extracted_fields, null, 2),
            data.missing_fields?.length > 0 ? `\n**Missing fields:** ${data.missing_fields.join(', ')}` : '',
            '', 'Call `generate_legal_document` with these fields to create the document.',
          ].filter(Boolean).join('\n'),
        }],
      }
    }
  )

  // ─── Tool: list_document_types ─────────────────────────────────────────────

  server.tool(
    'list_document_types',
    {
      description: 'List all supported legal document types available through the Ebenova API. Use this to help the user choose the right document type.',
      inputSchema: z.object({}),
    },
    async () => {
      const data = await getApi('/v1/documents/types')
      if (!data.success) return { content: [{ type: 'text', text: 'Error fetching document types.' }], isError: true }
      const lines = [`**${data.total} document types available:**`, '']
      for (const [category, docs] of Object.entries(data.grouped || {})) {
        const catLabel = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        lines.push(`**${catLabel}:**`)
        for (const doc of docs) lines.push(`  - \`${doc.type}\` — ${doc.label}`)
        lines.push('')
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ─── Tool: generate_invoice ─────────────────────────────────────────────────

  server.tool(
    'generate_invoice',
    {
      description: `Generate a professional invoice, receipt, proforma invoice, or credit note.

Use this tool when the user needs to create any billing document — invoices, receipts,
proforma invoices, or credit notes. Returns fully rendered HTML ready to display or print-to-PDF.

Supports 12 currencies: USD, EUR, GBP, CAD, AUD, NGN, KES, GHS, ZAR, INR, AED, SGD.

When to use:
- "Create an invoice for my client for $500"
- "Generate a receipt for a payment"
- "Make a proforma invoice for a quote"
- "Create a credit note for a refund"`,
      inputSchema: z.object({
        type: z.enum(['invoice', 'receipt', 'proforma', 'credit-note']).optional().default('invoice').describe('Type of billing document'),
        from: z.object({
          name: z.string().describe('Your company/business name'),
          address: z.string().optional().describe('Your address'),
          email: z.string().optional().describe('Your email'),
          phone: z.string().optional().describe('Your phone'),
          tax_id: z.string().optional().describe('Your tax ID'),
        }).describe('Sender/seller details'),
        to: z.object({
          name: z.string().describe('Client/customer name'),
          address: z.string().optional().describe('Client address'),
          email: z.string().optional().describe('Client email'),
          phone: z.string().optional().describe('Client phone'),
          tax_id: z.string().optional().describe('Client tax ID'),
        }).describe('Recipient/buyer details'),
        items: z.array(z.object({
          description: z.string().describe('Item description'),
          quantity: z.number().describe('Quantity'),
          unit_price: z.number().describe('Unit price'),
          notes: z.string().optional().describe('Optional item notes'),
        })).describe('Line items'),
        invoice_number: z.string().optional().describe('Invoice/receipt number (e.g., INV-2026-001)'),
        issue_date: z.string().optional().describe('Issue date (e.g., "April 1, 2026")'),
        due_date: z.string().optional().describe('Due date (e.g., "April 30, 2026")'),
        currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR', 'INR', 'AED', 'SGD']).optional().default('USD'),
        tax_rate: z.number().optional().default(0).describe('Tax percentage (e.g., 10 for 10%)'),
        discount_percent: z.number().optional().default(0).describe('Discount percentage'),
        notes: z.string().optional().describe('Notes shown on the invoice'),
        payment_instructions: z.string().optional().describe('Bank details or payment instructions'),
        logo_url: z.string().optional().describe('Public URL of your logo image'),
      }),
    },
    async ({ type, from, to, items, invoice_number, issue_date, due_date, currency, tax_rate, discount_percent, notes, payment_instructions, logo_url }) => {
      const data = await callApi('/v1/invoices/generate', {
        type, from, to, items, invoice_number, issue_date, due_date,
        currency, tax_rate, discount_percent, notes, payment_instructions, logo_url,
      })
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Invoice generation failed'}` }],
          isError: true,
        }
      }
      const summary = [
        `**${(type || 'invoice').toUpperCase()} Generated**`,
        `Invoice ID: ${data.invoice_id}`,
        data.invoice_number ? `Number: ${data.invoice_number}` : '',
        `Currency: ${data.currency}`,
        `Subtotal: ${data.subtotal?.toFixed(2)}`,
        data.discount_amount > 0 ? `Discount: -${data.discount_amount.toFixed(2)}` : '',
        data.tax_amount > 0 ? `Tax: ${data.tax_amount.toFixed(2)}` : '',
        `**Total: ${data.currency} ${data.total?.toFixed(2)}**`,
        '',
        data.usage ? `*${data.usage.documents_used} / ${data.usage.monthly_limit} documents used this month*` : '',
      ].filter(Boolean).join('\n')
      return { content: [{ type: 'text', text: summary }] }
    }
  )

  // ─── Tool: analyze_scope_creep ────────────────────────────────────────────

  server.tool(
    'analyze_scope_creep',
    {
      description: `Analyze a client message against your contract to detect scope violations and get professional response drafts.

Use this tool when the user receives a message from a client that might be asking for more than what was agreed.

When to use:
- "My client just sent this message — is it scope creep?"
- "Analyze this client request against my contract"
- "Help me respond to this client asking for extra work"
- "Draft a change order for this request"`,
      inputSchema: z.object({
        contract_text: z.string().describe('Your full contract text (paste the signed agreement)'),
        client_message: z.string().describe('The client message to analyze'),
        communication_channel: z.enum(['email', 'whatsapp', 'slack', 'sms', 'other']).optional().default('email'),
      }),
    },
    async ({ contract_text, client_message, communication_channel }) => {
      const data = await callApi('/v1/scope/analyze', { contract_text, client_message, communication_channel })
      if (!data.success) {
        return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Analysis failed'}${data.error?.hint ? `\nHint: ${data.error.hint}` : ''}` }], isError: true }
      }
      const lines = []
      if (data.violation_detected) {
        lines.push(`⚠️ **${data.violations?.length} violation(s) detected**`)
        lines.push(`${data.summary}`, '')
        for (const v of data.violations || []) {
          lines.push(`**${v.type}** (${v.severity}): ${v.description}`)
          if (v.contract_reference) lines.push(`  📄 ${v.contract_reference}`)
        }
        lines.push('')
        lines.push('**Response options:**')
        for (const [i, opt] of (data.response_options || []).entries()) {
          lines.push(`\n**Option ${i + 1} — ${opt.label}${opt.recommended ? ' ✓ Recommended' : ''}:**`)
          lines.push(opt.draft)
        }
        if (data.suggested_change_order?.applicable) {
          const co = data.suggested_change_order
          lines.push(`\n**Suggested change order:** ${co.additional_work_description}`)
          if (co.suggested_cost_usd) lines.push(`Est. cost: $${co.suggested_cost_usd.toLocaleString()} USD`)
          if (co.timeline_extension_days) lines.push(`Timeline: +${co.timeline_extension_days} days`)
        }
      } else {
        lines.push(`✅ **No violations detected**`)
        lines.push(data.summary || 'The client message appears to be within the original scope.')
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ─── Tool: generate_change_order ──────────────────────────────────────────

  server.tool(
    'generate_change_order',
    {
      description: `Generate a formal change order when scope changes are detected.

Use this after analyzing scope creep with analyze_scope_creep.

Typically drafted automatically after scope violations are confirmed by the client.

When to use:
- "Generate a change order for the additional work we discussed"
- "Create a formal change order for this scope addition"
- "Draft a change order adding 20 hours of UX design work for $3000"

**Requires Pro tier or higher** (Growth/Scale/Enterprise plan)`,
      inputSchema: z.object({
        freelancer_name: z.string().describe('Your name or business name'),
        client_name: z.string().describe('Client name or business name'),
        original_scope: z.string().describe('Summary of original contract scope'),
        additional_work: z.string().describe('Description of additional work requested'),
        additional_cost: z.number().describe('Additional cost (numeric, e.g., 3000 for $3000)'),
        currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR', 'INR', 'AED', 'SGD']).optional().default('USD'),
        timeline_extension_days: z.number().optional().describe('Additional days needed (e.g., 5 for 5 business days)'),
        jurisdiction: z.string().optional().describe('Governing law/jurisdiction (e.g., "Nigeria", "US - California")'),
        contract_date: z.string().optional().describe('Original contract date (e.g., "January 15, 2026")'),
        change_order_number: z.number().optional().default(1).describe('Change order number (1, 2, 3, etc.)'),
      }),
    },
    async ({ freelancer_name, client_name, original_scope, additional_work, additional_cost, currency, timeline_extension_days, jurisdiction, contract_date, change_order_number }) => {
      const data = await callApi('/v1/scope/change-order', {
        freelancer_name, client_name, original_scope, additional_work, additional_cost,
        currency, timeline_extension_days, jurisdiction, contract_date, change_order_number,
      })
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Change order generation failed'}${data.error?.hint ? `\nHint: ${data.error.hint}` : ''}` }],
          isError: true,
        }
      }
      return {
        content: [{
          type: 'text',
          text: [
            `**Change Order #${change_order_number} Generated**`,
            `From: ${freelancer_name}`,
            `To: ${client_name}`,
            `Additional Work: ${additional_work}`,
            `Cost: ${currency} ${additional_cost.toLocaleString()}`,
            data.timeline_extension_days ? `Timeline Extension: +${data.timeline_extension_days} business days` : '',
            '',
            '---',
            '',
            data.document,
            '',
            data.usage ? `*${data.usage.documents_used} / ${data.usage.monthly_limit} documents used this month*` : '',
          ].filter(Boolean).join('\n'),
        }],
      }
    }
  )

  // ─── Tool: check_usage ─────────────────────────────────────────────────────

  server.tool(
    'check_usage',
    {
      description: 'Check your API quota — how many documents/month you\'ve used and what\'s remaining. Shows monthly history and reset date.',
      inputSchema: z.object({}),
    },
    async () => {
      const data = await getApi('/v1/keys/usage')
      if (!data.success) {
        return { content: [{ type: 'text', text: `Error: ${data.error?.message || 'Could not fetch usage'}` }], isError: true }
      }
      const cm = data.current_month
      const text = [
        `**${data.key?.tier?.toUpperCase() || 'UNKNOWN'} Plan**`,
        `Owner: ${data.key?.owner || 'Unknown'}`,
        '',
        `**This Month:** ${cm.documents_used} / ${cm.monthly_limit} documents used`,
        `**Remaining:** ${cm.documents_remaining} documents`,
        `**Resets:** ${new Date(cm.resets_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      ]
      if (data.history?.length > 0) {
        text.push('', '**3-Month History:**')
        for (const h of data.history) {
          text.push(`  ${h.month}: ${h.documents_generated} documents`)
        }
      }
      return { content: [{ type: 'text', text: text.join('\n') }] }
    }
  )

  if (!config.EBENOVA_API_KEY) _serverInstance = server
  return server
}

// ─── Smithery sandbox export (required for tool scanning) ────────────────────

export function createSandboxServer() {
  return createServer({ EBENOVA_API_KEY: 'sandbox-test-key' })
}

// ─── CLI entrypoint ──────────────────────────────────────────────────────────

async function main() {
  // Apify detection — actor times out waiting for stdin; verify + exit cleanly.
  const isApify = !!(process.env.APIFY_IS_AT_HOME ||
                     process.env.ACTOR_IS_AT_HOME ||
                     process.env.APIFY_ACTOR_RUN_ID ||
                     process.env.ACTOR_RUN_ID ||
                     process.env.APIFY_CONTAINER_URL)

  if (isApify) {
    process.stderr.write('[ebenova-legal-docs-mcp] Apify mode — server initialized\n')
    process.stderr.write('[ebenova-legal-docs-mcp] Tools: generate_legal_document, extract_from_conversation, list_document_types, generate_invoice, analyze_scope_creep, generate_change_order, check_usage\n')
    process.exit(0)
    return
  }

  const port = process.env.PORT

  if (port) {
    // ── HTTP / Streamable-HTTP mode (MCPize, Railway, Render, etc.) ──────────
    // MCPize deploys behind an HTTP-to-MCP bridge and sets PORT.
    // Each incoming request gets its own stateless transport instance.
    const httpServer = http.createServer(async (req, res) => {
      // Health check endpoints
      if (req.method === 'GET' && (req.url === '/ping' || req.url === '/health')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', server: 'ebenova-legal-docs-mcp', version: '1.5.1' }))
        return
      }

      // GET on root or /mcp — return server info for discovery
      if (req.method === 'GET' && (req.url === '/' || req.url === '/mcp' || req.url === '/sse')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          name: 'ebenova-legal-docs',
          version: '1.5.1',
          transport: 'streamable-http',
          description: 'Generate 34 legal document types across 18 jurisdictions via AI',
          endpoints: { mcp: '/', health: '/ping' },
        }))
        return
      }

      // POST on root or /mcp — handle MCP JSON-RPC
      if (req.method === 'POST' && (req.url === '/' || req.url === '/mcp')) {
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = Buffer.concat(chunks).toString('utf8')

          let parsedBody
          try { parsedBody = JSON.parse(body) } catch { parsedBody = undefined }

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              process.stderr.write(`[ebenova-legal-docs-mcp] Session: ${id}\n`)
            },
          })

          const server = createServer()
          await server.connect(transport)
          await transport.handleRequest(req, res, parsedBody)
        } catch (err) {
          process.stderr.write(`[ebenova-legal-docs-mcp] Error: ${err.message}\n`)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal server error' }))
          }
        }
        return
      }

      // Method not allowed
      res.writeHead(405, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Method not allowed', allowed: ['GET', 'POST'] }))
    })

    httpServer.listen(parseInt(port, 10), () => {
      process.stderr.write(`[ebenova-legal-docs-mcp] HTTP server listening on port ${port}\n`)
      process.stderr.write('[ebenova-legal-docs-mcp] Tools ready: generate_legal_document, extract_from_conversation, list_document_types, generate_invoice, analyze_scope_creep, generate_change_order, check_usage\n')
    })
  } else {
    // ── Stdio mode (Claude Desktop, Cursor, Smithery, npx) ──────────────────
    const server = createServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
  }
}

main().catch(err => {
  console.error('[ebenova-legal-docs-mcp] Fatal error:', err)
  process.exit(1)
})
