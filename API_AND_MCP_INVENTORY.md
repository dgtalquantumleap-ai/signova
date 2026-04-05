# API & MCP Inventory — Signova Project

> Last updated: April 4, 2026

---

## TABLE OF CONTENTS
1. [MCP Servers (3 standalone npm packages)](#mcp-servers)
2. [MCP Streamable HTTP Gateway](#mcp-streamable-http-gateway)
3. [Ebenova V1 REST API (~25 endpoints)](#ebenova-v1-rest-api)
4. [Vercel Serverless Routes (21 endpoints)](#vercel-serverless-routes)
5. [MCP Registry — Go/Huma (~18 endpoints × 2 versions)](#mcp-registry-gohuma)
6. [External Integrations (10 services)](#external-integrations)
7. [Node.js SDK](#nodejs-sdk)
8. [Environment Variables](#environment-variables)

---

## MCP SERVERS

### 1. `ebenova-legal-docs-mcp` — v1.2.5
- **Location:** `mcp-servers/legal-docs/src/index.js`
- **Description:** Legal document generation, invoice generation, scope analysis
- **Published to:** npm, Smithery, Apify
- **Tools (7):**
  - `generate_legal_document` — Generate legal docs (27 types, 18 jurisdictions)
  - `extract_from_conversation` — Extract structured fields from WhatsApp/email/chat
  - `list_document_types` — List all 27 supported document types
  - `generate_invoice` — Generate invoices, receipts, proformas, credit notes (12 currencies)
  - `analyze_scope_creep` — Detect contract scope violations + draft responses
  - `generate_change_order` — Generate formal change order documents
  - `check_usage` — Check API quota usage

### 2. `@ebenova/insights-mcp` — v1.0.3
- **Location:** `mcp-servers/insights/index.js`
- **Description:** Reddit + Nairaland keyword monitoring with AI-drafted replies
- **Published to:** npm, Smithery
- **Tools (6):**
  - `list_monitors` — List all Insights monitors
  - `create_monitor` — Create a new keyword monitor (15-min polling)
  - `delete_monitor` — Deactivate a monitor
  - `get_matches` — Fetch recent matches for a monitor
  - `regenerate_draft` — Re-generate AI reply draft for a match
  - `rate_draft` — Thumbs up/down feedback on a draft

### 3. `@ebenova/scope-guard-mcp` — v1.0.0
- **Location:** `mcp-servers/scope-guard/index.js`
- **Description:** AI-powered contract enforcement for freelancers
- **Published to:** npm
- **Tools (2):**
  - `analyze_scope_violation` — Analyze client messages for scope violations
  - `generate_change_order` — Generate formal change order documents

**Total MCP Tools:** 23 unique tools across 3 servers

---

## MCP STREAMABLE HTTP GATEWAY

- **Location:** `api/mcp.js`
- **Endpoint:** `POST /api/mcp` on `https://www.getsignova.com`
- **Description:** JSON-RPC 2.0 MCP gateway. Smithery/MCPize/Claude.ai compatible. Stateless, no SDK dependency.
- **Tools (14):**
  - `generate_legal_document`
  - `extract_from_conversation`
  - `list_document_types`
  - `check_usage`
  - `get_document_templates`
  - `batch_generate_documents`
  - `analyze_scope_creep`
  - `generate_change_order`
  - `link_contract_payment`
  - `lookup_contract_link`
  - `vigil_authorize`
  - `vigil_analyze_transaction`
  - `vigil_get_risk_score`
  - `vigil_generate_aml_report`

---

## EBENOVA V1 REST API

**Base URL:** `https://api.ebenova.dev`

### Documents (4 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/documents/generate` | `api/v1/documents/generate.js` | Bearer API key | Generate legal doc via Claude Sonnet 4.5 |
| GET | `/v1/documents/types` | `api/v1/documents/types.js` | None (public) | List 27 document types grouped by category |
| GET | `/v1/documents/templates` | `api/v1/documents/templates.js` | Bearer API key | Get field schemas for dynamic form building |
| POST | `/v1/documents/batch` | `api/v1/documents/batch.js` | Bearer API key | Batch generate up to 10 documents |

### Extract (1 endpoint)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/extract/conversation` | `api/v1/extract/conversation.js` | Bearer API key | Extract fields from raw conversation, optionally generate |

### Scope (2 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/scope/analyze` | `api/v1/scope/analyze.js` | Bearer key (Pro+) | Detect contract scope violations |
| POST | `/v1/scope/change-order` | `api/v1/scope/change-order.js` | Bearer key (Pro+) | Generate formal change orders |

### Invoices (1 endpoint)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/invoices/generate` | `api/v1/invoices/generate.js` | Bearer API key | Generate invoices/receipts/proformas (12 currencies) |

### Contracts (1 endpoint)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST/GET | `/v1/contracts/link` | `api/v1/contracts/link.js` | Bearer API key | Link contracts to payment references (Redis lookup) |

### Keys (2 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/keys/create` | `api/v1/keys/create.js` | Admin secret | Provision new API keys (free/starter/growth/scale/enterprise) |
| GET | `/v1/keys/usage` | `api/v1/keys/usage.js` | Bearer API key | Get usage stats + 3-month history |

### Auth (3 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/auth/magic-link` | `api/v1/auth/magic-link.js` | None | Send passwordless magic link email |
| POST | `/v1/auth/verify` | `api/v1/auth/verify.js` | None | Verify magic link token, return session + API keys |
| POST | `/v1/auth/quick-key` | `api/v1/auth/quick-key.js` | None | Instant free tier API key generation |

### Billing (3 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/billing/checkout` | `api/v1/billing/checkout.js` | None | Create Stripe Checkout session for API/Insights subscription |
| POST | `/v1/billing/webhook` | `api/v1/billing/webhook.js` | Stripe signature | Stripe webhook — provisions/updates API keys |
| POST | `/v1/billing/portal` | `api/v1/billing/portal.js` | Bearer API key | Create Stripe Customer Portal session |

### Insights (7 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| GET | `/v1/insights/monitors` | `api/v1/insights/monitors/list.js` | Bearer key (Insights) | List all keyword monitors |
| POST | `/v1/insights/monitors` | `api/v1/insights/monitors/create.js` | Bearer key (Insights) | Create keyword monitor |
| DELETE | `/v1/insights/monitors` | `api/v1/insights/monitors/delete.js` | Bearer key (Insights) | Deactivate a monitor |
| GET | `/v1/insights/matches` | `api/v1/insights/matches/list.js` | Bearer key (Insights) | Paginated matches for a monitor |
| POST | `/v1/insights/matches/draft` | `api/v1/insights/matches/draft.js` | Bearer key (Insights) | Regenerate AI reply draft |
| POST | `/v1/insights/matches/feedback` | `api/v1/insights/matches/feedback.js` | Bearer key (Insights) | Rate draft (thumbs up/down) |
| POST | `/v1/insights/subscribe` | `api/v1/insights/subscribe.js` | None | Join Insights waitlist |

### Vigil — Fraud Detection (4 endpoints)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| POST | `/v1/vigil/authorize` | `api/v1/vigil/authorize.js` | Bearer API key | Proximity-based card transaction auth |
| POST | `/v1/vigil/analyze` | `api/v1/vigil/analyze.js` | Bearer key (Growth+) | AI-powered fraud analysis |
| GET | `/v1/vigil/score` | `api/v1/vigil/score.js` | Bearer API key | Get live risk score 0-100 |
| POST | `/v1/vigil/report` | `api/v1/vigil/report.js` | Bearer key (Scale+) | Generate AML compliance report |

### Admin (1 endpoint)

| Method | Path | File | Auth | Description |
|--------|------|------|------|-------------|
| GET | `/v1/admin/revenue` | `api/v1/admin/revenue.js` | Admin token | MRR, subscriptions, churn from Stripe + Redis |

**Total V1 REST API endpoints:** ~25

---

## VERCEL SERVERLESS ROUTES

**Base URL:** `https://www.getsignova.com`

### Document Generation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/generate` | Stripe session ID or OxaPay track ID | Premium doc generation (Claude) |
| POST | `/api/generate-preview` | Rate-limited (3/hr per IP) | Free preview doc (Groq Llama 3.3 70b) |
| POST | `/api/extract-terms` | Rate-limited (5/hr per IP) | Extract fields from conversation (Groq) |

### Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/stripe-checkout` | None | Create Stripe checkout ($4.99) |
| POST | `/api/oxapay-checkout` | None | Create OxaPay crypto payment |
| POST | `/api/oxapay-verify` | None | Verify OxaPay payment status |
| POST | `/api/oxapay-webhook` | HMAC-SHA512 | OxaPay payment confirmation webhook |
| POST | `/api/verify-payment` | None | Verify Polar.sh payment (legacy) |
| POST | `/api/checkout` | None | Create Polar.sh checkout (legacy) |
| POST | `/api/create-bypass` | `BYPASS_ADMIN_SECRET` | Generate single-use bypass code |

### Scope Guard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/scope-guard-analyze` | Rate-limited (3/day per IP) | Free scope analysis (Groq) |
| POST | `/api/scope-guard-waitlist` | None | Scope Guard waitlist signup |

### Promo

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/promo-redeem` | Rate-limited (5/hr per IP) | Redeem promo code (PRODUCTHUNT, SIGNOVA10, etc.) |
| POST | `/api/promo-verify` | None | Verify promo token |

### Utility

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/waitlist` | None | Waitlist signup + Resend email |
| POST | `/api/contact` | None | Contact form via Resend |
| POST | `/api/capture-buyer` | None | Capture buyer leads + follow-up emails |
| POST | `/api/geo` | None | Geo-IP lookup (Vercel headers → ipapi.co fallback) |
| POST | `/api/mcp` | Bearer API key | MCP Streamable HTTP gateway |
| POST | `/api/insights/request-access` | None | Request Insights beta access |
| GET | `/api/warmup` | None | Cron warmup (every 5 min) |

**Total Vercel serverless routes:** 21

---

## MCP REGISTRY — GO/HUMA

**Location:** `registry/`  
**Base URL:** Configurable  
**Database:** PostgreSQL  
**Versions:** `/v0/` and `/v0.1/` (identical endpoints, dual-versioned)

### Health & Utility

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{version}/health` | Health check — status "ok" + GitHub client ID |
| GET | `/{version}/ping` | Simple ping — returns `{"pong": true}` |
| GET | `/{version}/version` | Version/build information |
| GET | `/metrics` | Prometheus metrics |

### Server Discovery

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/{version}/servers` | None | List MCP servers (paginated, search, version filter, incremental sync) |
| GET | `/{version}/servers/{name}/versions/{version}` | None | Get specific server version (supports "latest") |
| GET | `/{version}/servers/{name}/versions` | None | List all versions of a server |

### Server Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/{version}/servers/{name}/versions/{version}` | JWT Bearer (edit) | Edit/update a server version |
| PATCH | `/{version}/servers/{name}/versions/{version}/status` | JWT Bearer (publish/edit) | Update status metadata |
| PATCH | `/{version}/servers/{name}/status` | JWT Bearer (publish/edit) | Update status for ALL versions |
| POST | `/{version}/validate` | None | Validate server.json without publishing (returns 422 on invalid) |

### Publish

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/{version}/publish` | JWT Bearer (GitHub/OIDC/DNS/HTTP) | Publish a new MCP server |

### Authentication (6 providers)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/{version}/auth/token/github` | GitHub Access Token auth |
| POST | `/{version}/auth/token/github-oidc` | GitHub OIDC auth |
| POST | `/{version}/auth/token/oidc` | Generic OIDC auth |
| POST | `/{version}/auth/token/dns` | DNS-based auth |
| POST | `/{version}/auth/token/http` | HTTP-based auth |
| POST | `/{version}/auth/token/none` | Anonymous auth |

### UI

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | HTML UI for browsing the registry |

**Total Registry endpoints:** ~18 per version (×2 versions = ~36)

---

## EXTERNAL INTEGRATIONS

| Service | Purpose | Used By | Env Vars |
|---------|---------|---------|----------|
| **Anthropic Claude** | Document generation, extraction, scope analysis | 6+ endpoints | `ANTHROPIC_API_KEY` |
| **Groq** | Free preview docs, scope analysis, Insights drafts | 3 endpoints | `GROQ_API_KEY` |
| **Stripe** | Subscriptions, one-off purchases, customer portal | 5 endpoints | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| **OxaPay** | Crypto/USDT payment alternative | 3 endpoints | `OXAPAY_MERCHANT_KEY` |
| **Resend** | Transactional emails (waitlist, magic links, billing) | 12+ endpoints | `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` |
| **Upstash Redis** | API keys, rate limiting, usage tracking, sessions | All auth endpoints | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Polar.sh** | Legacy payment processor | 2 endpoints (legacy) | `POLAR_ACCESS_TOKEN`, `POLAR_PRODUCT_ID` |
| **Vigil** | Fraud detection (proxied) | 4 endpoints | `VIGIL_API_URL` |
| **Vercel Geo IP** | Currency localization | `/api/geo` | Built-in (Vercel headers) |
| **ipapi.co** | Geo IP fallback | `/api/geo` | None (free tier) |

---

## NODE.JS SDK

- **Location:** `sdk/node/`
- **Package:** `ebenova-legal-docs`
- **Description:** Client library for generating NDAs, contracts, and 25+ document types
- **Status:** Active

---

## ENVIRONMENT VARIABLES

| Variable | Service | Required For |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic | Document generation, extraction, scope analysis |
| `GROQ_API_KEY` | Groq | Free preview generation, Insights starter drafts |
| `UPSTASH_REDIS_REST_URL` | Upstash | API key storage, rate limiting, usage tracking |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | API key storage, rate limiting, usage tracking |
| `EBENOVA_ADMIN_SECRET` | Admin auth | `/v1/keys/create` endpoint protection |
| `STRIPE_SECRET_KEY` | Stripe | Payment processing, subscriptions |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signature verification |
| `STRIPE_PRICE_STARTER` | Stripe | $29/mo API plan |
| `STRIPE_PRICE_GROWTH` | Stripe | $79/mo API plan |
| `STRIPE_PRICE_SCALE` | Stripe | $199/mo API plan |
| `STRIPE_PRICE_INSIGHTS_STARTER` | Stripe | $49/mo Insights plan |
| `STRIPE_PRICE_INSIGHTS_GROWTH` | Stripe | $99/mo Insights plan |
| `STRIPE_PRICE_INSIGHTS_SCALE` | Stripe | $249/mo Insights plan |
| `POLAR_ACCESS_TOKEN` | Polar.sh | (Legacy) checkout creation |
| `POLAR_PRODUCT_ID` | Polar.sh | (Legacy) product ID |
| `OXAPAY_MERCHANT_KEY` | OxaPay | Crypto payment processing |
| `RESEND_API_KEY` | Resend | Transactional emails |
| `RESEND_FROM_ADDRESS` | Resend | Email from address |
| `VIGIL_API_URL` | Vigil | Fraud detection proxy |
| `ADMIN_API_TOKEN` | Admin | `/v1/admin/revenue` |
| `BYPASS_ADMIN_SECRET` | Utility | `/api/create-bypass` |
| `PROMO_SECRET` | Promo | `/api/promo-redeem`, `/api/promo-verify` |
| `NEXT_PUBLIC_APP_URL` | Frontend | Magic link generation |
| `ALERT_EMAIL` | Insights | Waitlist notification recipient |
| `INSIGHTS_API_BASE` | MCP Insights | Server config |
| `EBENOVA_API_BASE` | MCP Legal Docs | Server config |

---

## GRAND TOTALS

| Category | Count |
|----------|-------|
| MCP Servers (standalone npm packages) | 3 |
| MCP Streamable HTTP Gateway | 1 |
| MCP Tools exposed across all MCPs | 23 unique tools |
| Ebenova V1 REST API endpoints | ~25 |
| Vercel root-level serverless routes | 21 |
| MCP Registry Go API endpoints | ~18 per version (×2 = ~36) |
| External API integrations | 10 services |
| Node.js SDKs | 1 |
| **Total distinct API endpoints** | **~82** |
