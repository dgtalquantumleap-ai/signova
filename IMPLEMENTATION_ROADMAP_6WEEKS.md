# EBENOVA — FOCUSED ROADMAP TO $10K MRR
**Sprint 1: Legal Documents API Launch** (Weeks 1-2)  
**Sprint 2: Scope Guard + Distribution** (Weeks 3-4)  
**Sprint 3: Invoices + Growth** (Weeks 5-6)  

---

## SPRINT 1: LEGAL DOCUMENTS API LAUNCH (Weeks 1-2)

### Week 1: Fixes + Deployment

```
┌─────────────────────────────────────────────────────────┐
│ STAGE 1: UX FIXES (IMMEDIATE)                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ FIX #1: Pricing Tier "Start Free Trial" Button          │
│ ├─ Location: src/pages/ApiLanding.jsx (line ~356)      │
│ ├─ Problem: No onClick handler                         │
│ ├─ Fix: Add onClick={() => navigate('/dashboard')}     │
│ ├─ Status: ⏳ PENDING                                   │
│ └─ Impact: Recover 80%+ lost signups                   │
│                                                          │
│ FIX #2: "Get API Key" CTA Points to Docs              │
│ ├─ Location: src/pages/ApiLanding.jsx (handleGetApiKey)│
│ ├─ Problem: Goes to /docs#authentication              │
│ ├─ Fix: Change to navigate('/dashboard')              │
│ ├─ Status: ⏳ PENDING                                   │
│ └─ Impact: Direct users to signup, not docs           │
│                                                          │
│ FIX #3: Update Copy "Start Free Trial" → "Get Free Key"│
│ ├─ Location: PRICING_TIERS array (Free tier)          │
│ ├─ Problem: "Free Trial" != API key model             │
│ ├─ Fix: Change to "Get Free API Key"                  │
│ ├─ Status: ⏳ PENDING                                   │
│ └─ Impact: Clarity on what users get                   │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STAGE 2: BACKEND DEPLOYMENT (Hours 2-4)                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Set up Upstash Redis                                │
│    └─ Sign up at upstash.com                           │
│    └─ Create database → copy REST URL + token         │
│    └─ Add to Vercel env vars                           │
│       • UPSTASH_REDIS_REST_URL                        │
│       • UPSTASH_REDIS_REST_TOKEN                      │
│                                                          │
│ 2. Update lib/redis.js                                 │
│    └─ Point to Upstash (currently just stub)          │
│    └─ Implement getRedis() client                     │
│                                                          │
│ 3. Update api/v1/documents/generate.js                │
│    └─ Replace memory-based API_KEYS Map              │
│    └─ Use Redis for key validation + persistence     │
│    └─ Add usage tracking (increment counter)          │
│                                                          │
│ 4. Deploy to Vercel                                   │
│    └─ vercel --prod                                   │
│    └─ Verify keys persist across requests            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Week 2: MCP Server + Testing

```
┌─────────────────────────────────────────────────────────┐
│ STAGE 3: MCP SERVER CREATION (4-6 hours)              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Create @ebenova/legal-docs-mcp package             │
│    └─ mcp-servers/legal-docs/index.js                 │
│    └─ Expose 3 tools:                                 │
│       ✓ generate_document                             │
│       ✓ list_document_types                           │
│       ✓ extract_from_conversation                     │
│                                                          │
│ 2. Package + publish to npm                           │
│    └─ npm publish                                      │
│                                                          │
│ 3. Submit to MCP Registry                             │
│    └─ modelcontextprotocol.io/registry                │
│                                                          │
│ 4. Submit to Smithery.ai (fastest adoption)           │
│    └─ smithery.ai/submit                              │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STAGE 4: TESTING + DOCUMENTATION                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Test Cases:                                            │
│ □ Create free API key                                 │
│ □ Call /v1/documents/generate with valid API key      │
│ □ Verify usage counter increments                     │
│ □ Generate 5 documents → 6th should fail (limit)      │
│ □ Monthly reset works                                 │
│ □ API rate limiting works                             │
│                                                          │
│ Documentation:                                         │
│ □ Update openapi.yaml (fully specify endpoints)       │
│ □ Create Postman collection                           │
│ □ Write README: "Getting Started with Ebenova API"   │
│ □ Add authentication examples                         │
│ □ Add curl/Python/Node examples per endpoint          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Success Criteria for Sprint 1
- ✅ API key creation flow works end-to-end
- ✅ Redis persists keys across deployments
- ✅ Rate limiting + usage tracking work
- ✅ MCP server listed on Smithery
- ✅ 50+ signups for free API tier
- ✅ 5+ paid Starter tier conversions

---

## SPRINT 2: SCOPE GUARD + DISTRIBUTION (Weeks 3-4)

### Week 3: Scope Guard API Launch

```
┌─────────────────────────────────────────────────────────┐
│ SCOPE GUARD: Contract Enforcement API                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ENDPOINT: POST /v1/scope/analyze                      │
│                                                          │
│ Request:                                               │
│ {                                                      │
│   "contract_id": "ctr_xxx",      // Saved contract    │
│   "client_message": "string",     // RequestEmail/chat │
│   "communication_channel": "email"                     │
│ }                                                      │
│                                                          │
│ Response:                                              │
│ {                                                      │
│   "violations": [{                                     │
│     "type": "SCOPE",              // SCOPE|TIME|PAYMENT│
│     "severity": "HIGH",                                │
│     "description": "Blog section not in deliverables" │
│   }],                                                  │
│   "response_options": [{                               │
│     "type": "CHANGE_ORDER",       // Recommended      │
│     "draft": "Full response text..."                   │
│   }]                                                   │
│ }                                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ BUILD CHECKLIST:                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ □ Create contracts table (Vercel Postgres/Supabase)   │
│ □ Store contract after generation (api/v1/documents/  │
│   generate.js)                                         │
│ □ Implement scope violation detection (Claude Vision) │
│ □ Draft 3 response options (API)                       │
│ □ Test with 10 real client messages                   │
│ □ Add to Pro tier ($49/mo)                            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Week 4: Distribution + Content

```
┌─────────────────────────────────────────────────────────┐
│ DISTRIBUTION BLITZ                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Dev.to Tutorial (High Traffic)                      │
│    Title: "Auto-Generate Legal Contracts with Claude  │
│    + MCP Servers"                                      │
│    Sections:                                            │
│    • What is MCP? (benefits for developers)           │
│    • Setting up @ebenova/legal-docs-mcp              │
│    • Generating NDAs in Claude Desktop                │
│    • Custom document types                            │
│    └─ Target: 2K+ views, 50+ bookmarks               │
│                                                          │
│ 2. Postman Public Collection                          │
│    • All 4 endpoints: generate, types, analyze, etc   │
│    • Pre-filled example responses                      │
│    • Published → Postman network                       │
│                                                          │
│ 3. Announcement Post                                   │
│    Blog post: "Ebenova API + Scope Guard Launch"      │
│    • Technical deep dive                              │
│    • Use cases                                        │
│    • Pricing                                          │
│                                                          │
│ 4. Social Media Campaign                              │
│    • Twitter thread: MCP + Legal Docs + Freelancers   │
│    • LinkedIn post: Scope Guard ROI                   │
│    • Hacker News: "API for freelancer contracts"      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Success Criteria for Sprint 2
- ✅ Scope Guard API live and tested
- ✅ 3 contracts stored in database from real users
- ✅ Dev.to post published, 1K+ views
- ✅ 100+ API users (cumulative)
- ✅ $3K-5K MRR (legal docs + scope guard upgrades)
- ✅ 10+ Scope Guard Pro tier signups

---

## SPRINT 3: INVOICES + GROWTH OPTIMIZATION (Weeks 5-6)

### Week 5: Invoices API

```
┌─────────────────────────────────────────────────────────┐
│ INVOICES API: Complete PDF Generation                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ENDPOINT: POST /v1/invoices/generate                  │
│                                                          │
│ Features:                                              │
│ • Multi-currency (USD, EUR, GBP, NGN, KES, GHS, ZAR) │
│ • PDF + HTML output                                   │
│ • Tax calculation (VAT, GST, custom)                  │
│ • QR code generation (payment link)                   │
│ • Custom branding (logo, colors)                      │
│                                                          │
│ Tech Stack:                                            │
│ • Template: Handlebars                                │
│ • PDF: Puppeteer (or html-pdf-node)                   │
│ • Storage: Vercel Blob (24h auto-expiry)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Week 6: Analytics + Growth Optimizations

```
┌─────────────────────────────────────────────────────────┐
│ GROWTH LEVERS TO PULL                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 1. Dashboard Analytics Upgrade                         │
│    □ Show usage trends (7d, 30d)                       │
│    □ Revenue per user breakdown                        │
│    □ Conversion funnel (free→paid)                     │
│                                                          │
│ 2. Email Onboarding Sequence                           │
│    □ Welcome: "Here's your first API key"            │
│    □ +1 day: Example cURL request                     │
│    □ +3 days: "Scope Guard can save you money"       │
│    □ +7 days: "Upgrade to Pro" (if pro ready)        │
│                                                          │
│ 3. Webhook Events (API users love this)              │
│    □ subscription.created                             │
│    □ document.generated                               │
│    □ usage.limit_approaching                          │
│                                                          │
│ 4. Pricing Page Optimization                          │
│    □ Social proof: "50+ developers"                   │
│    □ Use case cards: "For X role"                     │
│    □ FAQ: Common objections                           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Success Criteria for Sprint 3
- ✅ Invoices API live with PDF generation
- ✅ 200+ API users (cumulative)
- ✅ $8K-12K MRR (all three APIs)
- ✅ <5% monthly churn
- ✅ Email sequence delivering 10%+ upgrade rate
- ✅ Dashboard analytics tracking adoption

---

## KEY METRICS TO TRACK

### Weekly Dashboard Metrics

| Metric | Week 1 | Week 2 | Week 3 | Week 4 | Week 5 | Week 6 |
|--------|--------|--------|--------|--------|--------|--------|
| API Keys Created | 0 | 50 | 100 | 150 | 200 | 250 |
| API Calls | 0 | 500 | 2K | 5K | 10K | 15K |
| Free Tier Users | 0 | 40 | 80 | 120 | 160 | 200 |
| Paid Tier Users | 0 | 3 | 8 | 15 | 25 | 40 |
| **MRR** | $0 | $87 | $232 | $435 | $725 | $1,160 |

---

## RESOURCES NEEDED

### Time Commitments
- Week 1: 20 hours (fixes + Redis + testing)
- Week 2: 15 hours (MCP + docs + testing)
- Week 3: 12 hours (Scope Guard completion)
- Week 4: 10 hours (content + distribution)
- Week 5: 12 hours (Invoices API)
- Week 6: 10 hours (analytics + optimization)

**Total:** ~80 hours over 6 weeks (~13.3 hrs/week)

### External Services (Costs)
- Upstash Redis: Free tier (sufficient for 3 months)
- Vercel Functions: Included with existing project
- Supabase/Vercel Postgres: ~$25/month
- **Total Operating Cost:** ~$25-50/month for 3 months

### Tools to Set Up
- npm account (for publishing MCP server)
- Smithery.ai account (for registry listing)
- Postman account (public collection)
- Dev.to account (if starting fresh)

---

## DECISION GATES (Kill Decisions)

**Gate 1 (End of Week 2):** "Is the API working?"
- If no: Stop. Fix the API before proceeding.
- If yes: Continue to distribution.

**Gate 2 (End of Week 4):** "Do we have product-market fit?"
- Signals: 50+ signups, 3+ paid conversions, <5% churn
- If no: Pause. Run user interviews. Pivot messaging or features.
- If yes: Continue to Scope Guard + Invoices.

**Gate 3 (End of Week 6):** "Are we on track to $10K MRR?"
- Target: $1K-2K MRR by end of sprint
- If yes: Scale marketing spend (ads, partnerships)
- If no: Reassess positioning or feature priorities

---

## NEXT STEP

**Action:** Start with Week 1, Stage 1 (UX Fixes) — takes 1 hour, recovers 80% of lost signups.

