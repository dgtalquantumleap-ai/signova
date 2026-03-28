import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const TIERS = {
  free:       { label: 'Free',       limit: 5,    price: 0   },
  starter:    { label: 'Starter',    limit: 100,  price: 29  },
  growth:     { label: 'Growth',     limit: 500,  price: 79  },
  scale:      { label: 'Scale',      limit: 2000, price: 199 },
  enterprise: { label: 'Enterprise', limit: '∞',  price: null },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [apiKey, setApiKey]     = useState('')
  const [savedKey, setSavedKey] = useState('')
  const [usage, setUsage]       = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState(false)
  const [checkingOut, setCheckingOut] = useState(null)

  // Restore saved key on mount
  useEffect(() => {
    const stored = localStorage.getItem('ebenova_api_key')
    if (stored) { setSavedKey(stored); setApiKey(stored); fetchUsage(stored) }

    // Handle return from Stripe checkout
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscribed') === '1') {
      const session = params.get('session_id')
      if (session) {
        // Usage will refresh momentarily as webhook fires
        window.history.replaceState({}, '', '/dashboard')
      }
    }
  }, [])

  async function fetchUsage(key) {
    if (!key) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('https://api.ebenova.dev/v1/keys/usage', {
        headers: { Authorization: `Bearer ${key}` },
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error?.message || 'Invalid API key')
        setUsage(null)
      } else {
        setUsage(data)
        setSavedKey(key)
        localStorage.setItem('ebenova_api_key', key)
      }
    } catch {
      setError('Could not reach API. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  function handleLookup(e) {
    e.preventDefault()
    fetchUsage(apiKey.trim())
  }

  function handleCopy() {
    navigator.clipboard.writeText(savedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleForget() {
    localStorage.removeItem('ebenova_api_key')
    setSavedKey('')
    setApiKey('')
    setUsage(null)
    setError('')
  }

  async function handleUpgrade(tier) {
    setCheckingOut(tier)
    try {
      const res = await fetch('https://api.ebenova.dev/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          email: usage?.key?.owner || '',
          success_url: `${window.location.origin}/dashboard?subscribed=1`,
          cancel_url: `${window.location.origin}/dashboard`,
        }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        alert('Could not start checkout. Please try again.')
      }
    } catch {
      alert('Checkout failed. Please try again.')
    } finally {
      setCheckingOut(null)
    }
  }

  async function handlePortal() {
    if (!savedKey) return
    try {
      const res = await fetch('https://api.ebenova.dev/v1/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedKey}`,
        },
        body: JSON.stringify({ return_url: window.location.href }),
      })
      const data = await res.json()
      if (data.portal_url) window.location.href = data.portal_url
    } catch {
      alert('Could not open billing portal.')
    }
  }

  const tier = TIERS[usage?.key?.tier] || TIERS.free
  const cm = usage?.current_month
  const pct = cm ? Math.round((cm.documents_used / cm.monthly_limit) * 100) : 0
  const isNearLimit = pct >= 80

  return (
    <div className="dash-page">
      <Helmet>
        <title>Dashboard | Ebenova API</title>
      </Helmet>

      <nav className="dash-nav">
        <div className="dash-logo" onClick={() => navigate('/')}>
          <span className="dash-logo-mark">E</span>
          <span className="dash-logo-text">ebenova.dev</span>
        </div>
        <a href="/docs" className="dash-nav-link">Docs</a>
      </nav>

      <div className="dash-container">
        <div className="dash-header">
          <h1>API Dashboard</h1>
          <p>Monitor usage, manage your subscription, and access your API key.</p>
        </div>

        {/* Key input — shown when no key loaded */}
        {!usage && (
          <div className="dash-card dash-lookup">
            <h2>Enter your API key</h2>
            <p>Paste your <code>sk_live_</code> key to view usage and manage your account.</p>
            <form className="dash-lookup-form" onSubmit={handleLookup}>
              <input
                className="dash-key-input"
                type="password"
                placeholder="sk_live_..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoFocus
              />
              <button className="dash-btn-primary" type="submit" disabled={loading || !apiKey.trim()}>
                {loading ? 'Loading…' : 'View Dashboard →'}
              </button>
            </form>
            {error && <div className="dash-error">{error}</div>}
            <p className="dash-lookup-note">
              Don't have a key? <a href="/pricing">Get one free</a> — no credit card needed.
            </p>
          </div>
        )}

        {/* Main dashboard — shown when key loaded */}
        {usage && (
          <>
            {/* Key card */}
            <div className="dash-card dash-key-card">
              <div className="dash-key-header">
                <div>
                  <div className="dash-card-label">API Key</div>
                  <div className="dash-key-owner">{usage.key.owner}</div>
                </div>
                <div className="dash-tier-badge" data-tier={usage.key.tier}>
                  {tier.label}
                </div>
              </div>
              <div className="dash-key-display">
                <code className="dash-key-value">
                  {savedKey.slice(0, 12)}{'•'.repeat(20)}{savedKey.slice(-4)}
                </code>
                <div className="dash-key-actions">
                  <button className="dash-btn-sm" onClick={handleCopy}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                  <button className="dash-btn-sm dash-btn-ghost" onClick={handleForget}>
                    Forget
                  </button>
                </div>
              </div>
              {usage.key.label && (
                <div className="dash-key-label-tag">{usage.key.label}</div>
              )}
            </div>

            {/* Usage card */}
            <div className={`dash-card dash-usage-card ${isNearLimit ? 'near-limit' : ''}`}>
              <div className="dash-card-label">This Month</div>
              <div className="dash-usage-numbers">
                <span className="dash-usage-used">{cm.documents_used}</span>
                <span className="dash-usage-sep">/</span>
                <span className="dash-usage-limit">{cm.monthly_limit}</span>
                <span className="dash-usage-unit">documents</span>
              </div>
              <div className="dash-progress-bar">
                <div
                  className="dash-progress-fill"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                  data-near={isNearLimit}
                />
              </div>
              <div className="dash-usage-meta">
                <span>{cm.documents_remaining} remaining</span>
                <span>Resets {new Date(cm.resets_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </div>

              {isNearLimit && usage.key.tier !== 'enterprise' && (
                <div className="dash-limit-warning">
                  ⚠️ You've used {pct}% of your monthly quota.
                  {usage.key.tier !== 'scale' ? ' Upgrade to avoid interruptions.' : ' Contact us for Enterprise pricing.'}
                </div>
              )}
            </div>

            {/* History */}
            {usage.history?.length > 0 && (
              <div className="dash-card">
                <div className="dash-card-label">Usage History</div>
                <div className="dash-history">
                  {usage.history.map(h => (
                    <div key={h.month} className="dash-history-row">
                      <span className="dash-history-month">{h.month}</span>
                      <div className="dash-history-bar-wrap">
                        <div
                          className="dash-history-bar"
                          style={{ width: `${Math.min((h.documents_generated / cm.monthly_limit) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="dash-history-count">{h.documents_generated}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upgrade / manage billing */}
            {usage.key.tier === 'free' ? (
              <div className="dash-card dash-upgrade-card">
                <div className="dash-card-label">Upgrade Your Plan</div>
                <p className="dash-upgrade-sub">You're on the free tier (5 docs/month). Upgrade to generate more.</p>
                <div className="dash-upgrade-grid">
                  {['starter', 'growth', 'scale'].map(t => {
                    const info = TIERS[t]
                    return (
                      <div key={t} className={`dash-upgrade-option ${t === 'starter' ? 'popular' : ''}`}>
                        {t === 'starter' && <div className="dash-popular-badge">Popular</div>}
                        <div className="dash-upgrade-name">{info.label}</div>
                        <div className="dash-upgrade-price">${info.price}<span>/mo</span></div>
                        <div className="dash-upgrade-docs">{info.limit} docs/month</div>
                        <button
                          className="dash-btn-primary dash-btn-full"
                          onClick={() => handleUpgrade(t)}
                          disabled={checkingOut === t}
                        >
                          {checkingOut === t ? 'Redirecting…' : 'Upgrade →'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="dash-card dash-billing-card">
                <div className="dash-card-label">Billing</div>
                <p>You're on the <strong>{tier.label}</strong> plan — {tier.limit} documents/month.</p>
                <div className="dash-billing-actions">
                  <button className="dash-btn-outline" onClick={handlePortal}>
                    Manage Subscription →
                  </button>
                  {usage.key.tier !== 'scale' && usage.key.tier !== 'enterprise' && (
                    <button
                      className="dash-btn-primary"
                      onClick={() => {
                        const next = usage.key.tier === 'starter' ? 'growth' : 'scale'
                        handleUpgrade(next)
                      }}
                      disabled={!!checkingOut}
                    >
                      {checkingOut ? 'Redirecting…' : 'Upgrade Plan →'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="dash-card dash-links-card">
              <div className="dash-card-label">Quick Links</div>
              <div className="dash-links">
                <a href="/docs" className="dash-link">📄 Documentation</a>
                <a href="/docs#sdk" className="dash-link">📦 SDK & MCP Server</a>
                <a href="https://api.ebenova.dev/v1/documents/types" target="_blank" rel="noopener noreferrer" className="dash-link">🔧 Document Types</a>
                <a href="mailto:api@ebenova.dev" className="dash-link">✉️ api@ebenova.dev</a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
