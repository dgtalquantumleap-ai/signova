# ═══════════════════════════════════════════════════════════════
# SMITHERY PUBLISHING — MANUAL STEPS
# ═══════════════════════════════════════════════════════════════
# 
# The Smithery CLI requires interactive input.
# Follow these exact steps to publish.
# 
# ═══════════════════════════════════════════════════════════════

---

## YOUR SMITHERY API KEY

**Key:** `26f39a8a-6cd8-4f0e-9dcc-edb95aa99783`

⚠️ **Keep this secret!** Don't share it publicly.

---

## PUBLISHING STEPS

### Step 1: Open Terminal

Open a **new** terminal window (Command Prompt or PowerShell).

### Step 2: Navigate to MCP Server Directory

```bash
cd c:\projects\signova\mcp-servers\legal-docs
```

### Step 3: Run Publish Command

```bash
smithery publish
```

### Step 4: When Prompted for API Key

The CLI will show:
```
? Please enter your Smithery API key (get one for free from 
https://smithery.ai/account/api-keys):
```

**Paste your key:**
```
26f39a8a-6cd8-4f0e-9dcc-edb95aa99783
```

Press **Enter**.

### Step 5: When Prompted for Server Name

The CLI will show:
```
? Enter server name (will be published as ebenova/<name>):
```

**Enter:**
```
ebenova-legal-docs
```

Press **Enter**.

### Step 6: Wait for Publishing

The CLI will show progress:
```
✓ Publishing to Smithery...
✓ Server metadata uploaded
✓ Configuration validated
✓ Published successfully!
```

### Step 7: Verify Publishing

After successful publishing:

1. **Visit your Smithery page:**
   https://smithery.ai/server/@ebenova/ebenova-legal-docs

2. **Check your dashboard:**
   https://smithery.ai/dgtalquantumleap@gmail.com

3. **Test installation:**
   ```bash
   smithery install @ebenova/ebenova-legal-docs
   ```

---

## ALTERNATIVE: Publish via GitHub (No CLI)

If the CLI doesn't work, use GitHub:

### Step A: Create GitHub Repository

```bash
cd c:\projects\signova\mcp-servers\legal-docs

# Initialize git (if not already done)
git init
git add .
git commit -m "MCP server for Smithery"

# Create GitHub repo
gh repo create ebenova/ebenova-legal-docs --public --source=. --remote=origin --push
```

**Or manually:**
1. Go to github.com/new
2. Repository name: `ebenova-legal-docs`
3. Owner: `ebenova`
4. Public
5. Create repository
6. Follow push instructions

### Step B: Submit to Smithery

1. **Visit:** https://smithery.ai/publish
2. **Login:** dgtalquantumleap@gmail.com
3. **Enter repository URL:** 
   `https://github.com/ebenova/ebenova-legal-docs`
4. **Click:** "Scan Repository"
5. **Review:** Discovered metadata
6. **Fill in:**
   - Name: `ebenova-legal-docs`
   - Description: "Generate professional legal documents via API"
   - Category: "Productivity" or "Business"
7. **Click:** "Publish"

---

## TROUBLESHOOTING

### "Invalid API key"
- Ensure you copied the entire key: `26f39a8a-6cd8-4f0e-9dcc-edb95aa99783`
- No extra spaces before or after
- Try regenerating at https://smithery.ai/account/api-keys

### "Server name already taken"
- Try: `ebenova-legal-docs-mcp`
- Or: `ebenova-legal`

### "Connection error: 405"
- **This is expected!** Your server uses stdio transport
- Smithery handles this via configuration files
- Ignore this error

### "No config schema found"
- Ensure `package.json` has the `smithery` field
- Ensure `public/.well-known/mcp/server-card.json` exists

---

## AFTER PUBLISHING

### 1. Add Smithery Badge to README

Add to top of `README.md`:

```markdown
[![Smithery](https://smithery.ai/badge/@ebenova/ebenova-legal-docs)](https://smithery.ai/server/@ebenova/ebenova-legal-docs)
```

### 2. Share on Social Media

**Twitter/X:**
```
Just published my MCP server to Smithery! 🚀

Generate professional legal documents (NDAs, contracts, tenancy agreements) directly from Claude Desktop.

✅ 27 document types
✅ 18 jurisdictions (Nigeria, Canada, UK, US, India + more)
✅ Free tier: 5 docs/month

Try it free: https://smithery.ai/server/@ebenova/ebenova-legal-docs

#MCP #AI #LegalTech #ClaudeAI
```

**LinkedIn:**
- Use "Option 1 — Professional announcement" from `SOCIAL_MEDIA_KIT.md`

**Reddit:**
- r/ClaudeAI: "Just published an MCP server for generating legal documents"
- Use posts from `SOCIAL_MEDIA_KIT.md`

---

## SUCCESS METRICS (First 30 Days)

| Metric | Target | Where |
|--------|--------|-------|
| Smithery Installs | 500+ | Smithery Dashboard |
| NPM Downloads | 1,000+ | npmjs.com |
| API Signups | 200+ | ebenova.dev |
| GitHub Stars | 300+ | github.com |
| Smithery Rating | 4.5+ | Smithery page |

---

**You're ready to publish!** 🚀

**Questions?** See `SMITHERY_PUBLISHING_GUIDE.md` or email api@ebenova.dev
