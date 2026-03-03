# Signova — SEO, Awareness & Reddit Strategy

---

## STEP 1 — Google Search Console (do this today — 15 minutes)

This tells Google your site exists and cuts indexing from weeks to days.

1. Go to: https://search.google.com/search-console
2. Click "Add property" → choose "URL prefix" → enter: https://www.getsignova.com
3. Verify ownership — easiest method:
   - Choose "HTML tag" verification
   - Copy the meta tag it gives you (looks like: <meta name="google-site-verification" content="XXXX">)
   - Add it to index.html inside <head> (I'll do this once you have the code)
4. Once verified, click "Sitemaps" in the left menu
5. Enter: sitemap.xml → click Submit
6. Done — Google will begin crawling within 24-48 hours

---

## STEP 2 — Bing Webmaster Tools (5 minutes — 15% of searches)

1. Go to: https://www.bing.com/webmasters
2. Sign in with Microsoft account
3. Add site: https://www.getsignova.com
4. Import from Google Search Console (easiest option — does everything automatically)

---

## STEP 3 — Reddit Posts (post these this week)

### Post 1 — r/freelance (best audience, ~500K members)

**Title:**
Built a free tool that generates NDAs and freelance contracts in 2 minutes — feedback welcome

**Body:**
Been freelancing for a few years and always found it annoying that getting a proper NDA or contract meant either paying a lawyer $300+ or using some generic template from 2015 that didn't reflect my actual situation.

So I built Signova — you answer a few questions about your project/client and it generates a tailored document using AI. Preview is completely free, $4.99 if you want to download the clean PDF.

Currently supports:
- NDA (mutual and one-way)
- Freelance Contract
- Independent Contractor Agreement
- Privacy Policy
- Terms of Service

Would love honest feedback from other freelancers — does this actually solve a real problem for you? What's missing?

Link: https://getsignova.com

---

### Post 2 — r/entrepreneur (~3M members)

**Title:**
I built and launched a legal document generator in 2 weeks — here's what I learned

**Body:**
Wanted to share a quick build log for anyone thinking about launching a similar tool.

The insight: privacy policy generators get 450,000 searches per month. People who search for them need a document TODAY — they're not browsing. That's a high-intent, high-conversion audience.

What I built: Signova (getsignova.com) — answer a few questions, get a professional Privacy Policy, NDA, Freelance Contract, Terms of Service, or Independent Contractor Agreement. Preview free, $4.99 to download.

Stack: React, Claude API for generation, Lemon Squeezy for payments, Vercel for hosting. Total cost to run: ~$35/month at early stage.

The hardest part wasn't the tech — it was making sure the legal disclaimers were right. Learned a lot about unauthorized practice of law rules. Happy to answer questions on that if useful.

What would you add first — more document types or a subscription plan?

---

### Post 3 — r/webdev (~900K members)

**Title:**
Built an AI legal document generator — React + Claude API + Vercel, no backend needed

**Body:**
Just launched Signova (getsignova.com) — generates NDAs, privacy policies, freelance contracts etc. using Claude as the generation engine.

The interesting technical bit: there's no database. User fills a form → POST to a Vercel serverless function → Claude generates the document → stored in sessionStorage → preview shown with watermark → Lemon Squeezy checkout for the clean PDF.

Whole thing is stateless until I add subscriptions (that'll need Supabase + user accounts).

Happy to answer questions on the architecture or the Claude prompting approach.

---

### Post 4 — r/smallbusiness (~1.5M members)

**Title:**
Free privacy policy and terms of service generator — no account needed

**Body:**
If you run a website or app and don't have a privacy policy yet, you're technically in violation of GDPR, CCPA, and most app store rules.

Built a free tool to fix that: getsignova.com

Fill in a few details about your business → get a complete, tailored privacy policy or terms of service in under 2 minutes. Preview is free, $4.99 to download the clean PDF.

Also does NDAs and freelance contracts if you need those.

No account, no subscription, no catch.

---

## STEP 4 — Other awareness channels (week 2)

### Product Hunt launch
- Create account at producthunt.com
- Schedule launch for a Tuesday or Wednesday (highest traffic days)
- Title: "Signova — AI Legal Document Generator"
- Tagline: "Professional privacy policies, NDAs and contracts in 2 minutes"
- Post in: Developer Tools, Legal Tech, Productivity

### Twitter/X thread
Post a build thread: "Built a legal document generator in 2 weeks. Here's how:"
- Tweet 1: The problem (lawyers cost $300/hr for standard docs)
- Tweet 2: The insight (450K monthly searches for privacy policy generator)
- Tweet 3: The stack (React, Claude API, Vercel, Lemon Squeezy)
- Tweet 4: The legal research (UPL rules, LegalZoom precedent)
- Tweet 5: The launch (getsignova.com — link)

Build threads consistently get 50-200 followers and drive hundreds of signups.

### Indie Hackers
Post in indiehackers.com — the "Share your product" section.
This audience specifically looks for and uses new tools like Signova.

---

## STEP 5 — Ongoing SEO (weeks 2-4)

### Keywords already in the page (good):
- "legal document generator"
- "privacy policy generator"
- "NDA generator"
- "freelance contract"

### Keywords to add naturally in copy:
- "free NDA template"
- "privacy policy for website"
- "privacy policy for app"
- "freelance contract template Canada/UK/US"
- "independent contractor agreement template"
- "terms of service generator free"

### Backlinks that help:
- Get listed on: alternativeto.net (list as alternative to LegalZoom)
- Get listed on: theresanaiforthat.com (AI tool directory)
- Get listed on: futurepedia.io (AI tool directory)
- Get listed on: topai.tools

Each listing = a backlink + direct referral traffic.

---

## KEYWORD SEARCH VOLUMES (monthly)

| Keyword | Monthly searches | Competition |
|---|---|---|
| privacy policy generator | 450,000 | High |
| free privacy policy generator | 110,000 | High |
| NDA template | 90,000 | Medium |
| freelance contract template | 40,000 | Medium |
| terms of service generator | 35,000 | Medium |
| independent contractor agreement | 27,000 | Medium |
| NDA generator | 18,000 | Low |
| freelance contract generator | 8,000 | Low |

Focus first on the LOW competition keywords — easier to rank quickly as a new site.
"NDA generator" and "freelance contract generator" are realistic page-1 targets within 60-90 days.

---

## REALISTIC TRAFFIC PROJECTIONS

| Timeline | Source | Monthly visitors |
|---|---|---|
| Week 1 | Reddit posts | 200-800 |
| Week 2 | Product Hunt | 500-2,000 (one day spike) |
| Month 1 | Direct + social | 500-1,500 |
| Month 2 | SEO starts kicking in | 1,000-3,000 |
| Month 3 | Ranking for low-competition terms | 2,000-6,000 |
| Month 6 | Compounding SEO | 5,000-15,000 |

At 2% conversion (industry standard for this type of tool) and $4.99:
- 1,000 visitors/month = ~20 sales = ~$100/month
- 5,000 visitors/month = ~100 sales = ~$499/month
- 15,000 visitors/month = ~300 sales = ~$1,497/month

This is before the $9.99/month subscription plan goes live.
