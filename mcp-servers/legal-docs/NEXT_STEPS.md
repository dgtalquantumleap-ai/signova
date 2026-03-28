# ═══════════════════════════════════════════════════════════════
# SMITHERY PUBLISHING — NEXT STEPS CHECKLIST
# ═══════════════════════════════════════════════════════════════
# 
# Status: Configuration complete, ready to publish
# Date: March 28, 2026
# 
# ═══════════════════════════════════════════════════════════════

---

## ✅ WHAT'S DONE

| Task | Status | File |
|------|--------|------|
| Smithery CLI installed | ✅ Complete | `@smithery/cli` v1.0.0 |
| Server metadata created | ✅ Complete | `public/.well-known/mcp/server-card.json` |
| Config schema added | ✅ Complete | `package.json` (smithery field) |
| Smithery config file | ✅ Complete | `mcp-servers/legal-docs/smithery.yaml` |
| README for Smithery | ✅ Complete | `README_SMITHERY.md` |
| Publishing guide | ✅ Complete | `SMITHERY_PUBLISHING_GUIDE.md` |
| Quick start guide | ✅ Complete | `PUBLISH_NOW.md` |
| Publishing script | ✅ Complete | `publish-to-smithery.bat` |
| Social media kit | ✅ Complete | `SOCIAL_MEDIA_KIT.md` |
| Git commit & push | ✅ Complete | All files pushed to main |

---

## 🎯 IMMEDIATE NEXT STEPS (Do Today)

### Step 1: Get Smithery API Key (2 minutes)

1. **Visit:** https://smithery.ai/account/api-keys
2. **Login:** Use Google account (dgtalquantumleap@gmail.com)
3. **Create:** Click "Create New API Key"
4. **Copy:** Save the key (starts with `sk_smithery_...`)

⚠️ **Keep this secret!** Don't share or commit to git.

---

### Step 2: Publish to Smithery (5 minutes)

**Option A: Use the batch script (Easiest)**

```bash
cd c:\projects\signova\mcp-servers\legal-docs
publish-to-smithery.bat
```

The script will:
1. Check if Smithery CLI is installed
2. Prompt for your API key
3. Publish to Smithery
4. Show success/failure message

**Option B: Manual CLI publish**

```bash
cd c:\projects\signova\mcp-servers\legal-docs

# Set API key
set SMITHERY_API_KEY=sk_smithery_your_key_here

# Publish
smithery publish
```

**Option C: GitHub method (No API key needed)**

```bash
# 1. Create GitHub repo
cd c:\projects\signova\mcp-servers\legal-docs
gh repo create ebenova/legal-docs-mcp --public --source=. --remote=origin --push

# 2. Submit to Smithery manually
# Visit: https://smithery.ai/publish
# Enter: https://github.com/ebenova/legal-docs-mcp
```

---

### Step 3: Verify Publishing (2 minutes)

After publishing, verify:

1. **Smithery page loads:**
   - URL: https://smithery.ai/server/@ebenova/legal-docs-mcp
   - Should show: Server name, description, install button

2. **API key prompt appears:**
   - Click "Install"
   - Should prompt for `EBENOVA_API_KEY`
   - This confirms `configSchema` is working

3. **Test installation:**
   ```bash
   smithery install @ebenova/legal-docs-mcp
   ```
   - Should install without errors
   - Should configure Claude Desktop automatically

---

## 📅 POST-PUBLISHING (Do Within 24 Hours)

### Step 4: Add Smithery Badge to GitHub (5 minutes)

Add to top of `README.md` (both GitHub and npm):

```markdown
[![Smithery](https://smithery.ai/badge/@ebenova/legal-docs-mcp)](https://smithery.ai/server/@ebenova/legal-docs-mcp)
```

---

### Step 5: Share on Social Media (30 minutes)

**Twitter/X** (9-11 AM PT for max visibility):
```
Just published my MCP server to Smithery! 🚀

Generate professional legal documents (NDAs, contracts, tenancy agreements) directly from Claude Desktop.

✅ 27 document types
✅ 18 jurisdictions (Nigeria, Canada, UK, US, India + more)
✅ Free tier: 5 docs/month

Try it free: https://smithery.ai/server/@ebenova/legal-docs-mcp

#MCP #AI #LegalTech #ClaudeAI #Nigeria
```

**LinkedIn** (8-10 AM PT):
- Use "Option 1 — Professional announcement" from `SOCIAL_MEDIA_KIT.md`
- Tag: Smithery, Anthropic, MCP community
- Add personal story in comments

**Reddit** (6-8 AM PT):
- r/ClaudeAI: "Just published an MCP server for generating legal documents"
- r/IndieHackers: "Solo founder, non-technical, AI-assisted. Published in 30 days."
- r/webdev: "Built a multi-jurisdiction legal document API (technical deep-dive)"

Use posts from `SOCIAL_MEDIA_KIT.md`.

---

### Step 6: Monitor Metrics (Ongoing)

**Check daily for first week:**

| Metric | Where | Target (Week 1) |
|--------|-------|-----------------|
| Smithery Installs | Smithery Dashboard | 50+ |
| NPM Downloads | npmjs.com dashboard | 200+ |
| API Signups | ebenova.dev dashboard | 25+ |
| GitHub Stars | github.com/ebenova | 100+ |
| Smithery Rating | Smithery page | 5.0 stars |

---

## 📆 WEEK 2 ACTIONS

### Step 7: Collect User Feedback

**After 50+ installs:**
1. **Email users:** Send satisfaction survey
2. **GitHub Issues:** Monitor for bug reports
3. **Smithery Reviews:** Read and respond to reviews
4. **Twitter Mentions:** Track and engage

**Survey questions:**
- What document type did you generate?
- Which jurisdiction?
- Was the output useful?
- What would you improve?
- Would you recommend to others?

---

### Step 8: Iterate Based on Feedback

**Common requests:**
- More document types → Add to roadmap
- More jurisdictions → Prioritize by demand
- Better AI responses → Improve prompts
- SDK improvements → Update npm package

**Update frequency:**
- Bug fixes: Within 24 hours
- Feature requests: Weekly batch
- Major updates: Monthly releases

---

## 📆 MONTH 1 ACTIONS

### Step 9: Product Hunt Launch (April 21, 2026)

**Coordinate with MCP server launch:**
- Launch Ebenova API platform on Product Hunt
- Mention Smithery integration
- Goal: #1 Product of the Day

**Prep work:**
- Create Product Hunt post (see `PRODUCT_HUNT_LAUNCH.md`)
- Gather user testimonials
- Prepare demo video
- Schedule social media blitz

---

### Step 10: Content Marketing

**Dev.to article:**
- Title: "How I Built a Multi-Jurisdiction Legal API in 30 Days"
- Include: Technical architecture, challenges, solutions
- Link to: Smithery page, GitHub, API docs
- Cross-post: Hashnode, Medium, LinkedIn

**YouTube tutorial:**
- Title: "Generate Legal Documents with Claude Desktop + Ebenova MCP"
- Length: 10-15 minutes
- Show: Installation, example usage, output
- Link in description: Smithery, GitHub, API

---

## 🎯 SUCCESS METRICS (30 Days)

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Smithery Installs | 500+ | 1,000+ |
| NPM Downloads | 1,000+ | 2,500+ |
| API Signups | 200+ | 500+ |
| GitHub Stars | 300+ | 750+ |
| Smithery Rating | 4.5+ stars | 5.0 stars |
| Paying Customers | 25+ | 100+ |
| MRR | $500+ | $2,000+ |

---

## 🆘 TROUBLESHOOTING

### "Invalid API key"
- Double-check you copied entire key
- Ensure no extra spaces
- Try regenerating the key

### "Repository not found" (GitHub method)
- Make sure repo is **public**
- Wait 1-2 minutes after pushing
- Try: `gh repo view` to verify

### "No config schema found"
- Ensure `package.json` has `smithery` field
- Ensure `server-card.json` exists
- Re-run: `smithery publish`

### "Connection error: 405"
- **This is expected!** Your server uses stdio transport
- Smithery handles this via configuration files
- Ignore this error

### Low install numbers
- Improve Smithery page description
- Add more examples to README
- Share on more channels (Discord, Slack communities)
- Ask satisfied users for reviews

---

## 📞 SUPPORT RESOURCES

**Documentation:**
- Smithery Publishing Guide: `SMITHERY_PUBLISHING_GUIDE.md`
- Quick Start: `PUBLISH_NOW.md`
- Social Media Kit: `SOCIAL_MEDIA_KIT.md`
- Full API Docs: https://ebenova.dev/docs

**Contact:**
- Email: api@ebenova.dev
- GitHub: https://github.com/ebenova/legal-docs-mcp
- Smithery: https://smithery.ai/server/@ebenova/legal-docs-mcp

**Community:**
- Smithery Discord: https://smithery.ai/discord
- MCP Community: https://modelcontextprotocol.io
- Indie Hackers: https://indiehackers.com

---

## ✅ FINAL CHECKLIST

**Before publishing:**
- [ ] Smithery API key obtained
- [ ] All config files committed
- [ ] README updated with Smithery badge
- [ ] Social media posts drafted

**Day of publishing:**
- [ ] Published to Smithery
- [ ] Verified Smithery page loads
- [ ] Tested installation
- [ ] Shared on Twitter/X
- [ ] Shared on LinkedIn
- [ ] Posted to Reddit
- [ ] Posted to Indie Hackers

**Week after:**
- [ ] Monitoring metrics daily
- [ ] Responding to comments
- [ ] Collecting user feedback
- [ ] Planning iterations

**Month after:**
- [ ] Hit 500+ installs
- [ ] 25+ paying customers
- [ ] Product Hunt launch prep
- [ ] Content marketing (Dev.to, YouTube)

---

**You're ready to launch!** 🚀

**Next action:** Get Smithery API key at https://smithery.ai/account/api-keys

**Questions?** See `SMITHERY_PUBLISHING_GUIDE.md` or email api@ebenova.dev
