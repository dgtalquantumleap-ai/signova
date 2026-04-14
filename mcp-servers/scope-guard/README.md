# @ebenova/scope-guard-mcp

AI-powered contract scope violation detector. Paste your contract + client message — get back violation type, severity, 3 professional response drafts, and change order pricing. **Zero API competitors.**

## What it does

**You say to Claude:**
> "My contract says 5 pages and 2 revisions. The client just sent: 'Can you also add a blog section? Shouldn't take long.' Is this scope creep?"

**Claude calls the tool and returns:**
- **Violation detected:** Yes — feature addition outside agreed scope
- **Severity:** Medium
- **3 response drafts** (firm, friendly, neutral) ready to send
- **Change order:** Recommended additional cost + timeline extension

## Tools

| Tool | Description |
|------|-------------|
| `analyze_scope_creep` | Analyze a client message against your contract for scope violations |
| `generate_change_order` | Generate a formal change order document for additional work |

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ebenova-scope-guard": {
      "command": "npx",
      "args": ["-y", "@ebenova/scope-guard-mcp"],
      "env": {
        "EBENOVA_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Get your API key

1. Go to [ebenova.dev](https://ebenova.dev)
2. Sign up for free (5 calls/month on free tier)
3. Copy your API key from the dashboard

## Pricing

| Plan | Calls/month | Price |
|------|-------------|-------|
| Free | 5 | $0 |
| Starter | 100 | $29 |
| Growth | 500 | $79 |
| Scale | 2,000 | $199 |

## Use cases

- **Freelancers** — detect scope creep before it costs you money
- **Agencies** — enforce contract boundaries across client accounts
- **Legal teams** — automate change order generation
- **SaaS platforms** — embed scope enforcement into your product via API

## Links

- [Ebenova Developer Platform](https://ebenova.dev)
- [API Documentation](https://ebenova.dev/docs)
- [npm package](https://www.npmjs.com/package/@ebenova/scope-guard-mcp)

## License

MIT
