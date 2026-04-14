import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import './ScopeGuard.css'

// ── Geo-currency for ScopeGuard subscription pricing ────────────────────────
// $9.99/mo Pro and $79/mo API — monthly equivalents per country
const SG_CURRENCY_MAP = {
  NG: { symbol: '₦', proAmount: 13800, apiAmount: 110000, code: 'NGN' },
  GH: { symbol: 'GH₵', proAmount: 150, apiAmount: 1200, code: 'GHS' },
  KE: { symbol: 'KSh', proAmount: 1300, apiAmount: 10500, code: 'KES' },
  ZA: { symbol: 'R', proAmount: 185, apiAmount: 1480, code: 'ZAR' },
  IN: { symbol: '₹', proAmount: 835, apiAmount: 6640, code: 'INR' },
  GB: { symbol: '£', proAmount: 7.90, apiAmount: 63, code: 'GBP' },
  DE: { symbol: '€', proAmount: 9.20, apiAmount: 73, code: 'EUR' },
  FR: { symbol: '€', proAmount: 9.20, apiAmount: 73, code: 'EUR' },
  DEFAULT: { symbol: '$', proAmount: 9.99, apiAmount: 79, code: 'USD' },
}

function useGeoCurrency() {
  const [currency, setCurrency] = useState(SG_CURRENCY_MAP.DEFAULT)
  useEffect(() => {
    const cached = sessionStorage.getItem('sig_geo')
    if (cached) {
      try {
        const d = JSON.parse(cached)
        const cur = SG_CURRENCY_MAP[d.countryCode] || SG_CURRENCY_MAP.DEFAULT
        setCurrency(cur)
      } catch { /* ignore */ }
      return
    }
    fetch('/api/geo')
      .then(r => r.json())
      .then(d => {
        if (d.country_code) {
          const cur = SG_CURRENCY_MAP[d.country_code] || SG_CURRENCY_MAP.DEFAULT
          setCurrency(cur)
        }
      })
      .catch(() => {})
  }, [])
  return currency
}

const VIOLATIONS_DEMO = [
  { icon: '📦', title: 'Scope creep', example: '"Can you also add a blog section? Should be quick."', response: 'Auto-drafts a change order with estimated hours and cost.' },
  { icon: '🔄', title: 'Extra revisions', example: '"One more round of changes — just small tweaks!"', response: 'Cites your revision limit clause and offers a paid revision quote.' },
  { icon: '⏰', title: 'Deadline compression', example: '"Actually, we need this by Friday, not end of month."', response: 'Calculates rush fee and sends a formal timeline adjustment notice.' },
  { icon: '💸', title: 'Unpaid extras', example: '"Can you handle the hosting setup too? It\'s tiny."', response: 'Flags the request as outside scope and drafts a professional pushback.' },
]

// Free-tier uses tracked server-side via IP (no localStorage needed)
const FREE_LIMIT = 3

export default function ScopeGuard() {
  const navigate = useNavigate()
  const currency = useGeoCurrency()

  // Tool state
  const [contractText, setContractText] = useState('')
  const [clientMessage, setClientMessage] = useState('')
  const [channel, setChannel] = useState('email')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [toolError, setToolError] = useState('')
  const [selectedResponse, setSelectedResponse] = useState(0)
  const [copied, setCopied] = useState(false)
  const [_freeUsed, setFreeUsed] = useState(0)
  const [remainingUses, setRemainingUses] = useState(FREE_LIMIT)

  // Upgrade / waitlist state
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [upgradeSubmitted, setUpgradeSubmitted] = useState(false)

  async function handleAnalyze(e) {
    e.preventDefault()
    setToolError('')
    setResult(null)

    if (!contractText.trim() || contractText.trim().length < 50) {
      setToolError('Please paste your contract text (at least 50 characters).')
      return
    }
    if (!clientMessage.trim()) {
      setToolError('Please paste the client message.')
      return
    }

    setAnalyzing(true)
    try {
      const res = await fetch('/api/scope-guard-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contract_text: contractText, client_message: clientMessage, communication_channel: channel }),
      })
      const data = await res.json()
      if (res.status === 429) {
        setShowUpgrade(true)
        return
      }
      if (!data.success) throw new Error(data.error?.message || 'Analysis failed')
      setFreeUsed(prev => prev + 1)
      if (typeof data.remaining_uses === 'number') setRemainingUses(data.remaining_uses)
      setResult(data)
      setSelectedResponse(0)
    } catch (err) {
      setToolError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const [upgradeLoading, setUpgradeLoading] = useState(false)

  async function handleUpgradeSubmit(e) {
    e.preventDefault()
    if (!upgradeEmail.includes('@')) return
    setUpgradeLoading(true)
    try {
      const res = await fetch('/api/scope-guard-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: upgradeEmail }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setUpgradeSubmitted(true) // fallback if checkout fails
      }
    } catch {
      setUpgradeSubmitted(true) // graceful fallback
    } finally {
      setUpgradeLoading(false)
    }
  }

  function copyResponse() {
    const text = result?.response_options?.[selectedResponse]?.draft || ''
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const usesLeft = remainingUses

  return (
    <div className="sg-page">
      <Helmet>
        <title>Scope Guard — Stop Scope Creep Before It Costs You | Signova</title>
        <meta name="description" content="Paste your contract and client message. Scope Guard detects violations and drafts a professional response in seconds. Free to try, no account needed." />
        <link rel="canonical" href="https://www.getsignova.com/scope-guard" />
        <link rel="alternate" hreflang="en" href="https://www.getsignova.com/scope-guard" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Signova" />
        <meta property="og:url" content="https://www.getsignova.com/scope-guard" />
        <meta property="og:title" content="Scope Guard — Detect Scope Creep in Seconds" />
        <meta property="og:description" content="Paste your contract and the client's message. Get 3 professional responses and a change order in seconds. Free to try." />
        <meta property="og:image" content="https://www.getsignova.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Scope Guard — Detect Scope Creep in Seconds" />
        <meta name="twitter:description" content="Paste your contract + client message. Scope Guard spots the violation and drafts your response. Free to try." />
        <meta name="twitter:image" content="https://www.getsignova.com/og-image.png" />
      </Helmet>

      <nav className="sg-nav">
        <div className="sg-logo" onClick={() => navigate('/')}>
          <span className="sg-logo-mark">S</span>
          <span className="sg-logo-text">Signova</span>
        </div>
        <a href="https://www.getsignova.com" className="sg-nav-link">← Back to Signova</a>
      </nav>

      {/* ── Hero ── */}
      <section className="sg-hero">
        <div className="sg-hero-inner">
          <div className="sg-badge">
            <span className="sg-badge-dot" />
            Free to try · No account needed
          </div>
          <h1 className="sg-title">Stop scope creep<br />before it costs you</h1>
          <p className="sg-sub">
            Paste your contract and the client's message. Scope Guard detects violations
            and drafts a professional response in seconds.
          </p>
          {usesLeft > 0 && !result && (
            <p className="sg-free-counter">{usesLeft} free {usesLeft === 1 ? 'analysis' : 'analyses'} remaining</p>
          )}
        </div>
      </section>

      {/* ── Tool ── */}
      <section className="sg-tool-section">
        <div className="sg-tool-inner">

          {!result ? (
            <form className="sg-tool-form" onSubmit={handleAnalyze}>
              <div className="sg-field">
                <label className="sg-label">Your contract <span className="sg-label-hint">(paste the full text)</span></label>
                <textarea
                  className="sg-textarea sg-textarea-contract"
                  placeholder="Paste your freelance contract, service agreement, or any signed document here..."
                  value={contractText}
                  onChange={e => setContractText(e.target.value)}
                  rows={8}
                />
              </div>
              <div className="sg-field">
                <label className="sg-label">Client message <span className="sg-label-hint">(the message you received)</span></label>
                <textarea
                  className="sg-textarea sg-textarea-message"
                  placeholder={`"Hey, can you also add a blog section? Shouldn't take long..."`}
                  value={clientMessage}
                  onChange={e => setClientMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="sg-field sg-field-inline">
                <label className="sg-label">Channel</label>
                <select className="sg-select" value={channel} onChange={e => setChannel(e.target.value)}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="slack">Slack</option>
                  <option value="sms">SMS</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {toolError && <p className="sg-tool-error">{toolError}</p>}
              <button className="sg-btn-primary sg-btn-analyze" type="submit" disabled={analyzing}>
                {analyzing ? '🔍 Analyzing…' : '🛡️ Analyze for scope violations →'}
              </button>
            </form>
          ) : (
            <div className="sg-results">
              {/* Summary */}
              <div className={`sg-result-header ${result.violation_detected ? 'sg-violation-found' : 'sg-no-violation'}`}>
                {result.violation_detected
                  ? <><span className="sg-result-icon">⚠️</span><div><strong>{result.violations?.length} violation{result.violations?.length !== 1 ? 's' : ''} detected</strong><p>{result.summary}</p></div></>
                  : <><span className="sg-result-icon">✅</span><div><strong>No violations detected</strong><p>{result.summary}</p></div></>
                }
              </div>

              {/* Violations list */}
              {result.violation_detected && result.violations?.length > 0 && (
                <div className="sg-violations-list">
                  {result.violations.map((v, i) => (
                    <div key={i} className={`sg-violation-item sg-sev-${v.severity?.toLowerCase()}`}>
                      <div className="sg-viol-meta">
                        <span className="sg-viol-type">{v.type}</span>
                        <span className="sg-viol-severity">{v.severity}</span>
                      </div>
                      <p className="sg-viol-desc">{v.description}</p>
                      {v.contract_reference && <p className="sg-viol-ref">📄 {v.contract_reference}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Response options */}
              {result.response_options?.length > 0 && (
                <div className="sg-responses">
                  <h3 className="sg-responses-title">Choose your response</h3>
                  <div className="sg-response-tabs">
                    {result.response_options.map((opt, i) => (
                      <button
                        key={i}
                        className={`sg-response-tab ${selectedResponse === i ? 'sg-tab-active' : ''} ${opt.recommended ? 'sg-tab-recommended' : ''}`}
                        onClick={() => setSelectedResponse(i)}
                      >
                        {opt.label}
                        {opt.recommended && <span className="sg-rec-badge">Recommended</span>}
                      </button>
                    ))}
                  </div>
                  <div className="sg-response-draft">
                    <pre className="sg-draft-text">{result.response_options[selectedResponse]?.draft}</pre>
                    <button className="sg-btn-copy" onClick={copyResponse}>
                      {copied ? '✓ Copied!' : '📋 Copy response'}
                    </button>
                  </div>
                </div>
              )}

              {/* Change order suggestion */}
              {result.suggested_change_order?.applicable && (
                <div className="sg-change-order-hint">
                  <h4>💼 Suggested change order</h4>
                  <p>{result.suggested_change_order.additional_work_description}</p>
                  <div className="sg-co-meta">
                    {result.suggested_change_order.estimated_hours && <span>~{result.suggested_change_order.estimated_hours} hrs</span>}
                    {result.suggested_change_order.suggested_cost_usd && <span>${result.suggested_change_order.suggested_cost_usd.toLocaleString()} USD</span>}
                    {result.suggested_change_order.timeline_extension_days && <span>+{result.suggested_change_order.timeline_extension_days} days</span>}
                  </div>
                </div>
              )}

              {/* Analyze again */}
              <div className="sg-result-actions">
                <button className="sg-btn-secondary" onClick={() => { setResult(null); setToolError('') }}>
                  ← Analyze another message
                </button>
                {usesLeft <= 0 && (
                  <button className="sg-btn-primary" onClick={() => setShowUpgrade(true)}>
                    Get unlimited analyses →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Free limit hit */}
          {showUpgrade && (
            <div className="sg-upgrade-overlay">
              <div className="sg-upgrade-box">
                <h3>You've used your 3 free analyses</h3>
                <p>Upgrade to Scope Guard Pro for unlimited analyses at {currency.symbol}{currency.proAmount.toLocaleString()}/month.</p>
                {!upgradeSubmitted ? (
                  <form className="sg-form" onSubmit={handleUpgradeSubmit}>
                    <input className="sg-input" type="email" placeholder="your@email.com" value={upgradeEmail} onChange={e => setUpgradeEmail(e.target.value)} />
                    <button className="sg-btn-primary" type="submit" disabled={upgradeLoading}>
                      {upgradeLoading ? 'Redirecting to checkout…' : `Upgrade — ${currency.symbol}${currency.proAmount.toLocaleString()}/mo →`}
                    </button>
                  </form>
                ) : (
                  <p className="sg-success-title">✓ Redirecting to checkout…</p>
                )}
                <button className="sg-upgrade-close" onClick={() => setShowUpgrade(false)}>✕</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── What it catches ── */}
      <section className="sg-violations-section">
        <div className="sg-section-inner">
          <div className="sg-section-header">
            <p className="sg-section-label">What Scope Guard detects</p>
            <h2 className="sg-section-title">Every way clients push past the contract</h2>
          </div>
          <div className="sg-violations-grid">
            {VIOLATIONS_DEMO.map((v, i) => (
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

      {/* ── Pricing ── */}
      <section className="sg-pricing-section">
        <div className="sg-section-inner">
          <div className="sg-section-header">
            <p className="sg-section-label">Pricing</p>
            <h2 className="sg-section-title">Start free. Upgrade when ready.</h2>
          </div>
          <div className="sg-pricing-cards">
            <div className="sg-price-card sg-price-free">
              <div className="sg-price-tier">Free</div>
              <div className="sg-price-amount">$0</div>
              <ul className="sg-price-features">
                <li>✓ 3 Scope Guard analyses</li>
                <li>✓ No account needed</li>
                <li>✓ All violation types</li>
                <li>✓ 3 response drafts</li>
              </ul>
            </div>
            <div className="sg-price-card sg-price-pro">
              <div className="sg-price-popular">Most Popular</div>
              <div className="sg-price-tier">Pro</div>
              <div className="sg-price-amount">{currency.symbol}{currency.proAmount.toLocaleString()}<span>/mo</span></div>
              <ul className="sg-price-features">
                <li>✓ Unlimited Scope Guard</li>
                <li>✓ 500 documents/month</li>
                <li>✓ Contract storage</li>
                <li>✓ Change order generation</li>
                <li>✓ 18 jurisdictions</li>
              </ul>
              <button className="sg-btn-primary sg-btn-full" onClick={() => setShowUpgrade(true)}>
                Get Pro →
              </button>
            </div>
            <div className="sg-price-card sg-price-scale">
              <div className="sg-price-tier">Developer API</div>
              <div className="sg-price-amount">{currency.symbol}{currency.apiAmount.toLocaleString()}<span>/mo</span></div>
              <ul className="sg-price-features">
                <li>✓ Scope Guard API access</li>
                <li>✓ 500 API calls/month</li>
                <li>✓ MCP server included</li>
                <li>✓ Build your own tools</li>
              </ul>
              <a className="sg-btn-secondary sg-btn-full" href="https://ebenova.dev/docs#scope">View API docs →</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="sg-footer">
        <div className="sg-logo" onClick={() => navigate('/')}>
          <span className="sg-logo-mark">S</span>
          <span className="sg-logo-text">Signova</span>
        </div>
        <div className="sg-footer-links">
          <a href="https://www.getsignova.com">Home</a>
          <a href="https://www.getsignova.com/#documents">Documents</a>
          <a href="https://ebenova.dev/docs">API Docs</a>
          <a href="mailto:hello@getsignova.com">Contact</a>
        </div>
        <p className="sg-footer-copy">© 2026 Ebenova Solutions · Calgary, Alberta</p>
      </footer>
    </div>
  )
}
