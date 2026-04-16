# Signova — AI-Powered Legal Document Platform

**[getsignova.com](https://www.getsignova.com)** · **[ebenova.dev](https://www.ebenova.dev)** · **[api.ebenova.dev](https://api.ebenova.dev)**

Signova generates professional legal documents, contracts, invoices, and compliance reports using AI — built for freelancers, agencies, and small businesses who need legal protection without lawyer fees.

---

## Overview

Signova ships three surfaces from a single codebase:

- **Consumer web app** at `getsignova.com` — pay-per-document generation, promo redemption, buyer capture
- **Developer platform** at `ebenova.dev` + `api.ebenova.dev` — subscription API with keys, usage tracking, and Stripe billing
- **MCP servers** — Model Context Protocol servers that expose the same legal/insights/scope tooling to AI agents (Claude Desktop, Cursor, etc.)

The platform generates 27+ document types (NDAs, contracts, offer letters, privacy policies, invoices, change orders, etc.) across 18 jurisdictions, with geo-aware currency detection and locale-specific drafting via Anthropic Claude.

---

## Live URLs

| Surface | URL |
|---------|-----|
| Consumer site | https://www.getsignova.com |
| Developer site | https://www.ebenova.dev |
| API base | https://api.ebenova.dev |
| OpenAPI spec (file) | [`openapi.yaml`](./openapi.yaml) |

---

## Architecture

```
Browser / AI Agent
      │
      ▼
Vercel Edge (vercel.json routing + redirects)
      │
      ├─ Static SPA:  Vite build of src/  →  React 19 + React Router 7
      │
      └─ Serverless:  api/*.js  (Node.js functions)
             │
             ├─ Upstash Redis        (API keys, usage, promo state, rate limits)
             ├─ Anthropic Claude     (document generation, scope analysis)
             ├─ Stripe               (consumer checkout + API subscriptions)
             ├─ Resend               (transactional email, waitlist, receipts)
             ├─ Paystack / OxaPay    (Africa + crypto payments)
             └─ Groq                 (fast previews, insight drafts)
```

Deployed on **Vercel** (project `signova`, owner `ebenovasolu-5755s-projects`). Cron jobs defined in `vercel.json` drive `/v1/insights/poll` (every 15 min) and `/api/cron/ots-upgrade` (every 2 hours).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, React Router 7, Phosphor Icons |
| Backend | Vercel Serverless Functions (Node.js, ESM) |
| Validation | Zod 3 |
| Data | Upstash Redis (serverless REST) |
| AI | Anthropic Claude (primary), Groq (previews/drafts) |
| Payments | Stripe (primary), Paystack (NGN), OxaPay (crypto), Flutterwave |
| Email | Resend |
| Analytics | Vercel Analytics, Vercel Speed Insights |
| MCP | `@modelcontextprotocol/sdk` |
| Testing | Vitest, @testing-library/react, jsdom |

---

## Features

### Document generation
- 27+ document types: NDA, freelance/service/consulting agreements, employment offer letters, privacy policy, terms of service, invoices, change orders, scope analysis, and more
- 18 jurisdictions with locale-aware drafting
- Free Groq-powered preview (`api/generate-preview.js`), premium Claude output on payment verification (`api/generate.js`, `api/v1/documents/generate.js`)
- Conversation-to-document extraction (`api/v1/extract/conversation.js`)

### Promo system
Promo codes bypass payment to unlock one free document. State is stored in Upstash Redis (`promo_uses:CODE` counters, `promo_ratelimit:IP` per-IP hourly limiter). IP rate limit: 5 attempts/hour. All codes defined in [`api/promo-redeem.js`](./api/promo-redeem.js).

| Code | Description | Max uses | Expires |
|------|-------------|---------:|---------|
| `SIGNOVA10` | General discount | 500 | 2026-12-31 |
| `OLUMIDE` | Founder access (unlimited testing) | 9,999 | 2027-12-31 |
| `AFRICA` | Taryl African Founders Community | 1,200 | 2026-12-31 |
| `KREDO` | Kredo partnership | 20 | 2026-12-31 |
| `MEST2026` | MEST cohort | 100 | 2026-12-31 |
| `CCHUBNIG` | CcHUB Nigeria | 200 | 2026-12-31 |
| `BAOBAB26` | Baobab Network cohort | 80 | 2026-12-31 |
| `ACCLAFRICA` | Accelerate Africa cohort | 50 | 2026-12-31 |
| `TEF2026` | Tony Elumelu Foundation | 1,000 | 2026-12-31 |
| `ROSEMARY` | Single-use promo | 10 | 2026-12-31 |

### Billing (Stripe)
- Consumer pay-per-document checkout (`api/stripe-checkout.js`, `api/stripe-verify.js`, `api/stripe-webhook.js`)
- Subscription plans for the API: **Starter $29**, **Growth $79**, **Scale $199** (`api/v1/billing/checkout.js`)
- Insights add-on plans: **Starter $49**, **Growth $99**, **Scale $249** — activated commercial feature
- Stripe Customer Portal (`api/v1/billing/portal.js`), webhook handler (`api/v1/billing/webhook.js`)
- Scope Guard Pro checkout (`api/scope-guard-checkout.js`) — activated commercial feature

### MCP servers
Three first-party MCP servers live under [`mcp-servers/`](./mcp-servers/):

| Server | Purpose |
|--------|---------|
| `mcp-servers/legal-docs` | Document drafting tools for AI agents (NDAs, contracts, invoices, change orders) |
| `mcp-servers/insights` | Business-intelligence / contract analytics tools |
| `mcp-servers/scope-guard` | Scope-creep detection and change-order generation |

Each has its own `package.json`, `server.json`, and Dockerfile, and publishes independently to npm / the MCP registry / Smithery / Glama.

The site itself also exposes an HTTP MCP endpoint at `api/mcp.js`.

---

## API authentication

Authenticated endpoints under `/v1/*` use two distinct credentials:

1. **Bearer API keys** (`Authorization: Bearer sk_live_...`) — end-user keys validated against Upstash Redis via [`lib/api-auth.js`](./lib/api-auth.js). Used for document generation, extract, scope, vigil, contracts, insights, invoices.
2. **Admin/setup secret** (`EBENOVA_ADMIN_SECRET`) — gates `/v1/keys/create` so only operators can provision new customer keys. `ADMIN_API_TOKEN` similarly gates `/v1/admin/revenue`. `BYPASS_ADMIN_SECRET` gates `api/create-bypass.js`. `CRON_SECRET` / `POLL_CRON_SECRET` authenticate Vercel cron invocations.

Rate limits and monthly document caps are enforced per key in Redis.

> Note: there is no live `/docs` HTML endpoint today. Consume the OpenAPI spec directly via [`openapi.yaml`](./openapi.yaml).

---

## Local development

### Prerequisites
- Node.js 20+ (ESM)
- Upstash Redis database (free tier)
- Anthropic API key
- Stripe account (only needed to exercise paid flows)
- Resend API key (optional, for email)

### Setup
```bash
git clone <repo-url>
cd signova
npm install
cp .env.example .env
# edit .env with your keys
```

### Scripts
```bash
npm run dev            # Vite dev server
npm run build          # Production build
npm run preview        # Preview built SPA
npm run lint           # ESLint
npm test               # Vitest
npm run test:coverage  # Vitest with coverage
npm run check:css      # Validate CSS design tokens
npm run keygen         # Generate API/admin secrets
```

Running the serverless `api/` functions locally requires the Vercel CLI:
```bash
npm i -g vercel
vercel dev
```

---

## Environment variables

See [`.env.example`](./.env.example) for the full template.

### Required (core)
| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Primary AI generation |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `EBENOVA_ADMIN_SECRET` | Protects `/v1/keys/create` |
| `PROMO_SECRET` | HMAC secret for signed promo tokens |

### Stripe (required for paid flows)
| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_PRICE_STARTER` / `_GROWTH` / `_SCALE` | Main API plan price IDs |
| `STRIPE_PRICE_INSIGHTS_STARTER` / `_GROWTH` / `_SCALE` | Insights add-on price IDs |

### Optional (email, alt-payments, misc)
| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Transactional email |
| `ALERT_EMAIL` | Where insight alerts are sent (defaults to `info@ebenova.net`) |
| `GROQ_API_KEY` | Fast preview + draft generation |
| `OXAPAY_MERCHANT_KEY` | Crypto checkout |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | NGN card checkout |
| `FLUTTERWAVE_SECRET_KEY` / `FLUTTERWAVE_PUBLIC_KEY` | African card checkout |
| `NEXT_PUBLIC_APP_URL` | Magic-link base URL (defaults to `https://www.getsignova.com`) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS allowlist |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARN` / `ERROR` |
| `NODE_ENV` | `development` / `production` |

### Admin, cron, integrations (optional)
| Variable | Purpose |
|----------|---------|
| `ADMIN_API_TOKEN` | Gates `/v1/admin/revenue` |
| `ADMIN_SECRET` | Gates `api/admin/index-doc.js` |
| `BYPASS_ADMIN_SECRET` | Gates `api/create-bypass.js` |
| `CRON_SECRET` | Authenticates `/api/cron/ots-upgrade` |
| `POLL_CRON_SECRET` | Authenticates `/v1/insights/poll` |
| `FIELDOPS_API_URL` / `FIELDOPS_INTERNAL_KEY` | FieldOps bookings bridge |
| `VIGIL_API_URL` | Vigil compliance backend |

---

## Deployment

The project is deployed on **Vercel**:

- Project: `signova`
- Owner: `ebenovasolu-5755s-projects`
- Domains routed via `vercel.json` redirects: apex `getsignova.com` → `www.getsignova.com`, apex `ebenova.dev` → `www.ebenova.dev`
- Cron jobs configured in `vercel.json`

```bash
vercel          # preview deploy
vercel --prod   # production deploy
```

Configure environment variables in Vercel → Project Settings → Environment Variables (mirror the list above).

---

## Testing

Current status — be honest about what ships vs. what is planned:

| Area | Status |
|------|--------|
| `lib/sanitize.js` | Done |
| `lib/parse-body.js` | Done |
| `lib/cors-middleware.js` | Done |
| API endpoint integration tests | Planned |
| React component tests | Planned |

Run with `npm test` (Vitest). `npm run test:coverage` emits a v8 coverage report.

---

## Project structure

```
signova/
├── api/                   # Vercel serverless functions
│   ├── v1/                # Versioned API (auth, billing, documents, insights,
│   │                      #   vigil, scope, contracts, extract, invoices, keys, admin)
│   ├── admin/             # Admin-only operator endpoints
│   ├── cron/              # Scheduled tasks (ots-upgrade)
│   ├── generate.js        # Premium document generation (Claude)
│   ├── generate-preview.js# Free preview generation (Groq)
│   ├── promo-redeem.js    # Promo code redemption (10 codes)
│   ├── stripe-*.js        # Consumer Stripe flow
│   ├── paystack-*.js      # Paystack flow
│   ├── oxapay-*.js        # OxaPay crypto flow
│   ├── mcp.js             # HTTP MCP endpoint
│   └── ...
├── lib/                   # Shared server libraries (auth, CORS, Redis, validators,
│                          #   sanitize, parse-body, logger, analytics)
├── src/                   # React SPA (pages, components, lib, styles)
├── mcp-servers/
│   ├── legal-docs/        # Legal document MCP server (publishable)
│   ├── insights/          # Insights MCP server (publishable)
│   └── scope-guard/       # Scope-guard MCP server
├── tests/                 # Vitest test suite
├── scripts/               # Dev utilities (keygen, CSS token check, etc.)
├── openapi.yaml           # OpenAPI 3.1.0 specification
└── vercel.json            # Vercel routing, redirects, cron
```

---

## Related repositories

- **ebenova-legal-docs-mcp** — published distribution of the legal-docs MCP server (npm, MCP Registry, Smithery, Glama, MCPize)

---

## License

© 2026 Ebenova Solutions. All rights reserved. Commercial product — unauthorized copying, distribution, or modification is prohibited. See [`LICENSE`](./LICENSE).

---

## Support

- Email: [info@ebenova.net](mailto:info@ebenova.net)
- Site: [getsignova.com](https://www.getsignova.com)

---

## Legal disclaimer

Documents generated by Signova are for informational purposes only and do not constitute legal advice. Always consult a qualified attorney before relying on AI-generated legal documents.
