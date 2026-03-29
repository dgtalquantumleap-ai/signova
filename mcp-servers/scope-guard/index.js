#!/usr/bin/env node
/**
 * @ebenova/scope-guard-mcp
 * MCP server for Scope Guard — AI-powered contract enforcement
 * 
 * Tools exposed:
 * - analyze_scope_violation: Analyze client messages for scope violations
 * - generate_change_order: Generate formal change order documents
 * 
 * Usage:
 *   npx -y @ebenova/scope-guard-mcp
 * 
 * Or add to claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "scope-guard": {
 *         "command": "npx",
 *         "args": ["-y", "@ebenova/scope-guard-mcp"],
 *         "env": {
 *           "EBENOVA_API_KEY": "sk_live_xxx"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const API_BASE = 'https://api.ebenova.dev'
const API_KEY = process.env.EBENOVA_API_KEY

if (!API_KEY) {
  console.error('EBENOVA_API_KEY environment variable is required')
  process.exit(1)
}

const server = new Server(
  { name: 'scope-guard-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'analyze_scope_violation',
        description: 'Analyze a client message against a contract to detect scope violations. Returns violation details, severity, and 3 professional response drafts.',
        inputSchema: {
          type: 'object',
          properties: {
            contract_text: {
              type: 'string',
              description: 'The full contract text (min 50 characters)',
            },
            client_message: {
              type: 'string',
              description: 'The client message to analyze for scope violations',
            },
            communication_channel: {
              type: 'string',
              description: 'Channel where message was received (email, whatsapp, slack, sms, other)',
              default: 'email',
            },
          },
          required: ['contract_text', 'client_message'],
        },
      },
      {
        name: 'generate_change_order',
        description: 'Generate a formal change order document for additional work requested by the client.',
        inputSchema: {
          type: 'object',
          properties: {
            additional_work: {
              type: 'string',
              description: 'Description of the additional work requested',
            },
            additional_cost: {
              type: 'number',
              description: 'Additional cost in USD (or specified currency)',
            },
            freelancer_name: {
              type: 'string',
              description: 'Freelancer/service provider name',
            },
            client_name: {
              type: 'string',
              description: 'Client name',
            },
            currency: {
              type: 'string',
              description: 'Currency code (default: USD)',
              default: 'USD',
            },
            timeline_extension_days: {
              type: 'integer',
              description: 'Additional days needed for the work',
            },
            jurisdiction: {
              type: 'string',
              description: 'Governing law (default: International)',
              default: 'International',
            },
          },
          required: ['additional_work', 'additional_cost'],
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'analyze_scope_violation') {
    return await handleAnalyze(args)
  } else if (name === 'generate_change_order') {
    return await handleChangeOrder(args)
  } else {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    }
  }
})

async function handleAnalyze(args) {
  const { contract_text, client_message, communication_channel = 'email' } = args

  if (!contract_text || contract_text.length < 50) {
    return {
      content: [{ type: 'text', text: 'Error: contract_text must be at least 50 characters' }],
      isError: true,
    }
  }
  if (!client_message) {
    return {
      content: [{ type: 'text', text: 'Error: client_message is required' }],
      isError: true,
    }
  }

  try {
    const response = await fetch(`${API_BASE}/v1/scope/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        contract_text,
        client_message,
        communication_channel,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      return {
        content: [{ type: 'text', text: `API Error: ${data.error?.message || response.statusText}` }],
        isError: true,
      }
    }

    // Format a nice summary for the user
    let summary = `## Scope Guard Analysis\n\n`
    
    if (data.violation_detected) {
      summary += `⚠️ **${data.violations?.length || 0} violation(s) detected**\n\n`
      
      if (data.violations?.length > 0) {
        summary += `### Violations:\n`
        data.violations.forEach((v, i) => {
          summary += `${i + 1}. **${v.type}** (${v.severity}): ${v.description}\n`
          if (v.contract_reference) {
            summary += `   📄 Reference: ${v.contract_reference}\n`
          }
        })
        summary += `\n`
      }
    } else {
      summary += `✅ **No violations detected**\n\n`
    }

    if (data.response_options?.length > 0) {
      summary += `### Response Options:\n\n`
      data.response_options.forEach((opt, i) => {
        const rec = opt.recommended ? ' ⭐ **Recommended**' : ''
        summary += `**${i + 1}. ${opt.label}**${rec}\n\n`
        summary += `${opt.draft}\n\n---\n\n`
      })
    }

    if (data.suggested_change_order?.applicable) {
      const co = data.suggested_change_order
      summary += `### 💼 Suggested Change Order\n`
      summary += `${co.additional_work_description}\n`
      if (co.estimated_hours) summary += `- Estimated: ~${co.estimated_hours} hours\n`
      if (co.suggested_cost_usd) summary += `- Cost: $${co.suggested_cost_usd.toLocaleString()} USD\n`
      if (co.timeline_extension_days) summary += `- Timeline: +${co.timeline_extension_days} days\n`
    }

    if (data.summary) {
      summary += `\n**Summary:** ${data.summary}\n`
    }

    return {
      content: [{ type: 'text', text: summary }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    }
  }
}

async function handleChangeOrder(args) {
  const {
    additional_work,
    additional_cost,
    freelancer_name,
    client_name,
    currency = 'USD',
    timeline_extension_days,
    jurisdiction = 'International',
  } = args

  if (!additional_work) {
    return {
      content: [{ type: 'text', text: 'Error: additional_work is required' }],
      isError: true,
    }
  }
  if (additional_cost === undefined || isNaN(Number(additional_cost))) {
    return {
      content: [{ type: 'text', text: 'Error: additional_cost is required (number)' }],
      isError: true,
    }
  }

  try {
    const response = await fetch(`${API_BASE}/v1/scope/change-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        additional_work,
        additional_cost: Number(additional_cost),
        freelancer_name,
        client_name,
        currency,
        timeline_extension_days,
        jurisdiction,
      }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      return {
        content: [{ type: 'text', text: `API Error: ${data.error?.message || response.statusText}` }],
        isError: true,
      }
    }

    let summary = `## Change Order Generated\n\n`
    summary += `**Change Order Details:**\n`
    summary += `- Freelancer: ${data.change_order_details?.freelancer_name || 'Service Provider'}\n`
    summary += `- Client: ${data.change_order_details?.client_name || 'Client'}\n`
    summary += `- Additional Work: ${data.change_order_details?.additional_work}\n`
    summary += `- Cost: ${data.change_order_details?.currency} ${data.change_order_details?.additional_cost.toLocaleString()}\n`
    if (data.change_order_details?.timeline_extension_days) {
      summary += `- Timeline Extension: ${data.change_order_details.timeline_extension_days} days\n`
    }
    summary += `- Jurisdiction: ${data.change_order_details?.jurisdiction}\n`
    summary += `- Generated: ${data.change_order_details?.generated_at}\n\n`
    
    summary += `---\n\n`
    summary += `**Full Document:**\n\n`
    summary += data.document

    return {
      content: [{ type: 'text', text: summary }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    }
  }
}

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Scope Guard MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
