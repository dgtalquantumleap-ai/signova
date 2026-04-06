# Signova — AI-Powered Legal Document Platform

**[getsignova.com](https://www.getsignova.com)** · **[API Docs](https://api.ebenova.dev/docs)** · **[Status](https://status.ebenova.dev)**

Signova generates professional legal documents, contracts, invoices, and compliance reports using AI. Built for freelancers, agencies, and small businesses who need legal protection without lawyer fees.

---

## Features

- 📄 **Document Generation** — NDAs, contracts, terms of service, privacy policies, invoices, and more
- 🤖 **AI-Powered** — Uses Anthropic Claude for high-quality, jurisdiction-aware legal drafting
- 💳 **Pay-Per-Document** — $4.99 per document, no subscription required
- 🌍 **Geo-Aware Pricing** — Automatic currency detection for 35+ countries
- 🔐 **API-First** — RESTful API with API key authentication, rate limiting, and usage tracking
- 🤖 **MCP Support** — Model Context Protocol servers for AI agent integration
- 📊 **Insights Dashboard** — Business intelligence monitoring for contract analytics

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 7, React Router 7 |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Database** | Upstash Redis (serverless) |
| **Payments** | Stripe Checkout + OxaPay (crypto) |
| **AI** | Anthropic Claude, Groq (previews) |
| **Email** | Resend |
| **Analytics** | Google Analytics 4, Microsoft Clarity, Vercel Analytics |
| **Deployment** | Vercel (Edge Network) |

---

## Project Structure

```
signova/
├── api/                      # Vercel serverless functions
│   ├── v1/                   # API v1 endpoints
│   │   ├── auth/             # Authentication (magic links, verification)
│   │   ├── billing/          # Stripe checkout, webhooks, portal
│   │   ├── documents/        # Document generation endpoints
│   │   ├── insights/         # Business intelligence endpoints
│   │   ├── vigil/            # Compliance monitoring endpoints
│   │   ├── scope/            # Scope change analysis
│   │   ├── contracts/        # Contract linking
│   │   ├── extract/          # Term extraction
│   │   ├── invoices/         # Invoice generation
│   │   └── keys/             # API key provisioning
│   ├── contact.js            # Contact form handler
│   ├── generate-preview.js   # Free preview generation (Groq)
│   ├── generate.js           # Premium document generation (Anthropic)
│   ├── mcp.js                # Model Context Protocol endpoint
│   └── ...
├── lib/                      # Shared libraries
│   ├── api-auth.js           # API key authentication & rate limiting
│   ├── cors-middleware.js    # CORS allowlist handling
│   ├── logger.js             # Structured logging
│   ├── parse-body.js         # Request body parsing
│   ├── redis.js              # Redis client & helpers
│   ├── sanitize.js           # HTML escaping utilities
│   ├── validators.js         # Zod validation schemas
│   └── analytics.js          # Tracking utilities
├── src/                      # React frontend
│   ├── pages/                # Page components
│   ├── components/           # Reusable UI components
│   ├── lib/                  # Frontend utilities
│   ├── App.jsx               # Main app with lazy-loaded routes
│   └── main.jsx              # Entry point
├── mcp-servers/              # Model Context Protocol servers
│   ├── insights/             # Business intelligence MCP
│   └── legal-docs/           # Legal document drafting MCP
├── registry/                 # Package registry (Go)
├── tests/                    # Vitest test suite
├── openapi.yaml              # OpenAPI 3.1.0 specification
└── vercel.json               # Vercel deployment configuration
```

---

## Getting Started

### Prerequisites

- Node.js 20+ (ESM)
- Upstash Redis account
- Anthropic API key
- Stripe account
- Resend API key (optional, for email)

### Installation

```bash
# Clone the repository
git clone https://github.com/ebenova/signova.git
cd signova

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env and add your API keys
```

### Development

```bash
# Start development server
npm run dev

# Lint code
npm run lint

# Run tests
npm test

# Run a single test file
npx vitest tests/lib/sanitize.test.js
```

### Build & Preview

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

---

## API Usage

### Authentication

All API endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer sk_live_YOUR_API_KEY
```

Get your API key from the [Signova Dashboard](https://www.getsignova.com/dashboard).

### Example: Generate a Document

```bash
curl -X POST https://api.ebenova.dev/v1/documents/generate \
  -H "Authorization: Bearer sk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "docType": "nda",
    "docName": "Mutual NDA",
    "prompt": "Draft a mutual NDA between Acme Corp and Beta LLC..."
  }'
```

### Rate Limits

| Tier | Requests/Minute | Documents/Month |
|------|----------------|----------------|
| Free | 5 | 0 (preview only) |
| Starter | 10 | 100 |
| Growth | 30 | 500 |
| Scale | 60 | 2000 |
| Enterprise | 120 | Unlimited |

### OpenAPI Specification

Full API documentation is available in OpenAPI 3.1.0 format:
- **Raw**: [`openapi.yaml`](./openapi.yaml)
- **Rendered**: [api.ebenova.dev/docs](https://api.ebenova.dev/docs)

---

## Environment Variables

See [`.env.example`](./.env.example) for all required environment variables.

### Required

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `ANTHROPIC_API_KEY` | AI document generation | [console.anthropic.com](https://console.anthropic.com) |
| `GROQ_API_KEY` | Preview generation | [console.groq.com](https://console.groq.com) |
| `UPSTASH_REDIS_REST_URL` | Redis REST endpoint | [upstash.com](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | [upstash.com](https://upstash.com) |
| `STRIPE_SECRET_KEY` | Payment processing | [dashboard.stripe.com](https://dashboard.stripe.com) |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification | Stripe Dashboard → Developers → Webhooks |
| `RESEND_API_KEY` | Email sending | [resend.com](https://resend.com) |
| `EBENOVA_ADMIN_SECRET` | Admin endpoint auth | Generate randomly |

### Optional

| Variable | Description |
|----------|-------------|
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins |
| `LOG_LEVEL` | Log level: DEBUG, INFO, WARN, ERROR (default: INFO) |
| `NODE_ENV` | `development` or `production` |

---

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Run specific test file
npx vitest tests/lib/sanitize.test.js
```

### Test Coverage

| Module | Status |
|--------|--------|
| `lib/sanitize.js` | ✅ Tested |
| `lib/parse-body.js` | ✅ Tested |
| `lib/cors-middleware.js` | ✅ Tested |
| API endpoints | 🚧 Coming soon |
| React components | 🚧 Coming soon |

---

## Deployment

### Vercel (Recommended)

This project is optimized for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables

Set all required environment variables in your Vercel dashboard:
- Project Settings → Environment Variables

### Custom Domains

Configure custom domains in Vercel:
- Project Settings → Domains
- Add `getsignova.com`, `www.getsignova.com`, `api.ebenova.dev`

---

## Architecture

### Request Flow

```
Client → Vercel Edge Network
  → vercel.json (routing, headers, rewrites)
    → api/*.js (serverless functions)
      → lib/* (shared utilities)
        → External APIs (Anthropic, Stripe, Redis, Resend)
```

### Security

- **CORS**: Origin allowlist (no wildcards on auth/payment endpoints)
- **Authentication**: Bearer token with Redis-backed key validation
- **Rate Limiting**: Per-key, per-minute sliding window
- **Input Validation**: Zod schemas on all user inputs
- **HTML Sanitization**: Server-side escaping on all user-generated content
- **Security Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Payment Verification**: Stripe webhook signature verification

### Caching Strategy

| Resource | TTL | Strategy |
|----------|-----|----------|
| Static assets (JS/CSS) | 1 year | Immutable, hash-based filenames |
| Fonts | 1 year | Immutable |
| Images | 1 day | Stale-while-revalidate |
| API CORS preflight | 1 day | max-age=86400 |
| Geo location | 1 hour | In-memory cache |

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) (coming soon).

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -m 'feat: add my feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation
- `chore:` — maintenance
- `test:` — testing
- `refactor:` — code restructuring

---

## License

© 2026 Ebenova Solutions. All rights reserved.

This is a commercial product. Unauthorized copying, distribution, or modification is prohibited. See [LICENSE](./LICENSE) for details.

---

## Support

- **Email**: [info@ebenova.net](mailto:info@ebenova.net)
- **API Status**: [status.ebenova.dev](https://status.ebenova.dev)
- **Documentation**: [getsignova.com/docs](https://www.getsignova.com/docs)

---

## Legal Disclaimer

Documents generated by Signova are for informational purposes only and do not constitute legal advice. Always consult a qualified attorney before using AI-generated legal documents.
