# ═══════════════════════════════════════════════════════════════
# SMITHERY PUBLISHING — MANUAL STEPS
# ═══════════════════════════════════════════════════════════════
# 
# The Smithery CLI requires an API key for authentication.
# Follow these steps to complete the publishing.
# 
# ═══════════════════════════════════════════════════════════════

---

## STEP 1: Get Your Smithery API Key

1. **Visit:** https://smithery.ai/account/api-keys
2. **Login** with your Google account (dgtalquantumleap@gmail.com)
3. **Click** "Create New API Key"
4. **Copy** the generated key (starts with `sk_smithery_...`)

**⚠️ Keep this key secret! Don't share it or commit it to git.**

---

## STEP 2: Publish via CLI

Open a new terminal and run:

```bash
cd c:\projects\signova\mcp-servers\legal-docs

# Set API key as environment variable (replace with your actual key)
set SMITHERY_API_KEY=sk_smithery_your_actual_key_here

# Publish
smithery publish
```

**Alternative: Use config file**

Create `~/.smithery/config.json`:

```json
{
  "apiKeys": {
    "smithery": "sk_smithery_your_actual_key_here"
  }
}
```

Then run:
```bash
smithery publish
```

---

## STEP 3: Alternative — Publish via GitHub (No API Key Needed)

If you don't want to use the CLI, publish via GitHub:

### 3a. Create GitHub Repository

```bash
cd c:\projects\signova\mcp-servers\legal-docs

# Initialize git (if not already done)
git init
git add .
git commit -m "MCP server for Smithery"

# Create GitHub repo (requires GitHub CLI)
gh repo create ebenova/legal-docs-mcp --public --source=. --remote=origin --push

# OR manually:
# 1. Go to github.com/new
# 2. Repository name: legal-docs-mcp
# 3. Owner: ebenova
# 4. Public
# 5. Create repository
# 6. Follow push instructions
```

### 3b. Submit to Smithery

1. **Visit:** https://smithery.ai/publish
2. **Login** with your Google account
3. **Enter repository URL:** `https://github.com/ebenova/legal-docs-mcp`
4. **Click** "Scan Repository"
5. **Review** discovered metadata
6. **Fill in** any missing fields:
   - Name: `ebenova-legal-docs`
   - Description: "Generate professional legal documents via API"
   - Category: "Productivity" or "Business"
7. **Click** "Publish"

---

## STEP 4: Verify Publishing

After publishing, verify:

1. **Smithery Page:** https://smithery.ai/server/@ebenova/legal-docs-mcp
2. **Your Dashboard:** https://smithery.ai/dgtalquantumleap@gmail.com
3. **Test Installation:**
   ```bash
   smithery install @ebenova/legal-docs-mcp
   ```

---

## STEP 5: Add Smithery Badge to README

Add this to the top of `README.md` (GitHub):

```markdown
[![Smithery](https://smithery.ai/badge/@ebenova/legal-docs-mcp)](https://smithery.ai/server/@ebenova/legal-docs-mcp)
```

---

## TROUBLESHOOTING

### "Invalid API key"
- Double-check you copied the entire key
- Ensure no extra spaces
- Try regenerating the key

### "Repository not found"
- Make sure your GitHub repo is **public**
- Wait 1-2 minutes after pushing for GitHub to process

### "No config schema found"
- Ensure `package.json` has the `smithery` field
- Ensure `server-card.json` exists at `public/.well-known/mcp/`

### "Connection error: 405"
- **This is expected!** Your server uses stdio transport (correct for Claude Desktop)
- Smithery will handle this via the configuration files you created
- Ignore this error

---

## QUICK COMMAND REFERENCE

```bash
# Install Smithery CLI
npm install -g @smithery/cli

# Login
smithery login

# Publish
cd c:\projects\signova\mcp-servers\legal-docs
smithery publish

# Install (test your own server)
smithery install @ebenova/legal-docs-mcp

# List installed servers
smithery list
```

---

## NEXT ACTIONS

**Right Now:**
1. [ ] Get Smithery API key from https://smithery.ai/account/api-keys
2. [ ] Run `smithery publish` with API key
3. [ ] Verify Smithery page loads

**After Publishing:**
1. [ ] Add Smithery badge to GitHub README
2. [ ] Share on Twitter/X
3. [ ] Share on LinkedIn
4. [ ] Post to Reddit (r/ClaudeAI)

---

**Questions?** See `SMITHERY_PUBLISHING_GUIDE.md` for full details.

**API Key Needed:** https://smithery.ai/account/api-keys
