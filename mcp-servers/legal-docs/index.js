#!/usr/bin/env node
// @ebenova/legal-docs-mcp
// MCP server exposing the Ebenova Legal Document API as tools for AI agents.
//
// Installation (Claude Desktop — add to claude_desktop_config.json):
// {
//   "mcpServers": {
//     "ebenova-legal": {
//       "command": "npx",
//       "args": ["-y", "@ebenova/legal-docs-mcp"],
//       "env": { "EBENOVA_API_KEY": "sk_live_your_key" }
//     }
//   }
// }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const LEGAL_DISCLAIMER = '⚠️ **Legal Disclaimer:** These documents are AI-generated templates for informational purposes only and do not constitute legal advice. While we strive for accuracy, we make no guarantees regarding completeness or suitability for your situation. Laws vary by jurisdiction and change frequently. You should consult with a qualified attorney licensed in your jurisdiction before using, executing, or relying on any document. Use at your own risk.'

const API_BASE = process.env.EBENOVA_API_BASE || 'https://api.ebenova.dev'
let API_KEY = process.env.EBENOVA_API_KEY || ''

if (!API_KEY) {
  process.stderr.write('[ebenova-legal-docs-mcp] WARNING: EBENOVA_API_KEY is not set. Requests will fail.\n')
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  }
}

async function callApi(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body),
  })
  return res.json()
}

async function getApi(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: apiHeaders(),
  })
  return res.json()
}

// ─── Server setup ────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'ebenova-legal-docs',
  version: '1.0.0',
})

// ─── Tool: generate_legal_document ───────────────────────────────────────────

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
        content: [{
          type: 'text',
          text: `Error: ${data.error?.message || 'Generation failed'}${data.error?.hint ? `\nHint: ${data.error.hint}` : ''}`,
        }],
        isError: true,
      }
    }

    return {
      content: [{
        type: 'text',
        text: data.document + (data.usage
          ? `\n\n---\n*${data.usage.documents_used} / ${data.usage.monthly_limit} documents used this month — ${data.usage.documents_remaining} remaining*`
          : '') + '\n\n' + LEGAL_DISCLAIMER,
      }],
    }
  }
)

// ─── Tool: extract_from_conversation ─────────────────────────────────────────

server.tool(
  'extract_from_conversation',
  {
    description: `Extract structured legal document fields from a raw conversation (WhatsApp, email, chat).

Use this tool when the user pastes a conversation and wants to identify what legal document 
should be created and what fields can be auto-populated from that conversation.

Optionally set auto_generate: true to generate the full document in one step.

When to use:
- "Here's our WhatsApp chat, can you create a tenancy agreement from it?"
- "Extract the key terms from this email thread"
- "Turn this conversation into a contract"`,
    inputSchema: z.object({
      conversation: z.string().describe(
        'The raw conversation text — WhatsApp, email, or any chat format. Max 10,000 characters.'
      ),
      target_document: z.string().optional().describe(
        'The document type to extract fields for. If omitted, the AI will suggest the best type.'
      ),
      auto_generate: z.boolean().optional().default(false).describe(
        'If true, generate the full document after extraction (counts as 1 document against your quota).'
      ),
    }),
  },
  async ({ conversation, target_document, auto_generate }) => {
    const data = await callApi('/v1/extract/conversation', { conversation, target_document, auto_generate })

    if (!data.success) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${data.error?.message || 'Extraction failed'}`,
        }],
        isError: true,
      }
    }

    if (auto_generate && data.document) {
      return {
        content: [{
          type: 'text',
          text: [
            `**Extracted fields (${Object.keys(data.extracted_fields || {}).length} found):**`,
            JSON.stringify(data.extracted_fields, null, 2),
            data.missing_fields?.length > 0 ? `**Missing fields:** ${data.missing_fields.join(', ')}` : '',
            '',
            '---',
            '**Generated Document:**',
            '',
            data.document,
            data.usage ? `\n---\n*${data.usage.documents_used} / ${data.usage.monthly_limit} documents used this month*` : '',
            '\n' + LEGAL_DISCLAIMER,
          ].filter(Boolean).join('\n'),
        }],
      }
    }

    return {
      content: [{
        type: 'text',
        text: [
          `**Suggested document type:** ${data.suggested_document || 'Unknown'}${data.confidence ? ` (${Math.round(data.confidence * 100)}% confidence)` : ''}`,
          '',
          `**Extracted fields (${Object.keys(data.extracted_fields || {}).length} found):**`,
          JSON.stringify(data.extracted_fields, null, 2),
          data.missing_fields?.length > 0 ? `\n**Missing fields:** ${data.missing_fields.join(', ')}` : '',
          '',
          'Call `generate_legal_document` with these fields to create the document.',
          '\n' + LEGAL_DISCLAIMER,
        ].filter(Boolean).join('\n'),
      }],
    }
  }
)

// ─── Tool: list_document_types ────────────────────────────────────────────────

server.tool(
  'list_document_types',
  {
    description: 'List all supported legal document types available through the Ebenova API. Use this to help the user choose the right document type.',
    inputSchema: z.object({}),
  },
  async () => {
    const data = await getApi('/v1/documents/types')

    if (!data.success) {
      return { content: [{ type: 'text', text: 'Error fetching document types.' }], isError: true }
    }

    const lines = [`**${data.total} document types available:**`, '']

    for (const [category, docs] of Object.entries(data.grouped || {})) {
      const catLabel = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      lines.push(`**${catLabel}:**`)
      for (const doc of docs) {
        lines.push(`  - \`${doc.type}\` — ${doc.label}`)
      }
      lines.push('')
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  }
)

// ─── Tool: check_usage ───────────────────────────────────────────────────────

server.tool(
  'check_usage',
  {
    description: 'Check how many documents have been generated this month and what is remaining in your quota.',
    inputSchema: z.object({}),
  },
  async () => {
    const data = await getApi('/v1/keys/usage')

    if (!data.success) {
      return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    }

    const cm = data.current_month
    const text = [
      `**API Key:** ${data.key?.owner || 'Unknown'} (${data.key?.tier || '?'} plan)`,
      `**This month:** ${cm.documents_used} / ${cm.monthly_limit} documents used (${cm.documents_remaining} remaining)`,
      `**Resets:** ${new Date(cm.resets_at).toLocaleDateString('en-GB', { month: 'long', day: 'numeric', year: 'numeric' })}`,
    ]

    if (data.history?.length > 0) {
      text.push('', '**Monthly history:**')
      for (const h of data.history) {
        text.push(`  - ${h.month}: ${h.documents_generated} documents`)
      }
    }

    return { content: [{ type: 'text', text: text.join('\n') }] }
  }
)

// ─── Start ───────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
