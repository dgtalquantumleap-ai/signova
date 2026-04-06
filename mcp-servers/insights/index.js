#!/usr/bin/env node
// @ebenova/insights-mcp v1.0.3
// MCP server for Ebenova Insights — Reddit + Nairaland keyword monitoring.
//
// Tools: list_monitors, create_monitor, delete_monitor,
//        get_matches, regenerate_draft, rate_draft
//
// Claude Desktop config:
//   {
//     "mcpServers": {
//       "ebenova-insights": {
//         "command": "npx",
//         "args": ["-y", "@ebenova/insights-mcp"],
//         "env": { "EBENOVA_API_KEY": "sk_live_xxx" }
//       }
//     }
//   }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// ── Server factory ────────────────────────────────────────────────────────────
function createServer(config = {}) {
  const API_BASE = config.INSIGHTS_API_BASE
    || process.env.INSIGHTS_API_BASE
    || 'https://api.ebenova.dev'

  const API_KEY = config.EBENOVA_API_KEY || process.env.EBENOVA_API_KEY || ''

  if (!API_KEY) {
    process.stderr.write('[ebenova-insights-mcp] WARNING: EBENOVA_API_KEY not set.\n')
    process.stderr.write('[ebenova-insights-mcp] Get an Insights key at https://ebenova.dev/insights\n')
  }

  const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  })

  async function apiFetch(method, path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: headers(),
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return res.json()
  }

  const get  = (path)       => apiFetch('GET',    path)
  const post = (path, body) => apiFetch('POST',   path, body)
  const del  = (path)       => apiFetch('DELETE', path)

  // ── Format a match for display ────────────────────────────────────────────
  function formatMatch(m, index) {
    const lines = [
      `**${index + 1}. ${m.title}**`,
      `${m.source === 'nairaland' ? '🇳🇬 Nairaland' : '📌 r/' + m.subreddit} · u/${m.author} · ⬆️ ${m.score} · 💬 ${m.comments}`,
      `Keyword: \`${m.keyword}\` · ${m.approved ? '✅ Safe to reply' : '⛔ DO NOT POST'}`,
      `🔗 ${m.url}`,
    ]
    if (m.body) lines.push(`> ${m.body.slice(0, 200)}${m.body.length > 200 ? '…' : ''}`)
    if (m.draft) {
      lines.push('', `✏️ **Suggested reply:**`, m.draft)
    } else {
      lines.push('', `_(No draft — use \`regenerate_draft\` to generate one)_`)
    }
    if (m.feedback) lines.push(`_You rated this: ${m.feedback === 'up' ? '👍' : '👎'}_`)
    return lines.join('\n')
  }

  const server = new McpServer({ name: 'ebenova-insights', version: '1.0.3' })

  // ── list_monitors ────────────────────────────────────────────────────────
  server.tool('list_monitors', {
    description: `List all your Ebenova Insights monitors.
When to use: "What monitors do I have?", "Show my Insights monitors", "When did my monitor last run?"`,
    inputSchema: z.object({}),
  }, async () => {
    const data = await get('/v1/insights/monitors')
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}\n${data.error?.hint || ''}` }], isError: true }
    if (data.count === 0) return { content: [{ type: 'text', text: 'No monitors found. Use `create_monitor` to set one up.' }] }
    const lines = [`**${data.count} monitor(s):**`, '']
    for (const m of data.monitors) {
      const monId = m.monitor_id || m.id  // Vercel returns monitor_id, api-server returns id
      lines.push(
        `**${m.name}** (\`${monId}\`)`,
        `  ${m.active ? '🟢 Active' : '🔴 Inactive'} · Plan: ${(m.plan || 'N/A').toUpperCase()}`,
        `  Keywords: ${m.keyword_count} · Alert: ${m.alert_email || 'not set'}`,
        `  Last polled: ${m.last_poll_at ? new Date(m.last_poll_at).toLocaleString() : 'not yet'} · Matches: ${m.total_matches || m.total_matches_found || 0}`,
        '',
      )
    }
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  })

  // ── create_monitor ───────────────────────────────────────────────────────
  server.tool('create_monitor', {
    description: `Create a new monitor to watch Reddit and Nairaland for keywords about your product.
Polls every 15 minutes. Sends email alerts with AI-drafted replies in community tone.
Plan limits: Starter = 3 monitors / 20 keywords. Growth = 20 monitors / 100 keywords.
When to use: "Set up a monitor for my product", "Start watching r/freelance for scope creep"`,
    inputSchema: z.object({
      name: z.string().max(100).describe('Monitor name, e.g. "Signova - Freelance"'),
      keywords: z.array(z.object({
        keyword: z.string().describe('Keyword or phrase, e.g. "freelance contract"'),
        subreddits: z.array(z.string()).optional().describe('Subreddits to scope to (empty = all Reddit)'),
        productContext: z.string().max(500).optional().describe('Per-keyword product context (optional)'),
      })).min(1),
      productContext: z.string().max(2000).optional().describe(
        'Describe your product: what problem you solve, who you help. Shapes all AI reply drafts.'
      ),
      alertEmail: z.string().optional().describe('Email for match alerts (defaults to API key owner email)'),
    }),
  }, async ({ name, keywords, productContext, alertEmail }) => {
    const data = await post('/v1/insights/monitors', { name, keywords, productContext, alertEmail })
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}\n${data.error?.hint || ''}` }], isError: true }
    return { content: [{ type: 'text', text: [
      `✅ **Monitor created: ${data.name}**`,
      `ID: \`${data.monitor_id}\`  ·  Keywords: ${data.keyword_count}`,
      `Alerts → ${data.alert_email}  ·  First results: ${data.next_poll_eta || 'within 15 min'}`,
    ].join('\n') }] }
  })

  // ── delete_monitor ───────────────────────────────────────────────────────
  server.tool('delete_monitor', {
    description: `Deactivate an Insights monitor. Scanning stops immediately. Match data kept 7 days.
When to use: "Stop monitoring for [keyword]", "Deactivate monitor mon_abc123"`,
    inputSchema: z.object({
      monitor_id: z.string().describe('Monitor ID, e.g. mon_abc123. Use list_monitors to find IDs.'),
    }),
  }, async ({ monitor_id }) => {
    const data = await del(`/v1/insights/monitors/${monitor_id}`)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    return { content: [{ type: 'text', text: `✅ Monitor \`${data.monitor_id}\` deactivated.` }] }
  })

  // ── get_matches ──────────────────────────────────────────────────────────
  server.tool('get_matches', {
    description: `Fetch recent Reddit and Nairaland matches for a monitor.
Returns posts with content, subreddit safety status, and AI-drafted replies. Stored 7 days.
When to use: "Show me today's Reddit mentions", "What matched my Signova monitor?", "Check my Reddit results"`,
    inputSchema: z.object({
      monitor_id: z.string().describe('Monitor ID. Use list_monitors if you need to find it.'),
      limit:  z.number().int().min(1).max(100).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
  }, async ({ monitor_id, limit, offset }) => {
    const data = await get(`/v1/insights/matches?monitor_id=${monitor_id}&limit=${limit}&offset=${offset}`)
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    if (data.count === 0) return { content: [{ type: 'text', text: `No matches yet for \`${monitor_id}\`. If just created, check back in ~15 min.` }] }
    const lines = [`**${data.count} match(es) for \`${monitor_id}\`:**`, '']
    for (const [i, m] of data.matches.entries()) lines.push(formatMatch(m, i), '', '---', '')
    if (data.count === limit) lines.push(`_Use offset: ${offset + limit} to see more._`)
    return { content: [{ type: 'text', text: lines.join('\n') }] }
  })

  // ── regenerate_draft ─────────────────────────────────────────────────────
  server.tool('regenerate_draft', {
    description: `Re-generate the AI reply draft for a specific match. Use when draft was null or you want a fresh take.
When to use: "Regenerate the draft for match 1abc23", "The draft was empty, try again"`,
    inputSchema: z.object({
      monitor_id: z.string(),
      match_id:   z.string(),
    }),
  }, async ({ monitor_id, match_id }) => {
    const data = await post('/v1/insights/matches/draft', { monitor_id, match_id })
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    if (!data.draft) return { content: [{ type: 'text', text: `AI skipped this match — post not relevant enough for a natural reply. Better no draft than a forced one.` }] }
    return { content: [{ type: 'text', text: `✏️ **New draft for \`${match_id}\`:**\n\n${data.draft}\n\nUse \`rate_draft\` to give feedback.` }] }
  })

  // ── rate_draft ───────────────────────────────────────────────────────────
  server.tool('rate_draft', {
    description: `Rate a reply draft thumbs up or down. Feedback improves future draft quality.
When to use: "Thumbs up on match 1abc23", "That reply was off — thumbs down"`,
    inputSchema: z.object({
      monitor_id: z.string(),
      match_id:   z.string(),
      feedback:   z.enum(['up', 'down']),
    }),
  }, async ({ monitor_id, match_id, feedback }) => {
    const data = await post('/v1/insights/matches/feedback', { monitor_id, match_id, feedback })
    if (!data.success) return { content: [{ type: 'text', text: `Error: ${data.error?.message}` }], isError: true }
    return { content: [{ type: 'text', text: `${feedback === 'up' ? '👍' : '👎'} Feedback recorded for \`${match_id}\`.` }] }
  })

  return server
}

// ── Smithery config schema — prompts users for API key ────────────────────────
export const configSchema = {
  type: 'object',
  properties: {
    EBENOVA_API_KEY: {
      type: 'string',
      title: 'Ebenova API Key',
      description: 'Your Insights API key. Get one at https://ebenova.dev/insights',
    },
    INSIGHTS_API_BASE: {
      type: 'string',
      title: 'API Base URL',
      description: 'Custom API base URL (optional, defaults to https://api.ebenova.dev)',
      default: 'https://api.ebenova.dev',
    },
  },
  required: ['EBENOVA_API_KEY'],
}

// ── Sandbox server for Smithery scanning (mock data, no real API calls) ───────
function createSandboxServer() {
  const server = new McpServer({ name: 'ebenova-insights', version: '1.0.3' })

  server.tool('list_monitors', {
    description: 'List all your Ebenova Insights monitors.',
    inputSchema: z.object({}),
  }, async () => ({
    content: [{ type: 'text', text: '**Sandbox mode.** Connect with your real EBENOVA_API_KEY to see your monitors.' }],
  }))

  server.tool('create_monitor', {
    description: 'Create a new keyword monitor.',
    inputSchema: z.object({
      name: z.string(),
      keywords: z.array(z.object({
        keyword: z.string(),
        subreddits: z.array(z.string()).optional(),
        productContext: z.string().optional(),
      })).min(1),
      productContext: z.string().optional(),
      alertEmail: z.string().optional(),
    }),
  }, async () => ({
    content: [{ type: 'text', text: '**Sandbox mode.** Connect with your real EBENOVA_API_KEY to create monitors.' }],
  }))

  server.tool('delete_monitor', {
    description: 'Deactivate an Insights monitor.',
    inputSchema: z.object({ monitor_id: z.string() }),
  }, async () => ({
    content: [{ type: 'text', text: '**Sandbox mode.** Connect with your real EBENOVA_API_KEY to delete monitors.' }],
  }))

  server.tool('get_matches', {
    description: 'Fetch recent Reddit/Nairaland matches for a monitor.',
    inputSchema: z.object({
      monitor_id: z.string(),
      limit: z.number().int().min(1).max(100).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
  }, async () => ({
    content: [{ type: 'text', text: '**Sandbox mode.** Connect with your real EBENOVA_API_KEY to see matches.' }],
  }))

  server.tool('regenerate_draft', {
    description: 'Re-generate the AI reply draft for a specific match.',
    inputSchema: z.object({ monitor_id: z.string(), match_id: z.string() }),
  }, async () => ({
    content: [{ type: 'text', text: '**Sandbox mode.** Connect with your real EBENOVA_API_KEY to regenerate drafts.' }],
  }))

  server.tool('rate_draft', {
    description: 'Rate a draft thumbs up or down.',
    inputSchema: z.object({ monitor_id: z.string(), match_id: z.string(), feedback: z.enum(['up', 'down']) }),
  }, async () => ({
    content: [{ type: 'text', text: '**Sandbox mode.** Connect with your real EBENOVA_API_KEY to rate drafts.' }],
  }))

  return server
}

// Smithery calls createSandboxServer() during scanning (no real credentials needed).
export { createSandboxServer }

// Smithery also tries the default export as a factory — support both patterns.
export default function createServerFromConfig(config = {}) {
  const isSandbox = config.EBENOVA_API_KEY === 'sandbox-scan-key' || !config.EBENOVA_API_KEY
  if (isSandbox) return createSandboxServer()
  return createServer(config)
}

export { createServer }

async function main() {
  // Apify detection: Actor runs timeout because stdio server waits forever for stdin.
  // When on Apify, just verify the server starts and exit cleanly.
  const isApify = !!(process.env.APIFY_IS_AT_HOME ||
                     process.env.ACTOR_IS_AT_HOME ||
                     process.env.APIFY_ACTOR_RUN_ID ||
                     process.env.ACTOR_RUN_ID ||
                     process.env.APIFY_CONTAINER_URL)

  const server = createServer()

  if (isApify) {
    process.stderr.write('[ebenova-insights-mcp] Server initialized successfully\n')
    process.stderr.write('[ebenova-insights-mcp] Tools registered: list_monitors, create_monitor, delete_monitor, get_matches, regenerate_draft, rate_draft\n')
    process.exit(0)
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Server stays alive — do NOT exit here, MCP runs on stdio
}

main().catch(err => {
  process.stderr.write(`[ebenova-insights-mcp] Fatal: ${err.message}\n`)
  process.exit(1)
})
