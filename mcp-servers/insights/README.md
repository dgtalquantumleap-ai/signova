# @ebenova/insights-mcp

MCP server for [Ebenova Insights](https://ebenova.dev/insights) — monitor Reddit and Nairaland for keywords about your product, and get AI-drafted replies in community tone.

## Tools

| Tool | What it does |
|---|---|
| `list_monitors` | List all active keyword monitors |
| `create_monitor` | Create a new keyword monitor |
| `delete_monitor` | Deactivate a monitor |
| `get_matches` | Fetch recent Reddit/Nairaland matches |
| `regenerate_draft` | Re-generate the AI reply for a match |
| `rate_draft` | Rate a draft 👍 or 👎 |

## Install

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ebenova-insights": {
      "command": "npx",
      "args": ["-y", "@ebenova/insights-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_your_key"
      }
    }
  }
}
```

### Cursor / VS Code

Add the same block under `mcpServers` in your Cursor settings.

## Get an API key

Your API key needs `insights: true` access. Visit [ebenova.dev/insights](https://ebenova.dev/insights) to get one.

## Example usage

Once connected, you can talk to Claude Desktop naturally:

- *"Show me my Insights monitors"*
- *"Create a monitor for my AI recruiting platform watching r/recruiting and r/artificial"*
- *"What Reddit posts matched my monitor today?"*
- *"Regenerate the draft for match 1abc23 — the first one was skipped"*

## Base URL

This MCP server talks to `https://insights.ebenova.dev`. To use a local instance, set:

```json
"env": {
  "EBENOVA_API_KEY": "sk_live_your_key",
  "INSIGHTS_API_BASE": "http://localhost:3001"
}
```

## License

MIT — Ebenova Solutions
