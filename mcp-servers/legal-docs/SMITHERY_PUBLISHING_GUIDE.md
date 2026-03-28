# ═══════════════════════════════════════════════════════════════
# SMITHERY MCP PUBLISHING GUIDE
# ═══════════════════════════════════════════════════════════════
# 
# Status: Configuration files created
# Next: Publish to Smithery
# 
# ═══════════════════════════════════════════════════════════════

---

## PROBLEM DIAGNOSIS

**Error from Smithery:**
```
Connection error: Initialization failed with status 405. 
Your server could not be automatically scanned.
```

**Root Cause:**
Smithery is trying to connect to your MCP server via HTTP, but your server uses **stdio transport** (not HTTP/SSE). This is correct for Claude Desktop/Cursor, but Smithery needs additional configuration.

**Solution:**
1. ✅ Created `public/.well-known/mcp/server-card.json` (server metadata)
2. ✅ Added `configSchema` to package.json (for API key prompts)
3. ✅ Created `smithery.yaml` (Smithery-specific config)
4. ✅ Created `README_SMITHERY.md` (user documentation)

---

## FILES CREATED

| File | Purpose | Status |
|------|---------|--------|
| `public/.well-known/mcp/server-card.json` | Server metadata for discovery | ✅ Created |
| `mcp-servers/legal-docs/smithery.yaml` | Smithery configuration | ✅ Created |
| `mcp-servers/legal-docs/README_SMITHERY.md` | User documentation | ✅ Created |
| `mcp-servers/legal-docs/package.json` | Updated with configSchema | ✅ Updated |

---

## PUBLISHING STEPS

### Step 1: Install Smithery CLI

```bash
npm install -g @smithery/cli
```

### Step 2: Login to Smithery

```bash
smithery login
```

This will open a browser window. Login with your Google account (dgtalquantumleap@gmail.com).

### Step 3: Publish the MCP Server

```bash
cd c:\projects\signova\mcp-servers\legal-docs
smithery publish
```

**What this does:**
- Reads `smithery.yaml` for configuration
- Reads `package.json` for metadata
- Validates `configSchema` for API keys
- Publishes to Smithery registry

### Step 4: Verify Publishing

After publishing, visit:
- **Smithery Page:** https://smithery.ai/server/@ebenova/legal-docs-mcp
- **Your Dashboard:** https://smithery.ai/dgtalquantumleap@gmail.com

---

## ALTERNATIVE: Manual Publishing via GitHub

If the CLI doesn't work, publish via GitHub:

### Step A: Create GitHub Repository

```bash
cd c:\projects\signova\mcp-servers\legal-docs

# Initialize git (if not already)
git init
git add .
git commit -m "Initial MCP server release"

# Create GitHub repo (manual or via CLI)
gh repo create ebenova/legal-docs-mcp --public --source=. --remote=origin --push
```

### Step B: Add Smithery Badge to README

Add this to the top of your README.md:

```markdown
[![Smithery](https://smithery.ai/badge/@ebenova/legal-docs-mcp)](https://smithery.ai/server/@ebenova/legal-docs-mcp)
```

### Step C: Submit to Smithery

1. Go to: https://smithery.ai/publish
2. Enter your GitHub repo URL: `https://github.com/ebenova/legal-docs-mcp`
3. Smithery will scan the repo
4. Fill in any missing metadata
5. Click "Publish"

---

## CONFIGURATION EXPLAINED

### server-card.json

This file tells Smithery (and other MCP registries) about your server:

```json
{
  "name": "ebenova-legal-docs",
  "configSchema": {
    "EBENOVA_API_KEY": {
      "type": "string",
      "description": "Your Ebenova API key...",
      "required": true
    }
  }
}
```

**Why it's needed:**
- Smithery scans this file to understand your server
- `configSchema` tells Smithery to prompt users for API key
- Without it, users won't be prompted for credentials

### smithery.yaml

Smithery-specific configuration (similar to Vercel's `vercel.json`):

```yaml
configSchema:
  EBENOVA_API_KEY:
    type: string
    required: true
```

### package.json smithery field

Embedded Smithery config in npm package:

```json
{
  "smithery": {
    "name": "ebenova-legal-docs",
    "configSchema": { ... }
  }
}
```

---

## TROUBLESHOOTING

### Error: "No config schema provided"

**Cause:** Smithery can't find your `configSchema`

**Fix:** Ensure `package.json` has the `smithery` field with `configSchema`:

```json
{
  "smithery": {
    "configSchema": {
      "EBENOVA_API_KEY": {
        "type": "string",
        "required": true
      }
    }
  }
}
```

### Error: "Connection error: 405"

**Cause:** Smithery is trying HTTP connection, but your server uses stdio

**Fix:** This is expected! Ignore this error. Your server is correctly configured for stdio transport (Claude Desktop, Cursor). The `server-card.json` file tells Smithery how to handle this.

### Error: "Server metadata discovered but no tools listed"

**Cause:** Smithery couldn't scan your server's tools

**Fix:** Add explicit tool list to `server-card.json`:

```json
{
  "capabilities": {
    "tools": {
      "generate_legal_document": "Generate a legal document...",
      "extract_from_conversation": "Extract fields from chat...",
      "list_document_types": "List all document types",
      "check_usage": "Check API usage"
    }
  }
}
```

---

## POST-PUBLISHING CHECKLIST

After publishing to Smithery:

- [ ] Verify Smithery page loads: https://smithery.ai/server/@ebenova/legal-docs-mcp
- [ ] Test installation via Smithery: `smithery install @ebenova/legal-docs-mcp`
- [ ] Add Smithery badge to GitHub README
- [ ] Share on Twitter/X: "Just published my MCP server to Smithery!"
- [ ] Update documentation: Add Smithery installation instructions

---

## INSTALLATION INSTRUCTIONS FOR USERS

After publishing, users can install your MCP server via Smithery:

### Via Smithery CLI

```bash
smithery install @ebenova/legal-docs-mcp
```

This will:
1. Download the MCP server
2. Prompt for `EBENOVA_API_KEY`
3. Configure Claude Desktop automatically

### Via Claude Desktop (Manual)

1. Get API key: https://ebenova.dev/docs
2. Open Claude Desktop settings
3. Developer → Edit Config
4. Add:

```json
{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "@ebenova/legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_your_key"
      }
    }
  }
}
```

5. Save and restart Claude

### Via Cursor IDE

1. Settings → Features → MCP Servers
2. Add New Server
3. Name: `ebenova-legal`
4. Command: `npx -y @ebenova/legal-docs-mcp`
5. Environment: `EBENOVA_API_KEY=sk_live_your_key`

---

## MARKETING YOUR MCP SERVER

After publishing:

### 1. Share on Social Media

**Twitter/X:**
```
Just published my MCP server to Smithery! 🚀

Generate professional legal documents (NDAs, contracts, tenancy agreements) directly from Claude Desktop.

27 document types × 18 jurisdictions (Nigeria, Canada, UK, US, India + more)

Try it: https://smithery.ai/server/@ebenova/legal-docs-mcp

#MCP #AI #LegalTech #ClaudeAI
```

**LinkedIn:**
```
Excited to announce the launch of the Ebenova Legal Documents MCP Server!

Now you can generate professional legal documents directly from Claude Desktop, Cursor, or any MCP-compatible AI agent.

✅ 27 document types (NDAs, contracts, tenancy agreements, privacy policies)
✅ 18 jurisdictions (Nigeria, Canada, UK, US, India, Kenya, Ghana, UAE...)
✅ Free tier: 5 documents/month

Built for:
- Freelancers protecting their work
- Small businesses formalizing agreements
- AI agents automating legal workflows

Try it free: https://smithery.ai/server/@ebenova/legal-docs-mcp

#LegalTech #AI #MCP #Automation #Africa #Nigeria
```

### 2. Post to Communities

- **Reddit:** r/ClaudeAI, r/artificial, r/webdev
- **Indie Hackers:** "Just launched my MCP server"
- **Product Hunt:** (separate launch, April 21)
- **Twitter AI Builder Community**

### 3. Update Documentation

Add Smithery installation to:
- `README.md` (GitHub)
- `ebenova.dev/docs` (website)
- `npmjs.com/package/@ebenova/legal-docs-mcp`

---

## METRICS TO TRACK

After publishing, monitor:

| Metric | Where | Target |
|--------|-------|--------|
| **Smithery Installs** | Smithery Dashboard | 100+ in first month |
| **NPM Downloads** | npmjs.com dashboard | 500+ in first month |
| **API Signups** | ebenova.dev dashboard | 50+ from MCP |
| **GitHub Stars** | github.com/ebenova/legal-docs-mcp | 200+ |
| **Smithery Rating** | Smithery page | 4.5+ stars |

---

## NEXT STEPS

1. **Publish to Smithery** (today)
   ```bash
   cd c:\projects\signova\mcp-servers\legal-docs
   smithery publish
   ```

2. **Verify Publishing** (5 minutes after)
   - Visit Smithery page
   - Test installation

3. **Share on Social** (today)
   - Twitter/X post
   - LinkedIn post
   - Reddit post

4. **Monitor Metrics** (weekly)
   - Check Smithery dashboard
   - Check npm downloads
   - Check API signups

5. **Iterate** (based on feedback)
   - Add more document types
   - Improve tool descriptions
   - Add more examples

---

**Good luck with the launch!** 🚀

**Questions?** api@ebenova.dev
