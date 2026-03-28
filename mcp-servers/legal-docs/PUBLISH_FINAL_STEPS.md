# ═══════════════════════════════════════════════════════════════
# SMITHERY PUBLISHING — FINAL STEPS
# ═══════════════════════════════════════════════════════════════
# 
# Status: Configuration complete, need to create GitHub repo
# GitHub: Repository doesn't exist yet (404)
# 
# ═══════════════════════════════════════════════════════════════

---

## CURRENT STATUS

✅ Smithery CLI installed
✅ API key ready: `26f39a8a-6cd8-4f0e-9dcc-edb95aa99783`
✅ MCP server files ready in: `c:\projects\signova\mcp-servers\legal-docs`
✅ `src/index.js` created
✅ `package.json` configured with entryPoint
✅ All configuration files created

❌ GitHub repository doesn't exist (404)
❌ Smithery page not published yet

---

## OPTION 1: CREATE GITHUB REPO + PUBLISH TO SMITHERY (Recommended)

### Step 1: Create GitHub Repository

1. **Visit:** https://github.com/new
2. **Login:** Use your GitHub account (dgtalquantumleap-ai)
3. **Repository name:** `legal-docs-mcp`
4. **Owner:** `dgtalquantumleap-ai` (or create `ebenova` organization)
5. **Visibility:** Public (required for Smithery)
6. **DO NOT initialize** (no README, .gitignore, or license)
7. **Click:** "Create repository"

### Step 2: Push MCP Server to GitHub

Open **PowerShell** or **Command Prompt**:

```bash
# Navigate to MCP server directory
cd c:\projects\signova\mcp-servers\legal-docs

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial MCP server release"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/dgtalquantumleap-ai/legal-docs-mcp.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Verify:** Visit https://github.com/dgtalquantumleap-ai/legal-docs-mcp
You should see your MCP server files.

### Step 3: Submit to Smithery

1. **Visit:** https://smithery.ai/publish
2. **Login:** dgtalquantumleap@gmail.com
3. **Enter repository URL:** 
   ```
   https://github.com/dgtalquantumleap-ai/legal-docs-mcp
   ```
4. **Click:** "Scan Repository"
5. **Wait** for Smithery to scan (30 seconds)
6. **Review** discovered metadata:
   - Name: `ebenova-legal-docs`
   - Description: Should auto-populate from package.json
7. **Fill in** any missing fields:
   - Category: "Productivity" or "Business"
   - Tags: legal, documents, contracts, nda, mcp
8. **Click:** "Publish"

### Step 4: Verify Publishing

After publishing:

1. **Smithery page:** https://smithery.ai/server/@ebenova/ebenova-legal-docs
2. **Should show:**
   - Server name: `ebenova-legal-docs`
   - Description
   - Install button
   - API key prompt

---

## OPTION 2: RUN SMITHERY CLI PUBLISH (Interactive)

If you prefer to use the CLI directly:

### Step 1: Navigate to MCP Directory

```bash
cd c:\projects\signova\mcp-servers\legal-docs
```

### Step 2: Run Publish Command

```bash
smithery publish
```

### Step 3: When Prompted

**Prompt 1:**
```
? Please enter your Smithery API key:
```
**Enter:** `26f39a8a-6cd8-4f0e-9dcc-edb95aa99783`

**Prompt 2:**
```
? Enter server name (will be published as ebenova/<name>):
```
**Enter:** `ebenova-legal-docs`

### Step 4: Wait for Success

```
Building shttp bundle for Smithery deploy...
✓ Bundle created
✓ Server metadata uploaded
✓ Configuration validated
✓ Published successfully!

Your server is live at:
https://smithery.ai/server/@ebenova/ebenova-legal-docs
```

---

## OPTION 3: USE THE BATCH SCRIPT

```bash
cd c:\projects\signova\mcp-servers\legal-docs
publish-to-smithery.bat
```

The script will:
1. Check if Smithery CLI is installed
2. Prompt for API key
3. Run `smithery publish`
4. Show success/failure

---

## TROUBLESHOOTING

### "Repository not found" (GitHub)
- Make sure repo is **public** (Settings → Change visibility)
- Wait 1-2 minutes after pushing
- Try: `git push -u origin main` again

### "No package.json found" (Smithery)
- Ensure `package.json` exists in repo root
- Ensure it has the `smithery` field with `configSchema`

### "Entry point not found"
- Ensure `src/index.js` exists
- Ensure `package.json` has `"module": "src/index.js"`

### "Connection error: 405"
- **This is expected!** Your server uses stdio transport
- Smithery handles this via configuration files
- Ignore this error

---

## AFTER PUBLISHING

### 1. Verify Smithery Page

Visit: https://smithery.ai/server/@ebenova/ebenova-legal-docs

**Should show:**
- ✅ Server name: `ebenova-legal-docs`
- ✅ Description
- ✅ Install button
- ✅ API key prompt when clicking Install

### 2. Add Smithery Badge to README

Add to top of `README.md` (GitHub repo):

```markdown
[![Smithery](https://smithery.ai/badge/@ebenova/ebenova-legal-docs)](https://smithery.ai/server/@ebenova/ebenova-legal-docs)
```

### 3. Share on Social Media

**Twitter/X:**
```
Just published my MCP server to Smithery! 🚀

Generate professional legal documents (NDAs, contracts, tenancy agreements) directly from Claude Desktop.

✅ 27 document types
✅ 18 jurisdictions (Nigeria, Canada, UK, US, India + more)
✅ Free tier: 5 docs/month

Try it free: https://smithery.ai/server/@ebenova/ebenova-legal-docs

#MCP #AI #LegalTech #ClaudeAI #Nigeria
```

**Use more posts from:** `SOCIAL_MEDIA_KIT.md`

---

## QUICK COMMAND REFERENCE

```bash
# Navigate to MCP server
cd c:\projects\signova\mcp-servers\legal-docs

# Push to GitHub (after creating repo)
git add .
git commit -m "MCP server"
git remote add origin https://github.com/dgtalquantumleap-ai/legal-docs-mcp.git
git push -u origin main

# Publish via CLI
smithery publish

# Test installation
smithery install @ebenova/ebenova-legal-docs
```

---

## NEXT ACTIONS (In Order)

**Right Now:**
1. [ ] Create GitHub repo at https://github.com/new
2. [ ] Push MCP server files to GitHub
3. [ ] Submit to Smithery at https://smithery.ai/publish
4. [ ] Verify Smithery page loads

**After Publishing:**
1. [ ] Add Smithery badge to GitHub README
2. [ ] Share on Twitter/X
3. [ ] Share on LinkedIn
4. [ ] Post to Reddit (r/ClaudeAI, r/IndieHackers)

---

**You're almost there!** 🚀

**Questions?** See `SMITHERY_PUBLISHING_GUIDE.md` or email api@ebenova.dev
