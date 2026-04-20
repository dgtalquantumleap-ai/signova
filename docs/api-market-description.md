# Ebenova — The API Layer for Business Agreements

One unified API for business agreements: contracts, invoices, fraud detection, scope enforcement, and more. 10 sub-APIs. One key. 34 document types. 18 jurisdictions. MCP-native.

Built for developers in markets underserved by Stripe and DocuSign — works globally, goes deeper where others don't.

## Quickstart (on API Market)

Authentication is handled by API Market's proxy. Every request includes your `x-api-market-key` header — subscribe on api.market to get one.

```bash
curl -X POST \
  "https://prod.api.market/api/v1/ebenova/ebenova/v1/documents/generate" \
  -H "x-api-market-key: YOUR_API_MARKET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"document_type":"nda","fields":{"disclosingParty":"Acme Inc.","receivingParty":"John Smith","purpose":"Partnership discussions","duration":"2 years","mutual":"Yes"},"jurisdiction":"Nigeria"}'
```

That's it — the API Market proxy authenticates your subscription, meters usage, and forwards to the upstream.

## Sub-APIs Included

- **Legal Documents** — Generate 34 document types (NDAs, DPAs, tenancy agreements, SAFEs, employment contracts, shareholder agreements, deeds of assignment, powers of attorney, and more). Every document is adapted to the jurisdiction you specify — Nigerian tenancies correctly reference Lagos State Tenancy Law 2011 and Stamp Duties Act; Ghanaian employment contracts cite Labour Act 2003 (Act 651); South African SAFEs use the Companies Act 71 of 2008 share-issuance regime.
- **Invoice & Receipt** — Professional HTML invoices, receipts, proformas, and credit notes. 12+ currencies, 47 geo-currency auto-detections, VAT/GST aware.
- **Scope Guard™** — Detect contract scope violations, get three response drafts (polite, firm, legal), plus automatic change-order pricing. Zero direct API competitors.
- **Vigil Fraud Alert** — Proximity-based card fraud detection in under 150ms. For fintech and payment processors.
- **WhatsApp Extraction** — Extract structured legal fields from messy WhatsApp conversations. Auto-generates a contract from a chat thread.
- **Contract–Payment Linking** — Bidirectional lookup: find the contract behind a payment, or the payments against a contract. Built for proptech and marketplace platforms.
- **Batch Generation** — Up to 10 documents in a single call. Scales linearly, bills linearly.
- **Document Templates** — Field schemas for all 34 types. Zero AI cost — use this to build your own UI before paying for actual generation.
- **Insights Reddit Monitor** — Keyword monitoring across Reddit with AI-drafted replies every 15 minutes. For marketers and growth teams.
- **FieldOps Agent** — Task management, geo-tracking, and team coordination for distributed service businesses.

## Supported Jurisdictions

Nigeria, Kenya, Ghana, South Africa, UK, US (all 50 states), Canada (all provinces), India, UAE, Singapore, and 180+ countries via generic Commonwealth common-law and civil-law fallbacks.

Every jurisdiction-specific clause is backed by statutory references:

- **Nigeria:** CAMA 2020, ISA 2025, Labour Act, Lagos Tenancy Law 2011, Land Use Act 1978, Hire Purchase Act 1965, NDPA 2023
- **UK:** Companies Act 2006, Employment Rights Act 1996, UK GDPR + DPA 2018, Consumer Rights Act 2015
- **Kenya:** Companies Act 2015, Employment Act 2007, DPA 2019
- **Ghana:** Companies Act 2019 (Act 992), Labour Act 2003 (Act 651)
- **South Africa:** Companies Act 71 of 2008, BCEA 75 of 1997, POPIA
- **US:** UCC Article 2, DGCL, state-specific employment/privacy laws (CCPA, VCDPA, etc.)
- **Canada:** CBCA, PIPEDA, provincial ESAs, Quebec Law 25

## Who It's For

- **SaaS platforms** that need embedded legal documents at signup, in-app contract generation, or terms/privacy policy automation
- **Freelancer tools and marketplaces** generating NDAs, consulting agreements, and invoices on demand
- **African fintech and proptech** apps needing CAMA, Labour Act, and state-specific property-law compliance out of the box
- **Property rental platforms** linking tenancy agreements to rent payments
- **AI agent developers** needing a legal and payment infrastructure layer for autonomous agents

## Add-on: Insights (Reddit Monitoring)

The `/v1/monitors` and `/v1/matches` endpoints (Reddit keyword monitoring with AI reply drafts) are gated behind a separate Insights subscription. Requests from standard plans return `403 INSIGHTS_ACCESS_REQUIRED`. To unlock, contact **info@ebenova.net** or visit **[ebenova.dev/insights](https://ebenova.dev/insights)** — we'll enable Insights access on your API Market subscription key within one business day. All other endpoints (Documents, Invoices, Scope Guard, Extraction, Keys, Billing) work on every plan.

## Pricing

- **Free** — $0 / 50 units per month → trial, no credit card
- **PRO** — $29 / 3,000 units per month → indie devs, side projects
- **GROWTH** — $79 / 15,000 units per month → small SaaS
- **SCALE** — $199 / 60,000 units per month → production

Overage on paid plans: $0.001 per extra API call (soft limit). Free tier is hard-capped at 50 units/month.

## MCP-Native

Prefer to work through Claude Desktop, Cursor, or VS Code? 6 MCP servers on npm wrap every endpoint as a native tool your AI assistant can call directly. Install with a single command; no glue code required.

## Response Times

| Endpoint | Typical | 95th percentile |
|---|---|---|
| `GET /v1/documents/types` | 400ms | 800ms |
| `POST /v1/documents/generate` | 60s | 120s |
| `POST /v1/extract/conversation` | 10s | 30s |
| `POST /v1/scope/analyze` | 5s | 15s |
| `POST /v1/invoices/generate` | 5s | 10s |

Document generation is synchronous and can run up to 180 seconds for complex multi-jurisdiction documents; clients should set timeouts accordingly. For higher throughput, use `POST /v1/documents/batch`.

## Support

- Documentation and dashboard: [ebenova.dev](https://ebenova.dev)
- Questions / issues: info@ebenova.net
- Status page: [status.ebenova.dev](https://status.ebenova.dev)
- Response SLA: 24 hours on paid plans; best-effort on free tier

## Changelog

- **2026-04** — Added Kenya, Ghana, South Africa doc-type-specific clauses (tenancy, employment, property, loan). Full jurisdiction parity across NG / UK / KE / GH / ZA / US / CA.
- **2026-04** — SAFE agreement added with CAMA 2020 + ISA 2025 references for Nigerian startups.
- **2026-04** — Generate endpoint timeout extended to 280s for complex multi-clause legal documents.
- **2026-03** — 34 document types live across 18 jurisdictions.
