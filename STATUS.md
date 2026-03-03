# Signova — Status & Handoff

**Domain:** getsignova.com
**Stack:** React + Vite, Vercel (hosting + serverless), Stripe (payments), Claude API (generation)
**Project folder:** C:\projects\signova

---

## WHAT IS BUILT ✅

### Pages (src/pages/)
- **Landing.jsx** — Hero, 5 document cards, how it works, pricing (Free/4.99/9.99), trust section, CTA, footer
- **Generator.jsx** — Full form for all 5 document types, validation, loading state, calls /api/generate
- **Preview.jsx** — Document preview with watermark, Stripe checkout, post-payment download

### API (api/)
- **generate.js** — Vercel serverless function, proxies Claude API securely (key server-side only)
- **checkout.js** — Vercel serverless function, creates Stripe checkout session ($4.99 one-time)

### Config
- **vercel.json** — SPA routing + API routes
- **.env** — Key structure documented (values need filling — see below)

### Design
- Dark theme (#0e0e0e background, gold #c9a84c accent)
- Playfair Display (headings) + DM Sans (body)
- Animated hero ticker cycling through document types
- Responsive — mobile nav collapses, preview layout stacks

---

## WHAT NEEDS TO BE DONE BEFORE LAUNCH

### 1 — Fill in real API keys (YOU — 15 minutes)

**Stripe:**
1. Go to dashboard.stripe.com → Developers → API Keys
2. Copy the Publishable key → paste in .env as VITE_STRIPE_PUBLIC_KEY
3. Copy the Secret key → you'll add this in Vercel dashboard (NOT in .env file)

**Anthropic:**
1. Go to console.anthropic.com → API Keys → Create key
2. Copy it → add in Vercel dashboard (NOT in .env file)

**Vercel environment variables (dashboard.vercel.com → your project → Settings → Environment Variables):**
- ANTHROPIC_API_KEY = your Claude key
- STRIPE_SECRET_KEY = your Stripe secret key

### 2 — Deploy to Vercel (15 minutes)

```bash
cd C:\projects\signova

# Install Vercel CLI if not already installed
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

When prompted:
- Link to existing project? No → create new
- Project name: signova
- Directory: ./
- Build command: npm run build
- Output directory: dist

### 3 — Connect getsignova.com domain (10 minutes)

In Vercel dashboard → your project → Settings → Domains:
1. Add: getsignova.com
2. Add: www.getsignova.com
3. Copy the DNS records Vercel shows you
4. Go to Namecheap → getsignova.com → DNS → paste the records
5. Wait 10-30 min for propagation

### 4 — Add Stripe webhook (10 minutes)

In Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: https://getsignova.com/api/checkout
- Events: checkout.session.completed

This is optional for launch — the current flow redirects to /preview?payment=success
which is sufficient for MVP. Webhooks can be added in week 2.

---

## DOCUMENT TYPES SUPPORTED

| Document | Form fields | Est. generation time |
|---|---|---|
| Privacy Policy | Company, URL, country, data collected, third parties, contact | ~8 seconds |
| Terms of Service | Company, URL, governing law, service description, subscriptions, contact | ~8 seconds |
| NDA | Disclosing party, receiving party, purpose, duration, governing law, mutual? | ~6 seconds |
| Freelance Contract | Freelancer, client, services, rate, payment terms, governing law, IP ownership | ~8 seconds |
| Independent Contractor | Company, contractor, services, compensation, term, governing law, non-compete | ~8 seconds |

---

## MONETISATION FLOW

1. User picks document → fills form → clicks Generate
2. Claude generates via /api/generate (server-side, key protected)
3. Document stored in sessionStorage, user redirected to /preview
4. Preview shows document with diagonal watermark "PREVIEW ONLY · SIGNOVA"
5. User clicks "Pay $4.99 & Download" → Stripe checkout opens
6. On success, redirected to /preview?payment=success → watermark removed → download available
7. Download uses browser print-to-PDF (no server-side PDF library needed)

---

## PRICING IN THE APP

| Tier | Price | What they get |
|---|---|---|
| Free Preview | $0 | Full document, watermarked, browser only |
| Single Document | $4.99 | Clean PDF download, one document |
| Unlimited | $9.99/mo | Unlimited documents (not yet wired — Phase 2) |

Note: The $9.99/month plan is shown in the pricing section but not yet wired to Stripe subscriptions.
This is intentional — validate demand at $4.99 first, add subscriptions in week 3.

---

## ESTIMATED COSTS AT LAUNCH

| Item | Cost |
|---|---|
| Vercel hosting | Free (Hobby tier, sufficient for early traffic) |
| Claude API | ~$0.03 per document generated |
| Stripe fees | 2.9% + $0.30 per transaction (~$0.44 on $4.99) |
| Domain | ~$1/month |
| **Total at 0 sales** | ~$1/month |
| **At 100 sales/month** | ~$4.44 in Stripe fees + $3 Claude API = ~$8 |

---

## NEXT: PHASE 2 (week 3-4)

- Add Supabase for user accounts + purchase history
- Wire the $9.99/month subscription via Stripe Billing
- Add 5 more document types (Employment Agreement, LLC Operating Agreement, etc.)
- Add SEO meta tags and sitemap.xml
- Begin Proposal Builder (Product 2)

---

## STATUS: Ready to deploy once API keys are added.
