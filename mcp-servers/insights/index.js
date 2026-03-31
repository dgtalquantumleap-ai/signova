#!/usr/bin/env node
// @ebenova/insights-mcp
// MCP server for Ebenova Insights — Reddit + Nairaland keyword monitoring.
//
// Tools exposed:
//   list_monitors      — list all monitors for your API key
//   create_monitor     — create a new keyword monitor
//   delete_monitor     — deactivate a monitor
//   get_matches        — fetch recent Reddit/Nairaland matches for a monitor
//   regenerate_draft   — re-generate the AI reply draft for a specific match
//   rate_draft         — thumbs up/down on a draft (improves quality over time)
//
// Usage — Claude Desktop config:
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
    || 'https://insights.ebenova.dev'
  const API_KEY = config.EBENOVA_API_KEY || process.env.EBENOVA_API_KEY || ''

  const isSandbox = API_KEY === 'sk_test_sandbox' || API_KEY === 'sandbox-test-key'

  if (!API_KEY && !isSandbox) {
    process.stderr.write('[ebenova-insights-mcp] WARNING: EBENOVA_API_KEY is not set.\n')
    process.stderr.write('[ebenova-insights-mcp] Get an Insights key at https://ebenova.dev/insights\n')
  }

  function headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` }
  }

  async function get(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'GET', headers: headers() })
    return res.json()
  }

  async function post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    })
    return res.json()
  }

  async function del(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: headers() })
    return res.json()
  }

  // ── Helper: format a match for display ──────────────────────────────────────
  function formatMatch(m, index) {
    const lines = [
      `**${index + 1}. ${m.title}**`,
      `${m.source === 'nairaland' ? '🇳🇬 Nairaland' : '📌 r/' + m.subreddit} · u/${m.author} · ⬆️ ${m.score} · 💬 ${m.comments}`,
      `Keyword: \`${m.keyword}\` · ${m.approved ? '✅ Safe to reply' : '⛔ DO NOT POST — not an approved subreddit'}`,
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

  const server = new McpServer({ name: 'ebenova-insights', version: '1.0.0' })

  // ── Tool: list_monitors ──────────────────────────────────────────────────────

  server.tool(
    'list_monitors',
    {
      description: `List all your Ebenova Insights monitors.

Use this to see what keyword monitors are currently active, when they last ran,
and how many Reddit/Nairaland matches they've found.

When to use:
- "What monitors do I have set up?"
- "How many keywords am I monitoring?"
- "When did my monitor last run?"
- "Show me my Insights monitors"`,
      inputSchema: z.object({}),
    },
    async () => {
      const data = await get('/v1/monitors')
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Could not fetch monitors'}\n${data.error?.hint || ''}` }],
          isError: true,
        }
      }
      if (data.count === 0) {
        return {
          content: [{ type: 'text', text: 'No monitors found. Use `create_monitor` to set one up.' }],
        }
      }
      const lines = [`**${data.count} monitor${data.count !== 1 ? 's' : ''}:**`, '']
      for (const m of data.monitors) {
        lines.push(
          `**${m.name}** (\`${m.id}\`)`,
          `  Status: ${m.active ? '🟢 Active' : '🔴 Inactive'} · Plan: ${m.plan?.toUpperCase() || 'N/A'}`,
          `  Keywords: ${m.keyword_count} (${(m.keywords || []).slice(0, 5).join(', ')}${m.keyword_count > 5 ? '…' : ''})`,
          `  Alert email: ${m.alert_email || 'Not set'}`,
          `  Last polled: ${m.last_poll_at ? new Date(m.last_poll_at).toLocaleString() : 'Not yet'}`,
          `  Total matches: ${m.total_matches_found || 0}`,
          '',
        )
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ── Tool: create_monitor ─────────────────────────────────────────────────────

  server.tool(
    'create_monitor',
    {
      description: `Create a new Ebenova Insights monitor to watch Reddit and Nairaland for keywords.

Monitors poll every 15 minutes. When posts match your keywords, you'll get an email alert
with post details and AI-drafted replies in community tone (not sales copy).

Plan limits:
- Starter: 3 monitors, 20 keywords each
- Growth: 20 monitors, 100 keywords each
- Scale: 100 monitors, 500 keywords each

When to use:
- "Set up a monitor for my product"
- "Start watching Reddit for mentions of scope creep"
- "Create an Insights monitor for [product name]"
- "Monitor r/freelance and r/webdev for NDA questions"`,
      inputSchema: z.object({
        name: z.string().max(100).describe('Name for this monitor, e.g. "Signova - Freelance Subs"'),
        keywords: z.array(z.object({
          keyword: z.string().describe('Keyword or phrase to search for, e.g. "freelance contract"'),
          subreddits: z.array(z.string()).optional().describe('Subreddits to scope to (empty = global Reddit search)'),
          productContext: z.string().max(500).optional().describe('Per-keyword product context (overrides monitor-level context)'),
        })).min(1).describe('Keywords to monitor'),
        productContext: z.string().max(2000).optional().describe(
          'Describe your product. Be specific: what problem you solve, who you help, and how. This shapes every AI reply draft.'
        ),
        alertEmail: z.string().optional().describe('Email to send match alerts to (defaults to your API key owner email)'),
      }),
    },
    async ({ name, keywords, productContext, alertEmail }) => {
      const data = await post('/v1/monitors', { name, keywords, productContext, alertEmail })
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Could not create monitor'}\n${data.error?.hint || ''}` }],
          isError: true,
        }
      }
      const lines = [
        `✅ **Monitor created: ${data.name}**`,
        `ID: \`${data.monitor_id}\``,
        `Keywords: ${data.keyword_count} (${(data.keywords || []).join(', ')})`,
        `Plan: ${data.plan?.toUpperCase()}`,
        `Alerts → ${data.alert_email}`,
        `First results: ${data.next_poll_eta || 'within 15 minutes'}`,
        '',
        'Use `get_matches` with this monitor ID to see results once the first poll runs.',
      ]
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ── Tool: delete_monitor ─────────────────────────────────────────────────────

  server.tool(
    'delete_monitor',
    {
      description: `Deactivate an Ebenova Insights monitor. The monitor stops scanning immediately.
Match data is preserved for 7 days. Use list_monitors to find monitor IDs.

When to use:
- "Stop monitoring for [keyword]"
- "Deactivate monitor mon_abc123"
- "I don't need this monitor anymore"`,
      inputSchema: z.object({
        monitor_id: z.string().describe('Monitor ID to deactivate (e.g. mon_abc123). Use list_monitors to find IDs.'),
      }),
    },
    async ({ monitor_id }) => {
      const data = await del(`/v1/monitors/${monitor_id}`)
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Could not deactivate monitor'}` }],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text', text: `✅ Monitor \`${data.monitor_id}\` deactivated. Scanning stopped. Match data retained for 7 days.` }],
      }
    }
  )

  // ── Tool: get_matches ────────────────────────────────────────────────────────

  server.tool(
    'get_matches',
    {
      description: `Fetch recent Reddit and Nairaland matches for an Insights monitor.

Returns posts that matched your keywords, with post content, subreddit safety status,
and AI-drafted replies. Results are stored for 7 days.

When to use:
- "Show me today's Reddit mentions"
- "What matched my Signova monitor?"
- "Get the latest Insights matches for mon_abc123"
- "Check my Reddit monitor results"
- "Any new posts about freelance contracts?"`,
      inputSchema: z.object({
        monitor_id: z.string().describe('Monitor ID to fetch matches for. Use list_monitors if you need to find it.'),
        limit: z.number().int().min(1).max(100).optional().default(10).describe('Number of matches to return (default 10, max 100)'),
        offset: z.number().int().min(0).optional().default(0).describe('Pagination offset'),
      }),
    },
    async ({ monitor_id, limit, offset }) => {
      const data = await get(`/v1/matches?monitor_id=${monitor_id}&limit=${limit}&offset=${offset}`)
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Could not fetch matches'}` }],
          isError: true,
        }
      }
      if (data.count === 0) {
        return {
          content: [{ type: 'text', text: `No matches found for monitor \`${monitor_id}\` yet.\n\nIf you just created it, check back in ~15 minutes after the first poll runs.` }],
        }
      }
      const lines = [
        `**${data.count} match${data.count !== 1 ? 'es' : ''} for \`${monitor_id}\`** (offset: ${data.offset})`,
        '',
      ]
      for (const [i, m] of data.matches.entries()) {
        lines.push(formatMatch(m, i), '', '---', '')
      }
      if (data.count === limit) {
        lines.push(`_Showing ${limit} results. Use \`offset: ${offset + limit}\` to see more._`)
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }
  )

  // ── Tool: regenerate_draft ───────────────────────────────────────────────────

  server.tool(
    'regenerate_draft',
    {
      description: `Regenerate the AI reply draft for a specific Reddit/Nairaland match.

Use this when the original draft was skipped (null), or when you want a fresh take
using updated product context. The new draft is saved and replaces the old one.

When to use:
- "Regenerate the draft for match 1abc23"
- "The draft was empty, try again"
- "Get a new reply suggestion for this post"`,
      inputSchema: z.object({
        monitor_id: z.string().describe('Monitor ID the match belongs to'),
        match_id: z.string().describe('Match ID to regenerate draft for'),
      }),
    },
    async ({ monitor_id, match_id }) => {
      const data = await post('/v1/matches/draft', { monitor_id, match_id })
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Draft regeneration failed'}` }],
          isError: true,
        }
      }
      if (!data.draft) {
        return {
          content: [{ type: 'text', text: `Match \`${match_id}\`: AI decided to skip this one (post not relevant enough for a natural reply). This is intentional — better no draft than a forced one.` }],
        }
      }
      return {
        content: [{
          type: 'text',
          text: `✏️ **New draft for \`${match_id}\`:**\n\n${data.draft}\n\nUse \`rate_draft\` to give feedback on this draft.`,
        }],
      }
    }
  )

  // ── Tool: rate_draft ─────────────────────────────────────────────────────────

  server.tool(
    'rate_draft',
    {
      description: `Rate an AI reply draft thumbs up (useful) or thumbs down (not useful).
Feedback is stored and used to improve draft quality over time.

When to use:
- "This draft was great — thumbs up on match 1abc23"
- "That reply was off — thumbs down"
- "Rate the draft for this match"`,
      inputSchema: z.object({
        monitor_id: z.string().describe('Monitor ID the match belongs to'),
        match_id: z.string().describe('Match ID to rate'),
        feedback: z.enum(['up', 'down']).describe('"up" if the draft was useful, "down" if not'),
      }),
    },
    async ({ monitor_id, match_id, feedback }) => {
      const data = await post('/v1/matches/feedback', { monitor_id, match_id, feedback })
      if (!data.success) {
        return {
          content: [{ type: 'text', text: `Error: ${data.error?.message || 'Feedback not recorded'}` }],
          isError: true,
        }
      }
      const emoji = feedback === 'up' ? '👍' : '👎'
      return {
        content: [{ type: 'text', text: `${emoji} Feedback recorded for match \`${match_id}\`. Thanks — this helps improve future drafts.` }],
      }
    }
  )

  return server
}

// ── Smithery sandbox export ───────────────────────────────────────────────────

export function createSandboxServer() {
  return createServer({ EBENOVA_API_KEY: 'sandbox-test-key' })
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

async function main() {
  const isBuildMode = process.env.NODE_ENV === 'build'
    || process.env.EBENOVA_API_KEY === 'sk_test_sandbox'
    || !process.stdin.isTTY

  const server = createServer()

  if (isBuildMode) {
    process.stderr.write('[ebenova-insights-mcp] Build mode: Server initialized successfully\n')
    process.stderr.write('[ebenova-insights-mcp] Tools: list_monitors, create_monitor, delete_monitor, get_matches, regenerate_draft, rate_draft\n')
    process.exit(0)
    return
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  console.error('[ebenova-insights-mcp] Fatal error:', err)
  process.exit(1)
})
