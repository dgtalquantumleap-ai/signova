// src/pages/Insights.jsx
// Ebenova Insights — landing page at ebenova.dev/insights and getsignova.com/insights
// Full product page: hero, live preview, how it works, features, API docs, pricing, waitlist

import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import './Insights.css'

const API_BASE   = import.meta.env.VITE_API_BASE   || 'https://api.ebenova.dev'
const BILLING_BASE = import.meta.env.VITE_API_BASE || 'https://api.ebenova.dev'

// ── Email preview mock data ───────────────────────────────────────────────────
const PREVIEW_MATCHES = [
  {
    keyword: 'freelance contract',
    subreddit: 'freelance',
    author: 'devguy_works',
    score: 47,
    comments: 23,
    title: "Client wants to 'revise' our agreement 2 weeks after delivery — what do I do?",
    body: "We agreed to a fixed scope via WhatsApp. Now they're claiming the deliverables were supposed to include something we never discussed. I have no written contract, just screenshots of our chat…",
    draft: "Happened to me last year — the WhatsApp screenshots actually helped in my case. First thing: write up exactly what was agreed in a proper document, even retroactively. There's a tool called Signova that lets you paste chat history and it pulls out the key terms for you. At minimum, send them a written summary email now so you have a timestamp.",
    approved: true,
  },
  {
    keyword: 'client refused to pay',
    subreddit: 'freelancers',
    author: 'mimi_codes',
    score: 12,
    comments: 8,
    title: "Delivered full project, client ghosting — how do you all handle this?",
    body: "It's been 3 weeks. Invoice is overdue. They were responsive until I sent the final files. No written contract, just emails…",
    draft: null,
    approved: true,
  },
  {
    keyword: 'NDA template',
    subreddit: 'AskHR',
    author: 'startup_founder_23',
    score: 5,
    comments: 3,
    title: 'Need a quick NDA for a new hire starting Monday',
    body: 'Looking for a solid mutual NDA template that covers IP and confidentiality. Based in Canada.',
    draft: null,
    approved: false,
  },
]

// ── EmailPreview ──────────────────────────────────────────────────────────────
function EmailPreview() {
  return (
    <div className="ins-email-preview">
      <div className="ins-email-chrome">
        <span className="ins-dot red" /><span className="ins-dot yellow" /><span className="ins-dot green" />
        <span className="ins-chrome-bar">📨 Insights: 3 new mentions — freelance contract, client refused to pay…</span>
      </div>
      <div className="ins-email-body">
        <div className="ins-email-header">
          <div className="ins-email-title">📡 Ebenova Insights Alert</div>
          <div className="ins-email-meta">3 mentions · {new Date().toUTCString().slice(0, 16)}</div>
        </div>
        {PREVIEW_MATCHES.map((m, i) => (
          <div key={i} className="ins-match-card">
            <div className="ins-match-meta">r/{m.subreddit} · u/{m.author} · {m.score} upvotes</div>
            <div className="ins-match-title">{m.title}</div>
            <div className="ins-match-body">{m.body}</div>
            {!m.approved && <div className="ins-dnp">⚠️ DO NOT POST — r/{m.subreddit} not approved</div>}
            {m.draft && (
              <div className="ins-draft-box">
                <div className="ins-draft-label">✏️ Suggested reply</div>
                <div className="ins-draft-text">{m.draft}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CheckoutButton ────────────────────────────────────────────────────────────
// Hits the billing/checkout endpoint and redirects to Stripe.
function CheckoutButton({ tier, label, className = 'ins-btn-gold', children }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleClick() {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`${BILLING_BASE}/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setError(data.error?.message || 'Checkout failed — try again')
        setLoading(false)
      }
    } catch {
      setError('Network error — try again')
      setLoading(false)
    }
  }

  return (
    <div>
      <button className={className} onClick={handleClick} disabled={loading}>
        {loading ? 'Redirecting to checkout…' : (children || label)}
      </button>
      {error && <div className="ins-error" style={{ marginTop: '8px' }}>{error}</div>}
    </div>
  )
}

// ── WaitlistForm (fallback for Scale / contact-us tier) ────────────────────────
function WaitlistForm({ plan = 'starter', onSuccess }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${API_BASE}/v1/insights/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan }),
      })
      const data = await res.json()
      if (data.success) { setSuccess(true); if (onSuccess) onSuccess(email) }
      else setError(data.error?.message || 'Something went wrong.')
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  if (success) return <div className="ins-success">✓ You're on the list — we'll be in touch.</div>

  return (
    <div>
      <form className="ins-waitlist-form" onSubmit={handleSubmit}>
        <input type="email" placeholder="your@email.com" value={email}
          aria-label="Email address"
          onChange={e => setEmail(e.target.value)} required />
        <button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Contact us'}</button>
      </form>
      {error && <div className="ins-error">{error}</div>}
    </div>
  )
}

// ── CodeBlock ─────────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="ins-code-block">
      <div className="ins-code-header">
        <span className="ins-code-lang">{lang}</span>
        <button className="ins-code-copy" onClick={copy} aria-label={`Copy ${lang} code`}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

// ── API DOCS SNIPPETS ─────────────────────────────────────────────────────────
const CREATE_MONITOR_SNIPPET = `curl -X POST https://api.ebenova.dev/v1/insights/monitors/create \\
  -H "Authorization: Bearer sk_live_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My SaaS",
    "productContext": "We help freelancers send professional invoices in 30 seconds.",
    "alertEmail": "you@yourcompany.com",
    "keywords": [
      { "keyword": "invoice tool freelance", "subreddits": ["freelance","freelancers"] },
      { "keyword": "unpaid invoice", "subreddits": ["freelance","smallbusiness"] }
    ]
  }'`

const LIST_MATCHES_SNIPPET = `curl "https://api.ebenova.dev/v1/insights/matches?monitor_id=mon_abc123&limit=20" \\
  -H "Authorization: Bearer sk_live_your_key"`

const RESPONSE_SNIPPET = `{
  "success": true,
  "matches": [
    {
      "id": "1abc23",
      "title": "Client won't pay after 3 weeks — no contract",
      "url": "https://reddit.com/r/freelance/...",
      "subreddit": "freelance",
      "keyword": "unpaid invoice",
      "approved": true,
      "draft": "Went through this last year. First step: send a formal...",
      "score": 47,
      "createdAt": "2026-03-31T08:12:00Z"
    }
  ]
}`

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Insights() {
  const waitlistRef = useRef(null)
  const scrollToWaitlist = () => waitlistRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return (
    <div className="ins-page">
      <Helmet>
        <title>Ebenova Insights — Reddit Monitoring for Founders | Know When Reddit Talks About Your Product</title>
        <meta name="description" content="Monitor Reddit and Nairaland for your keywords every 15 minutes. Get alerts with AI-drafted replies. Built for founders doing distribution." />
        <link rel="canonical" href="https://www.ebenova.dev/insights" />
        <link rel="alternate" hreflang="en" href="https://www.ebenova.dev/insights" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ebenova" />
        <meta property="og:url" content="https://www.ebenova.dev/insights" />
        <meta property="og:title" content="Ebenova Insights — Reddit Monitoring for Founders" />
        <meta property="og:description" content="Know when Reddit talks about your product. 15-min alerts with AI-drafted replies. Nairaland included." />
        <meta property="og:image" content="https://www.ebenova.dev/og-image-ebenova.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Ebenova Insights — Reddit Monitoring for Founders" />
        <meta name="twitter:description" content="Know when Reddit talks about your product. 15-min alerts with AI-drafted replies. Nairaland included." />
        <meta name="twitter:image" content="https://www.ebenova.dev/og-image-ebenova.png" />
      </Helmet>

      {/* ── Nav ── */}
      <nav className="ins-nav">
        <a href="https://ebenova.dev" className="ins-nav-brand">
          <span className="ins-nav-logo">📡 Ebenova Insights</span>
          <span className="ins-nav-badge">Live</span>
        </a>
        <div className="ins-nav-links">
          <a href="#how" className="ins-nav-link">How it works</a>
          <a href="#api" className="ins-nav-link">API</a>
          <a href="#pricing" className="ins-nav-link">Pricing</a>
          <button className="ins-nav-cta" onClick={scrollToWaitlist}>Get access</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="ins-hero">
        <div className="ins-eyebrow">Reddit monitoring · built for founders</div>
        <h1>Know when Reddit talks<br />about <em>your problem</em>.</h1>
        <p className="ins-hero-sub">
          Insights scans Reddit and Nairaland for your keywords every 15 minutes.
          When someone posts your pain point, you get an alert — with an AI-drafted reply
          that sounds like a person, not a pitch.
        </p>
        <div className="ins-hero-actions">
          <button className="ins-btn-gold" onClick={scrollToWaitlist}>Join waitlist — $49/mo</button>
          <a href="#preview" className="ins-btn-ghost">See a live alert →</a>
        </div>
        <div className="ins-hero-proof">
          <span>71+ keywords monitored</span>
          <span>·</span>
          <span>15-min poll</span>
          <span>·</span>
          <span>Reddit + Nairaland</span>
          <span>·</span>
          <span>AI reply drafts</span>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div className="ins-stats">
        {[
          ['71+', 'Keywords monitored live'],
          ['15 min', 'Poll interval'],
          ['2', 'Platforms (Reddit + Nairaland)'],
          ['~3 min', 'Post → inbox'],
        ].map(([n, l]) => (
          <div key={l} className="ins-stat">
            <div className="ins-stat-n">{n}</div>
            <div className="ins-stat-l">{l}</div>
          </div>
        ))}
      </div>

      {/* ── Email preview ── */}
      <section id="preview" className="ins-section ins-preview-section">
        <div className="ins-section-label">What lands in your inbox</div>
        <h2>Real alerts. Real context. Draft included.</h2>
        <p className="ins-section-sub">Every alert shows post intent, subreddit safety rating, and a human-sounding reply — ready to copy.</p>
        <EmailPreview />
      </section>

      {/* ── How it works ── */}
      <section id="how" className="ins-section ins-how-section">
        <div className="ins-section-label">How it works</div>
        <h2>Four steps, fully automated</h2>
        <div className="ins-steps">
          {[
            ['01', 'Set your keywords', 'Tell us what problems your product solves. We build the keyword list — or you bring your own via the API.'],
            ['02', 'We monitor 24/7', 'Every 15 minutes: Reddit subreddits + Nairaland sections scanned for fresh posts matching your keywords.'],
            ['03', 'Alert in your inbox', 'Posts grouped by keyword. Each one includes subreddit safety check (approved / DO NOT POST) and AI draft.'],
            ['04', 'Post, convert, repeat', 'Review the draft, tweak if needed, reply. No missed threads. No manual searching.'],
          ].map(([n, t, d]) => (
            <div key={n} className="ins-step">
              <div className="ins-step-n">Step {n}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="ins-features-section">
        <div className="ins-features-inner">
          <div className="ins-section-label">Features</div>
          <h2>Built for distribution, not vanity metrics</h2>
          <div className="ins-features-grid">
            {[
              ['🎯', 'Subreddit-scoped search', 'Keywords run against the exact subreddits you care about — fewer false positives, higher intent.', null],
              ['✍️', 'AI reply drafts', 'Groq + Llama 3.3 70b. Community tone, not marketing copy. Helpful first, product mention optional.', 'Groq / Llama 3.3 70b'],
              ['🛡️', 'Subreddit safety system', '71-subreddit whitelist. Every match flagged approved or DO NOT POST automatically.', null],
              ['🌍', 'Nairaland included', "Nigeria's largest forum monitored alongside Reddit. Essential for products targeting African users.", null],
              ['🔌', 'Full REST API', 'Create monitors, list matches, trigger drafts, send feedback — all via API. Bring your own dashboard.', 'Growth+'],
              ['🔍', 'Semantic search', 'Embedding-based search catches intent even when your keyword isn\'t in the post. Coming in V2.', 'Coming soon'],
            ].map(([icon, title, desc, tag]) => (
              <div key={title} className="ins-feature-card">
                <div className="ins-feature-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
                {tag && <span className="ins-tag">{tag}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── API Docs ── */}
      <section id="api" className="ins-section ins-api-section">
        <div className="ins-api-inner">
          <div className="ins-section-label">REST API</div>
          <h2>Use it as a service. Plug it into anything.</h2>
          <p className="ins-section-sub">Growth and Scale plans include full API access. Create monitors, pull matches, regenerate drafts — all programmatically.</p>

          <div className="ins-api-block">
            <div className="ins-api-endpoint">
              <span className="ins-method post">POST</span>
              <span className="ins-path">https://api.ebenova.dev/v1/insights/monitors/create</span>
            </div>
            <p className="ins-api-desc">Create a keyword monitor. Set keywords, subreddits, your product context, and alert email.</p>
            <CodeBlock code={CREATE_MONITOR_SNIPPET} lang="bash" />
          </div>

          <div className="ins-api-block">
            <div className="ins-api-endpoint">
              <span className="ins-method get">GET</span>
              <span className="ins-path">https://api.ebenova.dev/v1/insights/matches</span>
            </div>
            <p className="ins-api-desc">Pull recent matches for a monitor. Returns posts, drafts, subreddit approval status, and feedback state.</p>
            <CodeBlock code={LIST_MATCHES_SNIPPET} lang="bash" />
            <CodeBlock code={RESPONSE_SNIPPET} lang="json" />
          </div>

          <div className="ins-api-endpoints-table">
            <div className="ins-api-row header">
              <span>Method</span><span>Endpoint</span><span>Description</span>
            </div>
            {[
              ['GET',    '/v1/insights/monitors',          'List your monitors'],
              ['POST',   '/v1/insights/monitors',          'Create a monitor'],
              ['DELETE', '/v1/insights/monitors/:id',      'Deactivate a monitor'],
              ['GET',    '/v1/insights/matches',           'List matches for a monitor'],
              ['POST',   '/v1/insights/matches/draft',     'Regenerate AI draft'],
              ['POST',   '/v1/insights/matches/feedback',  'Rate a draft (up/down)'],
            ].map(([method, path, desc]) => (
              <div key={path} className="ins-api-row">
                <span className={`ins-method-sm ${method.toLowerCase()}`}>{method}</span>
                <span className="ins-api-path-sm">{path}</span>
                <span className="ins-api-desc-sm">{desc}</span>
              </div>
            ))}
          </div>

          <div className="ins-api-auth-note">
            Base URL: <code>https://api.ebenova.dev</code> &nbsp;·&nbsp; All endpoints require <code>Authorization: Bearer sk_live_your_key</code> with Insights access.
            {' '}<a href="mailto:akin@ebenova.dev">Email us</a> to get a key during beta.
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="ins-section ins-pricing-section">
        <div className="ins-section-label">Pricing</div>
        <h2>Simple pricing. Founding rate locked.</h2>
        <p className="ins-section-sub">Beta opens to 10 founding members. $49/month locked for life.</p>

        <div className="ins-pricing-grid">
          {[
            {
              name: 'Starter', price: '$49', period: '/month',
              tier: 'insights_starter',
              desc: 'For indie builders monitoring one or two products.',
              features: ['3 monitors', '20 keywords per monitor', 'Reddit + Nairaland', 'AI reply drafts', 'Email alerts (15-min)', 'Subreddit safety system'],
            },
            {
              name: 'Growth', price: '$99', period: '/month', featured: true,
              tier: 'insights_growth',
              desc: 'For teams actively using Reddit as a distribution channel.',
              features: ['20 monitors', '100 keywords per monitor', 'Reddit + Nairaland', 'AI drafts (Claude Haiku)', 'Feedback loop', 'Full REST API access', 'Semantic search (V2)'],
            },
            {
              name: 'Scale', price: '$249', period: '/month',
              tier: 'insights_scale',
              desc: 'For agencies running multi-product monitoring at scale.',
              features: ['100 monitors', '500 keywords each', 'All platforms + custom', 'AI drafts (Claude Sonnet)', 'Priority support', 'API + webhooks', 'White-label ready'],
              contactUs: true,
            },
          ].map(plan => (
            <div key={plan.name} className={`ins-plan ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <div className="ins-plan-badge">Most popular</div>}
              <div className="ins-plan-name">{plan.name}</div>
              <div className="ins-plan-price">{plan.price}<span>{plan.period}</span></div>
              <p className="ins-plan-desc">{plan.desc}</p>
              <ul className="ins-plan-features">
                {plan.features.map(f => <li key={f}>{f}</li>)}
              </ul>
              {plan.contactUs
                ? <WaitlistForm plan={plan.tier} />
                : <CheckoutButton
                    tier={plan.tier}
                    className={`ins-plan-cta ${plan.featured ? 'gold' : 'outline'}`}
                  >
                    Get {plan.name} →
                  </CheckoutButton>
              }
            </div>
          ))}
        </div>
      </section>

      {/* ── Waitlist ── */}
      <section className="ins-waitlist-section" ref={waitlistRef}>
        <h2>Get early access</h2>
        <p>Beta opens to 10 founding members. You get $49/month locked for life, plus direct setup support from the builder.</p>
        <WaitlistForm plan="starter" />
      </section>

      {/* ── Footer ── */}
      <footer className="ins-footer">
        <div className="ins-footer-links">
          <a href="https://ebenova.dev">Ebenova API Platform</a>
          <span>·</span>
          <a href="https://getsignova.com">Signova</a>
          <span>·</span>
          <a href="mailto:akin@ebenova.dev">akin@ebenova.dev</a>
          <span>·</span>
          <Link to="/privacy">Privacy</Link>
          <span>·</span>
          <Link to="/terms">Terms</Link>
        </div>
        <div className="ins-footer-copy">© {new Date().getFullYear()} Ebenova Solutions · Africa-first · Built in Canada</div>
      </footer>

    </div>
  )
}
