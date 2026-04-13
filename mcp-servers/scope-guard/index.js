#!/usr/bin/env node
// @ebenova/scope-guard-mcp
// AI-powered contract enforcement — scope violation detection and change order generation.
//
// Claude Desktop config:
//   {
//     "mcpServers": {
//       "scope-guard": {
//         "command": "npx",
//         "args": ["-y", "@ebenova/scope-guard-mcp"],
//         "env": { "EBENOVA_API_KEY": "sk_live_xxx" }
//       }
//     }
//   }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API_BASE = 'https://api.ebenova.dev'

// ── Server factory ─────────────────────────────────────────────────────────────
function createServer(config = {}) {
  const API_KEY = config.EBENOVA_API_KEY || process.env.EBENOVA_API_KEY || ''

  if (!API_KEY) {
    process.stderr.write('[scope-guard-mcp] WARNING: EBENOVA_API_KEY not set.\n')
    process.stderr.write('[scope-guard-mcp] Get a free API key at https://ebenova.dev/docs\n')
  }

  function noKeyError() {
    return {
      content: [{
        type: 'text',
        text: 'EBENOVA_API_KEY is not configured.\n\nGet a free API key at https://ebenova.dev/docs and add it to your MCP client configuration:\n\n```json\n{\n  "env": { "EBENOVA_API_KEY": "sk_live_your_key" }\n}\n```',
      }],
      isError: true,
    }
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  const server = new McpServer({ name: 'scope-guard', version: '1.0.0' })

  // ── Tool: analyze_scope_violation ────────────────────────────────────────────
  server.tool(
    'analyze_scope_violation',
    {
      description: `Analyze a client message against your contract to detect scope violations.
Returns violation details, severity, and 3 professional response drafts.

When to use:
- "My client is asking for extra work that wasn't in the contract"
- "Is this client message scope creep?"
- "Help me respond to this client request professionally"
- "Analyze this against my signed agreement"`,
      inputSchema: z.object({
        contract_text: z.string().min(50).describe('Your full contract text (minimum 50 characters)'),
        client_message: z.string().describe('The client message to analyze for scope violations'),
        communication_channel: z.enum(['email', 'whatsapp', 'slack', 'sms', 'other']).optional().default('email').describe('Channel where the message was received'),
      }),
    },
    async ({ contract_text, client_message, communication_channel }) => {
      if (!API_KEY) return noKeyError()

      const data = await apiPost('/v1/scope/analyze', { contract_text, client_message, communication_channel })

      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Analysis failed'}${data.error?.hint ? `\nHint: ${data.error.hint}` : ''}` }],
          isError: true,
        }
      }

      const lines = ['## Scope Guard Analysis\n']

      if (data.violation_detected) {
        lines.push(`⚠️ **${data.violations?.length || 0} violation(s) detected**\n`)
        for (const v of data.violations || []) {
          lines.push(`**${v.type}** (${v.severity}): ${v.description}`)
          if (v.contract_reference) lines.push(`  📄 ${v.contract_reference}`)
        }
        lines.push('')
      } else {
        lines.push('✅ **No scope violations detected**\n')
      }

      if (data.summary) lines.push(`**Summary:** ${data.summary}\n`)

      if (data.response_options?.length > 0) {
        lines.push('### Response Options:\n')
        for (const [i, opt] of data.response_options.entries()) {
          lines.push(`**${i + 1}. ${opt.label}**${opt.recommended ? ' ⭐ Recommended' : ''}\n`)
          lines.push(opt.draft)
          lines.push('\n---\n')
        }
      }

      if (data.suggested_change_order?.applicable) {
        const co = data.suggested_change_order
        lines.push('### 💼 Change Order Suggested\n')
        lines.push(co.additional_work_description)
        if (co.suggested_cost_usd) lines.push(`Estimated cost: $${co.suggested_cost_usd.toLocaleString()} USD`)
        if (co.timeline_extension_days) lines.push(`Timeline extension: +${co.timeline_extension_days} days`)
        lines.push('\nUse `generate_change_order` to create the formal document.')
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ── Tool: generate_change_order ──────────────────────────────────────────────
  server.tool(
    'generate_change_order',
    {
      description: `Generate a formal change order document for additional work requested by a client.
Use after detecting scope creep to create legally binding paperwork for the extra work.

When to use:
- "Create a change order for this extra work"
- "Client agreed to pay more — make it official"
- "Generate a formal change order document"`,
      inputSchema: z.object({
        additional_work: z.string().describe('Description of the additional work requested'),
        additional_cost: z.number().describe('Additional cost in the specified currency'),
        freelancer_name: z.string().optional().describe('Your name or company name'),
        client_name: z.string().optional().describe('Client name'),
        currency: z.string().optional().default('USD').describe('Currency code (e.g. USD, NGN, GBP, EUR)'),
        timeline_extension_days: z.number().int().optional().describe('Additional days needed for the work'),
        jurisdiction: z.string().optional().default('International').describe('Governing law jurisdiction'),
      }),
    },
    async ({ additional_work, additional_cost, freelancer_name, client_name, currency, timeline_extension_days, jurisdiction }) => {
      if (!API_KEY) return noKeyError()

      const data = await apiPost('/v1/scope/change-order', {
        additional_work, additional_cost, freelancer_name, client_name,
        currency, timeline_extension_days, jurisdiction,
      })

      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Change order generation failed'}${data.error?.hint ? `\nHint: ${data.error.hint}` : ''}` }],
          isError: true,
        }
      }

      const co = data.change_order_details || {}
      const lines = [
        '## Change Order Generated\n',
        co.freelancer_name ? `- **Provider:** ${co.freelancer_name}` : '',
        co.client_name ? `- **Client:** ${co.client_name}` : '',
        `- **Additional Work:** ${co.additional_work}`,
        `- **Cost:** ${co.currency} ${Number(co.additional_cost).toLocaleString()}`,
        co.timeline_extension_days ? `- **Timeline Extension:** +${co.timeline_extension_days} days` : '',
        `- **Jurisdiction:** ${co.jurisdiction}`,
        co.generated_at ? `- **Generated:** ${co.generated_at}` : '',
        '',
        '---',
        '',
        data.document,
      ].filter(l => l !== '')

      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  return server
}

// ── Smithery sandbox export ────────────────────────────────────────────────────
export function createSandboxServer() {
  return createServer({ EBENOVA_API_KEY: 'sandbox-key' })
}

export default function createServerFromConfig(config = {}) {
  return createServer(config)
}

// ── CLI entrypoint ─────────────────────────────────────────────────────────────
async function main() {
  const server = createServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  process.stderr.write(`[scope-guard-mcp] Fatal: ${err.message}\n`)
  process.exit(1)
})
