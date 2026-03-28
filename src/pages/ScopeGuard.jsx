import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import './ScopeGuard.css'

const VIOLATIONS = [
  {
    icon: '📦',
    title: 'Scope creep',
    example: '"Can you also add a blog section? Should be quick."',
    response: 'Auto-drafts a change order with estimated hours and cost.',
  },
  {
    icon: '🔄',
    title: 'Extra revisions',
    example: '"One more round of changes — just small tweaks!"',
    response: 'Cites your revision limit clause and offers a paid revision quote.',
  },
  {
    icon: '⏰',
    title: 'Deadline compression',
    example: '"Actually, we need this by Friday, not end of month."',
    response: 'Calculates rush fee and sends a formal timeline adjustment notice.',
  },
  {
    icon: '💸',
    title: 'Unpaid extras',
    example: '"Can you handle the hosting setup too? It\'s tiny."',
    response: 'Flags the request as outside scope and drafts a professional pushback.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Generate your contract',
    body: 'Create any freelance, service, or consulting contract using Signova. Scope Guard stores the agreed terms.',
  },
  {
    num: '02',
    title: 'Paste the client message',
    body: 'When a client asks for something extra, paste their message. Scope Guard reads your contract and detects the violation.',
  },
  {
    num: '03',
    title: 'Send the response',
    body: 'Choose from three drafted responses — friendly, change order, or firm. Customise if needed. Send in seconds.',
  },
]

export default function ScopeGuard() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError('Enter a valid email address.'); return }
    setLoading(true)
    setError('')
    try {
      await fetch('/api/scope-guard-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sg-page">
      <Helmet>
        <title>Scope Guard — Stop Scope Creep Before It Costs You | Signova</title>
        <meta name="description" content="Scope Guard detects when client requests violate your contract and auto-drafts professional responses. Coming April 2026. Join the waitlist for early access." />
        <link rel="canonical" href="https://ebenova.dev/scope-guard" />
        <meta property="og:title" content="Scope Guard — AI-powered contract enforcement for freelancers" />
        <meta property="og:description" content="Paste a client message. Scope Guard reads your contract, detects the violation, and drafts your response in seconds." />
      </Helmet>

      {/* Nav */}
      <nav className="sg-nav">
        <div className="sg-logo" onClick={() => navigate('/')}>
          <span className="sg-logo-mark">E</span>
          <span className="sg-logo-text">ebenova.dev</span>
        </div>
        <a href="/docs" className="sg-nav-link">Docs</a>
      </nav>

      {/* Hero */}
      <section className="sg-hero">
        <div className="sg-hero-inner">
          <div className="sg-badge">
            <span className="sg-badge-dot" />
            Coming April 2026
          </div>

          <h1 className="sg-title">
            Stop scope creep<br />before it costs you
          </h1>

          <p className="sg-sub">
            Paste a client message. Scope Guard reads your contract, detects the violation,
            and drafts a professional response in seconds — change order, pushback, or firm notice.
          </p>

          {/* Waitlist form */}
          <div className="sg-waitlist-box">
            {!submitted ? (
              <>
                <p className="sg-waitlist-label">
                  Get early access + 50% off for 3 months
                </p>
                <form className="sg-form" onSubmit={handleSubmit}>
                  <input
                    className="sg-input"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    autoFocus
                  />
                  <button className="sg-btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Joining…' : 'Join waitlist →'}
                  </button>
                </form>
                {error && <p className="sg-error">{error}</p>}
                <p className="sg-form-note">No credit card. No spam. Unsubscribe any time.</p>
              </>
            ) : (
              <div className="sg-success">
                <span className="sg-success-check">✓</span>
                <div>
                  <p className="sg-success-title">You're on the list.</p>
                  <p className="sg-success-sub">We'll email you the moment Scope Guard launches, with early access and your 50% discount.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Demo mockup */}
        <div className="sg-demo">
          <div className="sg-demo-label">SCOPE GUARD DETECTED</div>
          <div className="sg-demo-card">
            <div className="sg-demo-client">
              <div className="sg-demo-role">Client message</div>
              <div className="sg-demo-msg sg-msg-client">
                "Hey — can you also build a mobile app version of the site? Shouldn't be too different from what we agreed."
              </div>
            </div>
            <div className="sg-demo-violation">
              <span className="sg-violation-tag">⚠ Scope violation detected</span>
              <span className="sg-violation-ref">Section 2.1 — Deliverables</span>
            </div>
            <div className="sg-demo-responses">
              <div className="sg-demo-response-label">Choose your response:</div>
              <div className="sg-response-option sg-response-recommended">
                <div className="sg-response-type">📋 Change Order <span className="sg-recommended-tag">Recommended</span></div>
                <div className="sg-response-preview">"Happy to add the mobile app! This is outside our original scope — I'm sending Change Order #2: Mobile App Development, estimated $4,200 and 3 additional weeks…"</div>
              </div>
              <div className="sg-response-option">
                <div className="sg-response-type">🤝 Friendly pushback</div>
                <div className="sg-response-preview">"Thanks for the idea! The mobile app wasn't part of our original agreement (Section 2.1). Happy to quote separately…"</div>
              </div>
              <div className="sg-response-option">
                <div className="sg-response-type">📌 Contract reference</div>
                <div className="sg-response-preview">"Per Section 2.1 of our agreement, deliverables are limited to the web platform. Additional work requires a written change order…"</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem statement */}
      <section className="sg-problem">
        <div className="sg-section-inner">
          <div className="sg-problem-stat">
            <span className="sg-problem-num">$15,000</span>
            <span className="sg-problem-label">average annual revenue lost to scope creep per freelancer</span>
          </div>
          <p className="sg-problem-body">
            It starts with "can you also…" and ends with unpaid hours, strained relationships,
            and awkward conversations. Scope Guard turns that into a professional, clause-backed
            response — before you say yes.
          </p>
        </div>
      </section>

      {/* What it catches */}
      <section className="sg-violations-section">
        <div className="sg-section-inner">
          <div className="sg-section-header">
            <p className="sg-section-label">What Scope Guard detects</p>
            <h2 className="sg-section-title">Every way clients push past the contract</h2>
          </div>
          <div className="sg-violations-grid">
            {VIOLATIONS.map((v, i) => (
              <div key={i} className="sg-violation-card">
                <div className="sg-v-icon">{v.icon}</div>
                <h3 className="sg-v-title">{v.title}</h3>
                <div className="sg-v-example">"{v.example.replace(/^"|"$/g, '')}"</div>
                <p className="sg-v-response">{v.response}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="sg-how-section">
        <div className="sg-section-inner">
          <div className="sg-section-header">
            <p className="sg-section-label">How it works</p>
            <h2 className="sg-section-title">Three steps to stop scope creep</h2>
          </div>
          <div className="sg-steps">
            {STEPS.map((s, i) => (
              <div key={i} className="sg-step">
                <div className="sg-step-num">{s.num}</div>
                <div className="sg-step-content">
                  <h3 className="sg-step-title">{s.title}</h3>
                  <p className="sg-step-body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Jurisdictions */}
      <section className="sg-jurisdictions">
        <div className="sg-section-inner">
          <p className="sg-j-title">Jurisdiction-aware enforcement across 18 countries</p>
          <div className="sg-j-list">
            {['Nigeria', 'Canada', 'United States', 'United Kingdom', 'Kenya', 'Ghana', 'South Africa', 'India', 'UAE', 'Singapore', 'Australia', 'Germany', 'France', 'Philippines', 'Indonesia', 'Malaysia', 'Brazil', 'Egypt'].map(j => (
              <span key={j} className="sg-j-tag">{j}</span>
            ))}
          </div>
          <p className="sg-j-note">Each response cites the applicable contract clause and local law — not generic templates.</p>
        </div>
      </section>

      {/* Pricing */}
      <section className="sg-pricing-section">
        <div className="sg-section-inner">
          <div className="sg-section-header">
            <p className="sg-section-label">Pricing</p>
            <h2 className="sg-section-title">Included in Signova Pro</h2>
          </div>
          <div className="sg-pricing-cards">
            <div className="sg-price-card sg-price-free">
              <div className="sg-price-tier">Free</div>
              <div className="sg-price-amount">$0<span>/mo</span></div>
              <ul className="sg-price-features">
                <li>✓ 5 documents/month</li>
                <li>✓ All document types</li>
                <li>✗ Scope Guard</li>
                <li>✗ Contract storage</li>
              </ul>
            </div>
            <div className="sg-price-card sg-price-pro">
              <div className="sg-price-popular">Most Popular</div>
              <div className="sg-price-tier">Pro</div>
              <div className="sg-price-amount">$19.99<span>/mo</span></div>
              <div className="sg-price-early">Early access: 50% off → $9.99/mo</div>
              <ul className="sg-price-features">
                <li>✓ 500 documents/month</li>
                <li>✓ All document types</li>
                <li>✓ Scope Guard (unlimited)</li>
                <li>✓ Contract storage (50 contracts)</li>
                <li>✓ Change order generation</li>
                <li>✓ 18 jurisdictions</li>
              </ul>
              <button className="sg-btn-primary sg-btn-full" onClick={() => {
                document.querySelector('.sg-input')?.focus()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}>
                Join waitlist for 50% off →
              </button>
            </div>
            <div className="sg-price-card sg-price-scale">
              <div className="sg-price-tier">Scale</div>
              <div className="sg-price-amount">$79<span>/mo</span></div>
              <ul className="sg-price-features">
                <li>✓ 2,000 documents/month</li>
                <li>✓ All document types</li>
                <li>✓ Scope Guard (unlimited)</li>
                <li>✓ Contract storage (200 contracts)</li>
                <li>✓ API access</li>
                <li>✓ Priority support</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="sg-cta-section">
        <div className="sg-section-inner">
          <div className="sg-cta-box">
            <h2 className="sg-cta-title">Stop losing money to scope creep</h2>
            <p className="sg-cta-sub">
              Join the waitlist. Get early access in April 2026 and 50% off for your first 3 months.
            </p>
            {!submitted ? (
              <form className="sg-form sg-cta-form" onSubmit={handleSubmit}>
                <input
                  className="sg-input"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                />
                <button className="sg-btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Joining…' : 'Get early access →'}
                </button>
              </form>
            ) : (
              <p className="sg-cta-done">✓ You're on the list. We'll email you when it launches.</p>
            )}
            <div className="sg-cta-trust">
              <span>✓ No credit card</span>
              <span>✓ Launches April 2026</span>
              <span>✓ 50% off for 3 months</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="sg-footer">
        <div className="sg-logo" onClick={() => navigate('/')}>
          <span className="sg-logo-mark">E</span>
          <span className="sg-logo-text">ebenova.dev</span>
        </div>
        <div className="sg-footer-links">
          <a href="/">Home</a>
          <a href="/docs">Docs</a>
          <a href="https://www.getsignova.com">Signova</a>
          <a href="mailto:api@ebenova.dev">Contact</a>
        </div>
        <p className="sg-footer-copy">© 2026 Ebenova Solutions · Calgary, Alberta</p>
      </footer>
    </div>
  )
}
