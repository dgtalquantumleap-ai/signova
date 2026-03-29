# EBENOVA SESSION LOG — March 29, 2026
## Complete Build Log: API Platform, MCP Server, Stripe, Distribution

**Session Start:** March 28, 2026 (late night) → March 29, 2026
**Founder:** Olumide Akinsola
**Session Type:** Technical build + strategy

---

## WHAT WAS ACCOMPLISHED THIS SESSION

### 1. API PLATFORM — api.ebenova.dev ✅ LIVE

**Endpoints verified working (via test-api.js):**
| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /v1/documents/types | ✅ Live | Returns 27 document types |
| POST /v1/documents/generate | ✅ Live | Full AI document generation |
| POST /v1/extract/conversation | ✅ Live | WhatsApp/chat extraction |
| GET /v1/keys/usage | ✅ Live | Returns tier + usage stats |
| OPTIONS (CORS) | ✅ Live | All origins allowed |

**Infrastructure confirmed:**
- Upstash Redis: ✅ Connected (URL + token in .env.production)
- Anthropic API: ✅ Connected
- Vercel deployment: ✅ Live at api.ebenova.dev
- CORS headers: ✅ All endpoints

---

### 2. NPM PACKAGES PUBLISHED ✅

| Package | Version | Purpose |
|---------|---------|---------|
| ebenova-legal-docs | 1.0.0 | Node.js SDK (client library) |
| ebenova-legal-docs-mcp | 1.0.2 | MCP server for Claude Desktop/Cursor |

**npm account:** Logged in and authenticated via browser OAuth.

---

### 3. MCP SERVER — ebenova/legal-docs ✅ LIVE

**File location:** `C:\projects\signova\mcp-servers\legal-docs\`
**GitHub repo:** `https://github.com/dgtalquantumleap-ai/legal-docs-mcp`

**Tools exposed:**
- `generate_legal_document` — 27 types, 18 jurisdictions
- `extract_from_conversation` — WhatsApp/email → document fields
- `list_document_types` — returns all 27 types grouped
- `check_usage` — quota and usage stats

**Distribution status:**
| Platform | Status | URL |
|----------|--------|-----|
| npm | ✅ Published | npmjs.com/package/ebenova-legal-docs-mcp |
| Smithery | ✅ Listed | smithery.ai/server/ebenova/legal-docs |
| Glama | ✅ glama.json exists (fix pushed) | Submit at glama.ai/mcp/servers/submit |
| Claude Desktop | ✅ Config written to machine | %APPDATA%\Claude\claude_desktop_config.json |
| mcp.so | ❌ Not submitted | GitHub form — 5 minutes |
| OpenTools | ❌ Not submitted | Simple listing — 5 minutes |

**Claude Desktop config (written to machine):**
```json
{
  "mcpServers": {
    "ebenova-legal": {
      "command": "npx",
      "args": ["-y", "ebenova-legal-docs-mcp"],
      "env": {
        "EBENOVA_API_KEY": "sk_live_9d23da78d0a2c029a17ab1d4c6051969427f96f29a4f782e"
      }
    }
  }
}
```

---

### 4. STRIPE SUBSCRIPTION BILLING ✅ CONFIGURED

**Products created in Stripe (Ebenova Solutions account):**
| Tier | Price/month | Stripe Price ID |
|------|-------------|-----------------|
| Starter | $29 | price_1TGC1BJlikfX3kyVQ6Pjz65i |
| Growth | $79 | price_1TGC2zJlikfX3kyVtP1yUhvg |
| Scale | $199 | price_1TGC4bJlikfX3kyVPqMN2Wpu |

**Added to:**
- ✅ C:\projects\signova\.env.production
- ✅ Vercel environment variables (production)
- ✅ Deployed to api.ebenova.dev

**Billing endpoint:** `POST /v1/billing/checkout` — creates Stripe Checkout session.
**File:** `api/v1/billing/checkout.js`

**Note on $4.99 consumer checkout:**
- Uses Stripe (not Polar — Polar rejected product)
- File: `api/stripe-checkout.js`
- Uses inline `price_data` — does NOT need a Stripe Price ID env var
- Already working with just STRIPE_SECRET_KEY

---

### 5. SCOPE GUARD — DOMAIN FIX ✅

**Problem found:** ScopeGuard.jsx had `ebenova.dev` branding hardcoded despite being
a consumer Signova feature (not an API product).

**Files fixed:**
- `src/pages/ScopeGuard.jsx` — nav logo, footer logo, canonical URL all changed to getsignova.com
- `api/scope-guard-waitlist.js` — confirmation email link changed from ebenova.dev to getsignova.com

**Correct placement:** getsignova.com/scope-guard (consumer waitlist page)
**Route:** `/scope-guard` in App.jsx — correct, stays in Signova codebase

---

### 6. DOCS PAGE — MCP SECTION UPDATED ✅

**File:** `src/pages/Docs.jsx`

**Changes made:**
- Corrected npm package name: `ebenova-legal-docs-mcp` (not `@ebenova/legal-docs-mcp`)
- Added config file location table (macOS, Windows, Cursor)
- Added 4 example prompts
- Added links to Smithery listing and GitHub repo

---

### 7. GLAMA.JSON FIX ✅

**File:** `mcp-servers/legal-docs/glama.json`
**Fix:** npm install command corrected from `@ebenova/legal-docs-mcp` to `ebenova-legal-docs-mcp`
**Status:** Committed, push pending (needs `git pull --rebase` first)

---

## ENVIRONMENT VARIABLES — COMPLETE LIST

### Vercel Production (confirmed set):
```
ADMIN_SECRET                ✅ Set
ANTHROPIC_API_KEY           ✅ Set
BYPASS_ADMIN_SECRET         ✅ Set
GROQ_API_KEY                ✅ Set
OXAPAY_MERCHANT_KEY         ✅ Set
POLAR_ACCESS_TOKEN          ✅ Set (legacy — not used for checkout)
POLAR_PRODUCT_ID            ✅ Set (legacy — not used for checkout)
PROMO_SECRET                ✅ Set
RESEND_API_KEY              ✅ Set
STRIPE_SECRET_KEY           ✅ Set (live key)
STRIPE_PRICE_STARTER        ✅ Set — price_1TGC1BJlikfX3kyVQ6Pjz65i
STRIPE_PRICE_GROWTH         ✅ Set — price_1TGC2zJlikfX3kyVtP1yUhvg
STRIPE_PRICE_SCALE          ✅ Set — price_1TGC4bJlikfX3kyVPqMN2Wpu
UPSTASH_REDIS_REST_URL      ✅ Set — https://faithful-satyr-80384.upstash.io
UPSTASH_REDIS_REST_TOKEN    ✅ Set
```

### Missing (not yet needed):
```
STRIPE_WEBHOOK_SECRET       ❌ Not set — needed for subscription lifecycle events
STRIPE_PRICE_PRO            ❌ Not set — Pro tier ($19.99 Scope Guard) not created yet
```

---

## BETA KEYS — READY TO SEND

**File:** `C:\projects\signova\BETA_KEYS.md`
**Status:** Keys created 2026-03-28. Emails NOT yet sent.

| Recipient | Email | Tier | Key |
|-----------|-------|------|-----|
| Klauza Founder | klauza@founder.com | Growth (500/mo) | sk_live_e96caab1... |
| CrossMind (Ivan Lee) | ivan@crossmind.ai | Growth (500/mo) | sk_live_d685655d... |
| Some_Phrase_2373 | somephrase@founder.com | Starter (100/mo) | sk_live_1c6d700d... |
| Wadim (DACH) | wadim@dach-founder.com | Starter (100/mo) | sk_live_41c3c64c... |
| Reserve | beta5@ebenova.dev | Starter (100/mo) | sk_live_dfa1d7e7... |

**Action needed:** Send invitation emails. Delete BETA_KEYS.md after sending.

---

## REMAINING BLOCKERS

### IMMEDIATE (do today):
1. **Git push glama.json fix:**
   ```powershell
   cd C:\projects\signova\mcp-servers\legal-docs
   git pull --rebase
   git push
   ```

2. **Send beta emails** — keys are ready, addresses are confirmed

3. **Submit to mcp.so** — go to mcp.so, submit GitHub URL (5 min)

4. **Submit to OpenTools** — opentools.ai (5 min)

### THIS WEEK:
5. **Add Invoice API to MCP server** — `generate_invoice` tool in src/index.js
6. **Add Invoice API to Docs page** — curl examples in Docs.jsx
7. **Test Invoice API live** — one curl call to verify

### MONTH 2:
8. **Build Scope Guard API** — POST /v1/scope/analyze endpoint
9. **Stripe webhook** — needed for subscription lifecycle (cancel, upgrade, downgrade)

---

## DUPLICATE SMITHERY LISTINGS — CLEAN UP

Three listings exist under `ebenova` namespace on Smithery:
- `ebenova/legal-docs` ← KEEP THIS ONE
- `ebenova/ebenova-solutions` ← DELETE
- `ebenova/legal-docs-mcp` ← DELETE

**How:** smithery.ai → log in → My Servers → delete the two duplicates

---

## NEXT APIS TO BUILD (ranked by effort vs revenue)

### #1 — Invoice API (2 days, already built)
- Code: `api/v1/invoices/generate.js` ✅ Complete
- Needs: Add to MCP server, add to docs, test live
- Revenue: Same subscription tiers, cross-sell to legal docs users

### #2 — Scope Guard API (2 weeks, after first revenue)
- Endpoints: POST /v1/scope/analyze, POST /v1/scope/change-order
- Spec: `C:\projects\signova\SCOPE_GUARD_SPEC.md` ✅ Complete
- Revenue: Highest-value endpoint, justifies Growth tier alone

### #3 — Freelancer Risk Score API (new, 1 week)
- No competitor has this
- POST /v1/freelancer/risk-score — AI assessment given client name/platform/country
- Revenue: Unique differentiator for developer tools targeting freelancers

### #4 — WhatsApp-to-Invoice Pipeline (extends existing, 3 days)
- Extends existing extraction endpoint
- POST /v1/extract/conversation with target_document: "invoice"
- Revenue: Pairs with Invoice API

---

## DOMAIN ARCHITECTURE (confirmed correct)

```
ebenova.dev          → API platform landing (ApiLanding.jsx)
api.ebenova.dev      → All API endpoints (/v1/...)
ebenova.dev/docs     → API documentation
ebenova.dev/dashboard → API key management (future)

getsignova.com       → Consumer legal doc generator
getsignova.com/scope-guard → Scope Guard waitlist (consumer)
getsignova.com/generate/:type → Document generator
getsignova.com/preview → Payment + download flow
```

Both domains served from same Vercel deployment (signova repo).
Domain routing handled by RootPage() in App.jsx:
- ebenova.dev → ApiLanding
- getsignova.com → Landing (consumer)

---

## PAYMENT ARCHITECTURE (confirmed correct)

```
$4.99 one-time (consumer)  → Stripe (stripe-checkout.js, inline price_data)
USDT crypto (Nigeria)       → OxaPay (oxapay-checkout.js)
API subscriptions           → Stripe (v1/billing/checkout.js, Price IDs)
```

---

## GIT REPOS

| Repo | URL | What's in it |
|------|-----|-------------|
| signova (main) | github.com/dgtalquantumleap-ai/signova | Full platform |
| legal-docs-mcp | github.com/dgtalquantumleap-ai/legal-docs-mcp | MCP server |

---

## DEPLOYMENT COMMAND

```powershell
cd C:\projects\signova
npx vercel --prod
```

Last successful deploy: March 29, 2026
Production URL: https://signova-iwaxhjcd5-ebenovasolu-5755s-projects.vercel.app
Alias: https://api.ebenova.dev ✅

---

*Log created: March 29, 2026*
*Next review: When first paying API customer signs up*
