---
title: "How I Built a Multi-Jurisdiction Legal Document API in 30 Days (Solo Founder, AI-Assisted)"
published: true
publishDate: 2026-03-28
coverImage: https://dev-to-uploads.s3.amazonaws.com/uploads/articles/ebenova-api-cover.png
tags: api, nodejs, indiehackers, saas, webdev, typescript, startup, africa
series: Building Ebenova
canonical: https://ebenova.dev/blog/how-i-built-legal-api
---

---

## Introduction

A friend of mine lost **$15,000** on a freelance web development project last year.

The "contract"? A WhatsApp conversation.

No written scope. No payment terms. No recourse. Just trust. And disappointment.

When I started researching, I discovered something shocking: **2 billion people** negotiate business deals over informal channels — WhatsApp, WeChat, Telegram, email. Especially in Africa, India, Southeast Asia, and Latin America.

And there are **zero tools** to formalize those agreements.

So I built **Ebenova.dev** — a legal infrastructure API for informal commerce.

**17 days ago**, I had an idea and no code.

**Today**, I have:
- ✅ Live API platform (27 document types, 18 jurisdictions)
- ✅ 1 paying customer (thank you, Klauza!)
- ✅ 5 beta API users
- ✅ 1,000+ API calls
- ✅ npm SDK published (`ebenova-legal-docs`)
- ✅ 0 downtime

In this article, I'll walk you through:
1. The technical architecture (Vercel, Upstash, Anthropic, Node.js)
2. Four key challenges I faced (and how I solved them)
3. Lessons learned as a solo, non-technical founder using AI
4. What's next (Scope Guard, Africa Payouts, Product Hunt)

Let's dive in.

---

## Technical Architecture

### The Stack

I'm a **non-technical founder**. I had 30 days and limited budget. I needed a stack that was:
- **Fast to develop** (serverless, no DevOps)
- **Scalable** (pay-per-use, auto-scales)
- **Affordable** (free tiers, low fixed costs)
- **AI-friendly** (easy integration with LLM APIs)

Here's what I chose:

| Component | Technology | Why |
|-----------|------------|-----|
| **Frontend** | React + Vite | Fast HMR, easy deployment |
| **Backend** | Vercel Serverless Functions | Zero DevOps, auto-scales |
| **Database** | Supabase (PostgreSQL) | Free tier, SQL is familiar |
| **Cache / Rate Limiting** | Upstash Redis | Serverless Redis, free tier |
| **AI** | Anthropic Claude API | Best for legal text generation |
| **Payments** | Stripe + OxaPay | Cards + crypto (USDT for Africa) |
| **SDK** | Node.js (ESM) | Most popular for API consumers |

### Architecture Diagram

Here's the flow for a typical API request:

```
┌─────────────┐
│   Developer │
│   (API Call)│
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│   Vercel Edge Function          │
│   - Auth middleware             │
│   - Rate limiting (Upstash)     │
│   - Request validation          │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   Anthropic Claude API          │
│   - Prompt engineering          │
│   - Document generation         │
│   - Jurisdiction rules          │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   Response + Usage Tracking     │
│   - Store in Supabase           │
│   - Increment Redis counter     │
│   - Return JSON                 │
└─────────────────────────────────┘
```

### Basic API Endpoint Structure

Here's what a typical endpoint looks like (`api/v1/documents/generate.js`):

```javascript
// api/v1/documents/generate.js
import { authenticate, recordUsage } from '../../lib/api-auth.js'

const SUPPORTED_TYPES = [
  'nda', 'freelance-contract', 'tenancy-agreement',
  'privacy-policy', 'service-agreement', // ... 22 more
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED' } })
  }

  // Auth + rate limiting
  const auth = await authenticate(req)
  if (!auth.ok) {
    return res.status(auth.status).json({ success: false, error: auth.error })
  }

  // Parse body
  const { document_type, fields, jurisdiction } = await req.json()

  // Validate
  if (!SUPPORTED_TYPES.includes(document_type)) {
    return res.status(400).json({ 
      success: false, 
      error: { code: 'UNSUPPORTED_TYPE' } 
    })
  }

  // Generate with Claude
  const prompt = buildPrompt(document_type, fields, jurisdiction)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  const data = await response.json()
  const documentText = data.content[0]?.text || ''

  // Record usage (only after success)
  await recordUsage(auth)

  return res.status(200).json({
    success: true,
    document_type,
    document: documentText,
    usage: buildUsageBlock(auth),
    generated_at: new Date().toISOString(),
  })
}
```

**Why this stack works for solo founders:**
- **No servers to manage** (Vercel handles everything)
- **Pay-per-use** (free tier covers early traffic)
- **Global edge network** (low latency worldwide)
- **Built-in CI/CD** (git push = deploy)

---

## Key Challenges + Solutions

### Challenge 1: Vercel Function Timeouts ⏱️

**The Problem:**

Document generation with Claude takes **45-90 seconds** depending on document length. Vercel's default timeout is **60 seconds** for Hobby plan, **900 seconds** for Pro.

My first deployments kept timing out. Users got `504 Gateway Timeout` errors. Not great.

**The Solution:**

I extended the `maxDuration` in `vercel.json` for specific endpoints:

```json
{
  "functions": {
    "api/v1/documents/generate.js": {
      "maxDuration": 120
    },
    "api/v1/extract/conversation.js": {
      "maxDuration": 120
    },
    "api/v1/invoices/generate.js": {
      "maxDuration": 60
    }
  }
}
```

**Trade-offs:**
- ✅ Fixes timeout errors
- ⚠️ Longer cold starts (functions stay alive longer)
- ⚠️ Higher costs (billed per 100ms of execution)

**What I'd do differently:**
- Use **streaming responses** (send document in chunks)
- Implement **webhook callbacks** (generate async, notify when done)
- Consider **background jobs** (Vercel Queues or Inngest)

---

### Challenge 2: Multi-Jurisdiction Logic 🌍

**The Problem:**

I support **18 countries**. A tenancy agreement in Nigeria has different legal requirements than one in Canada or the UK.

How do I encode jurisdiction-specific rules without building a law firm's worth of logic?

**The Solution:**

I built a **jurisdiction rules engine** (`lib/jurisdiction-rules.js`):

```javascript
// lib/jurisdiction-rules.js

const JURISDICTION_RULES = {
  Nigeria: {
    contract_law: 'Lagos State Tenancy Law 2011',
    enforcement_strength: 'MEDIUM',
    typical_rates: {
      web_development: '₦150,000 - ₦500,000',
      design: '₦100,000 - ₦300,000',
    },
    change_order_requirements: ['Written agreement', 'Both parties sign'],
    statute_of_limitations: '6 years for breach of contract',
  },
  
  Canada: {
    contract_law: 'Alberta Contract Law',
    enforcement_strength: 'HIGH',
    typical_rates: {
      web_development: 'CA$5,000 - CA$20,000',
      design: 'CA$3,000 - CA$10,000',
    },
    change_order_requirements: ['Written consent', 'Consideration required'],
    statute_of_limitations: '2 years for breach of contract',
  },
  
  US: {
    contract_law: 'California Labor Code',
    enforcement_strength: 'HIGH',
    typical_rates: {
      web_development: '$5,000 - $30,000',
      design: '$3,000 - $15,000',
    },
    change_order_requirements: ['Written agreement', 'Clear consideration'],
    statute_of_limitations: '4 years for written contracts',
  },
  
  // ... 15 more jurisdictions
}

export function getJurisdictionRules(jurisdiction) {
  return JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.US
}

export function suggestRate(jurisdiction, workType) {
  const rules = getJurisdictionRules(jurisdiction)
  return rules.typical_rates[workType] || 'Market rate'
}
```

Then in the AI prompt, I inject jurisdiction-specific context:

```javascript
const prompt = `Generate a ${documentType} for ${jurisdiction}.

Applicable law: ${rules.contract_law}
Enforcement strength: ${rules.enforcement_strength}
Typical rates: ${rules.typical_rates[workType]}

Include clauses required by ${jurisdiction} law:
${rules.change_order_requirements.map(r => `- ${r}`).join('\n')}
`
```

**Result:** Documents are tailored to local law without me needing a law degree.

**What I'd do differently:**
- Partner with **local attorneys** to review rules (currently AI-generated)
- Add **versioning** (laws change, need to track which version was used)
- Build **compliance checks** (flag documents that might be non-compliant)

---

### Challenge 3: API Key + Rate Limiting 🔑

**The Problem:**

I have **4 pricing tiers** (Free, Starter, Pro, Scale). Each has different:
- Monthly document limits (5, 100, 500, 2000)
- Rate limits (10, 60, 120, 300 requests/minute)

How do I prevent abuse and track usage without a dedicated backend?

**The Solution:**

**Upstash Redis** for serverless rate limiting:

```javascript
// lib/api-auth.js

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const TIER_LIMITS = {
  free:       { requestsPerMin: 10,  docsPerMonth: 5   },
  starter:    { requestsPerMin: 60,  docsPerMonth: 100  },
  growth:     { requestsPerMin: 120, docsPerMonth: 500  },
  scale:      { requestsPerMin: 300, docsPerMonth: 2000 },
}

export async function authenticate(req) {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: { code: 'MISSING_AUTH' } }
  }

  const apiKey = authHeader.replace('Bearer ', '').trim()
  
  // Fetch key metadata from Redis
  const keyData = await redis.get(`apikey:${apiKey}`)
  if (!keyData) {
    return { ok: false, status: 401, error: { code: 'INVALID_API_KEY' } }
  }

  const tier = keyData.tier || 'free'
  const limits = TIER_LIMITS[tier]

  // Check monthly usage
  const month = new Date().toISOString().slice(0, 7) // '2026-03'
  const usage = await redis.get(`usage:${apiKey}:${month}`) || 0
  
  if (usage >= limits.docsPerMonth) {
    return { 
      ok: false, 
      status: 429, 
      error: { code: 'MONTHLY_LIMIT_REACHED' } 
    }
  }

  // Check rate limiting (sliding window)
  const now = Date.now()
  const windowStart = now - 60000 // 1 minute ago
  const recentRequests = await redis.zrangebyscore(
    `ratelimit:${apiKey}`,
    windowStart,
    now
  )
  
  if (recentRequests.length >= limits.requestsPerMin) {
    return { 
      ok: false, 
      status: 429, 
      error: { code: 'RATE_LIMIT_EXCEEDED' } 
    }
  }

  // Record this request
  await redis.zadd(`ratelimit:${apiKey}`, { score: now, member: now })
  await redis.expire(`ratelimit:${apiKey}`, 60) // Clean up after 1 min

  return { 
    ok: true, 
    apiKey, 
    tier, 
    limits, 
    usage 
  }
}

export async function recordUsage(auth) {
  const month = new Date().toISOString().slice(0, 7)
  await redis.incr(`usage:${auth.apiKey}:${month}`)
}
```

**Why Redis?**
- **Fast** (sub-millisecond lookups)
- **Serverless** (Upstash scales automatically)
- **Atomic operations** (no race conditions)
- **TTL support** (auto-cleanup for rate limit windows)

**Cost:** Free tier covers 10,000 commands/day. We're at ~2,000/day.

---

### Challenge 4: npm SDK Publication 📦

**The Problem:**

I wanted to publish my SDK as `@ebenova/legal-docs` (scoped package).

But npm requires you to **create an organization** for scoped packages. And organizations cost **$7/month** for public packages.

As a bootstrapped founder, every dollar counts.

**The Solution:**

Publish as **unscoped first**, migrate later:

```json
{
  "name": "ebenova-legal-docs",
  "version": "1.0.0",
  "description": "Node.js SDK for the Ebenova Legal Document API",
  "type": "module",
  "main": "src/index.js",
  "exports": {
    ".": {
      "import": "./src/index.js",
      "require": "./src/index.js"
    }
  },
  "types": "src/index.d.ts",
  "files": ["src", "README.md", "LICENSE"],
  "keywords": ["ebenova", "legal", "documents", "contracts", "nda", "api", "sdk"],
  "author": "Ebenova Solutions <api@ebenova.dev>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/ebenova/legal-docs-node"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Trade-offs:**
- ✅ Free to publish
- ✅ Works immediately
- ⚠️ Less branded (no `@ebenova` scope)
- ⚠️ Need to migrate later (breaking change for users)

**Migration plan:**
1. Publish unscoped (`ebenova-legal-docs@1.0.0`)
2. Create npm org when profitable (`@ebenova`)
3. Publish scoped version (`@ebenova/legal-docs@2.0.0`)
4. Deprecate unscoped version with migration notice

**Pro tip:** Create `.npmignore` to exclude unnecessary files:

```
# .npmignore
node_modules/
.env*
.git/
tests/
*.log
.vscode/
.DS_Store
```

---

## Lessons Learned

### 1. Start with Customer Interviews, Not Code

I spent **2 weeks building** before talking to a single potential user.

Big mistake.

When I finally did customer interviews, I learned:
- Freelancers care more about **enforcement** than generation
- "Scope creep" is the #1 pain point (hence Scope Guard)
- Most won't pay for documents, but will pay for **protection**

**What I'd do differently:**
- Week 1: Interview 20 freelancers
- Week 2: Build MVP based on feedback
- Week 3: Beta test with interviewees
- Week 4: Iterate and launch

### 2. AI as Co-Founder (Not Replacement)

I used AI for:
- ✅ Code generation (80% of my codebase)
- ✅ Prompt engineering (Claude writes better prompts than me)
- ✅ Documentation (README, API docs)
- ✅ Marketing copy (website, social posts)

AI couldn't do:
- ❌ Customer interviews (need human empathy)
- ❌ Product decisions (what to build, why)
- ❌ Debugging complex issues (need human intuition)
- ❌ Building relationships (partners, users, community)

**My workflow:**
1. Describe problem to AI in plain English
2. Review generated code critically
3. Test thoroughly (AI makes mistakes)
4. Iterate based on real-world feedback

AI is a **force multiplier**, not a replacement for founder judgment.

### 3. Solo Founder Reality

**The good:**
- Complete creative control
- Fast decision-making (no meetings)
- All equity (no dilution)
- Pride of building something real

**The hard:**
- Context-switching (CEO + CTO + support + marketing)
- Burnout (no weekends, no vacations)
- Loneliness (no co-founder to vent to)
- Imposter syndrome ("am I qualified for this?")

**What keeps me going:**
- User testimonials ("This saved my business!")
- Small wins (first paying customer, first star on GitHub)
- Community (Twitter/X builder community, Indie Hackers)
- Vision (legal infrastructure for 2B people)

**Advice for other solo founders:**
1. **Set boundaries** (no work after 8pm, one day off/week)
2. **Find a community** (Indie Hackers, Twitter/X, local meetups)
3. **Celebrate small wins** (first user, first dollar, first PR)
4. **Remember why you started** (re-read customer messages when discouraged)

### 4. Advice for API Builders

If you're building an API platform:

1. **Developer experience is everything**
   - Clear docs (with working examples)
   - SDKs in popular languages (Node.js, Python, Go)
   - Free tier (let developers try before buying)

2. **Rate limiting is non-negotiable**
   - Prevents abuse
   - Enables tiered pricing
   - Protects your infrastructure

3. **Error messages are your UX**
   - Don't just say "error" — explain what went wrong
   - Include hints ("Upgrade at /pricing" or "Check your API key")
   - Log everything (you'll need it for debugging)

4. **Version from day one**
   - Use `/v1/` in your API paths
   - Plan for breaking changes
   - Deprecate gracefully (give users time to migrate)

5. **Build in public**
   - Share your journey (Twitter/X, Dev.to, LinkedIn)
   - Be honest about struggles (not just wins)
   - Community will help you improve

---

## What's Next

### Q2 2026 Roadmap

**April 2026 — Scope Guard MVP**
- Detect contract violations (scope creep, revision limits, timeline changes)
- Auto-draft professional responses (change orders, pushback emails)
- Included in Pro tier ($19.99/mo)

**May 2026 — Africa Payouts API**
- Send payments to 10+ African countries
- Bank transfer + mobile money + crypto (USDT)
- Solves the "how do I get paid?" problem

**June 2026 — Python SDK**
- For data scientists, AI engineers, backend developers
- Same features as Node.js SDK
- Type hints, async support

**July 2026 — Product Hunt Launch**
- April 21, 2026 (mark your calendar!)
- Goal: #1 Product of the Day
- Launching with Scope Guard + Africa Payouts

**Long-term Vision:**
- 2027: Expand to Latin America, Southeast Asia
- 2028: Dispute resolution marketplace (connect users with local attorneys)
- 2030: Legal infrastructure for 100M+ users

Ambitious? Yes.

Necessary? Also yes.

---

## Call-to-Action

If you made it this far, thank you for reading. 🙏

Here's how you can support:

### 1. Try the Free Tier
→ [ebenova.dev/api](https://ebenova.dev/api)
- 5 documents/month free
- All 27 document types
- All 18 jurisdictions
- No credit card required

### 2. Install the SDK
```bash
npm install ebenova-legal-docs
```
→ [npmjs.com/package/ebenova-legal-docs](https://npmjs.com/package/ebenova-legal-docs)

### 3. Star the GitHub Repo
→ [github.com/ebenova/legal-docs-node](https://github.com/ebenova/legal-docs-node)
- Help us get discovered
- Contribute code, docs, examples
- Report bugs, request features

### 4. Follow the Journey
- Twitter/X: [@ebenova_dev](https://twitter.com/ebenova_dev) (coming soon)
- LinkedIn: [Ebenova Solutions](https://linkedin.com/company/ebenova)
- Dev.to: [More articles](https://dev.to/ebenova)

### 5. Join Scope Guard Waitlist
→ [ebenova.dev/scope-guard](https://ebenova.dev/scope-guard)
- Get notified when MVP launches (April 2026)
- Early access + 50% off first 3 months

---

## Questions?

Drop them in the comments below! I'm here to help.

Whether you're:
- A developer wanting to integrate legal docs
- A freelancer tired of scope creep
- A solo founder building in public
- Just curious about the tech stack

Let's chat. 🚀

---

**About the Author:**

[Your Name] is the founder of [Ebenova](https://ebenova.dev) — legal infrastructure for informal commerce. Nigerian-Canadian based in Calgary. Solo founder, non-technical, AI-assisted. Building in public.

**Related Articles:**
- [Scope Guard Feature Specification](https://ebenova.dev/blog/scope-guard-spec)
- [Product Hunt Launch Strategy](https://ebenova.dev/blog/product-hunt-launch)
- [API Design Best Practices](https://ebenova.dev/blog/api-design)

---

*Originally published at [ebenova.dev/blog](https://ebenova.dev/blog) on March 28, 2026.*
