import { useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import UsageChart from '../components/UsageChart'
import ScopeGuardStats from '../components/ScopeGuardStats'
import RevenueMetrics from '../components/RevenueMetrics'
import './Dashboard.css'

const API = 'https://www.getsignova.com'

const TIERS = {
  free:       { label: 'Free',       limit: 5,    price: 0,     color: '#6b7280' },
  starter:    { label: 'Starter',    limit: 100,  price: 29,    color: '#3b82f6' },
  growth:     { label: 'Growth',     limit: 500,  price: 79,    color: '#f97316' },
  scale:      { label: 'Scale',      limit: 2000, price: 199,   color: '#8b5cf6' },
  enterprise: { label: 'Enterprise', limit: '∞',  price: null,  color: '#10b981' },
}

const UPGRADE_PLANS = [
  { tier: 'starter',  label: 'Starter',  price: 29,  docs: 100,  features: ['100 docs/month', 'All document types', 'API access', 'Email support'] },
  { tier: 'growth',   label: 'Growth',   price: 79,  docs: 500,  features: ['500 docs/month', 'Scope Guard API', 'Priority support', 'Webhook events'] },
  { tier: 'scale',    label: 'Scale',    price: 199, docs: 2000, features: ['2,000 docs/month', 'Scope Guard API', 'Dedicated support', 'Custom jurisdictions'] },
]

export default function Dashboard() {
  const [view, setView] = useState('loading') // loading | login | dashboard
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)

  const [session, setSession] = useState(null) // { token, user, api_keys }
  const [usage, setUsage] = useState(null)
  const [activeKey, setActiveKey] = useState(null)

  const [copied, setCopied] = useState(false)
  const [upgrading, setUpgrading] = useState(null)
  const [error, setError] = useState('')
  const [scopeGuardStats, setScopeGuardStats] = useState(null)
  const [revenueMetrics, setRevenueMetrics] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // ── Boot: check for session or magic token ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const magicToken = params.get('token')
    const storedSession = localStorage.getItem('ebenova_session')
    const adminToken = localStorage.getItem('admin_token')

    if (adminToken) {
      setIsAdmin(true)
      fetchRevenueMetrics(adminToken)
    }

    if (magicToken) {
      verifyMagicToken(magicToken)
    } else if (storedSession) {
      try {
        const s = JSON.parse(storedSession)
        setSession(s)
        setActiveKey(s.api_keys?.[0])
        const key = s.api_keys?.[0]?.key
        fetchUsage(key)
        fetchScopeGuardStats(key)
        setView('dashboard')
      } catch { localStorage.removeItem('ebenova_session'); setView('login') }
    } else {
      setView('login')
    }
  }, [fetchUsage, fetchScopeGuardStats, fetchRevenueMetrics])

  async function verifyMagicToken(token) {
    setView('loading')
    try {
      const res = await fetch(`${API}/api/v1/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (data.success) {
        const s = { token: data.session_token, user: data.user, api_keys: data.api_keys }
        localStorage.setItem('ebenova_session', JSON.stringify(s))
        setSession(s)
        setActiveKey(data.api_keys?.[0])
        const key = data.api_keys?.[0]?.key
        fetchUsage(key)
        fetchScopeGuardStats(key)
        setView('dashboard')
        window.history.replaceState({}, '', '/dashboard')
      } else {
        setError(data.error?.message || 'Invalid or expired link')
        setView('login')
      }
    } catch { setError('Verification failed. Try again.'); setView('login') }
  }

  const fetchUsage = useCallback(async (key) => {
    if (!key) return
    try {
      const res = await fetch(`${API}/api/v1/keys/usage`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      const data = await res.json()
      if (data.success) setUsage(data)
    } catch {}
  }, [])

  const fetchScopeGuardStats = useCallback(async (key) => {
    if (!key) return
    try {
      const res = await fetch(`${API}/api/v1/scope/stats`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      const data = await res.json()
      if (data.success) setScopeGuardStats(data)
    } catch {}
  }, [])

  const fetchRevenueMetrics = useCallback(async (adminToken) => {
    if (!adminToken) return
    try {
      const res = await fetch(`${API}/api/v1/admin/revenue`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const data = await res.json()
      if (data.success) setRevenueMetrics(data)
    } catch {}
  }, [])

  async function sendMagicLink() {
    if (!email || !email.includes('@')) return setError('Enter a valid email')
    setSendingLink(true); setError('')
    try {
      const res = await fetch(`${API}/api/v1/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.success) setEmailSent(true)
      else setError(data.error?.message || 'Failed to send link')
    } catch { setError('Network error. Try again.') }
    setSendingLink(false)
  }

  async function handleUpgrade(tier) {
    setUpgrading(tier)
    try {
      const res = await fetch(`${API}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeKey?.key}` },
        body: JSON.stringify({ tier, success_url: `${window.location.origin}/dashboard?subscribed=1`, cancel_url: `${window.location.origin}/dashboard` }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setError(data.error?.message || 'Checkout failed')
    } catch { setError('Checkout error') }
    setUpgrading(null)
  }

  function logout() {
    localStorage.removeItem('ebenova_session')
    setSession(null); setView('login'); setEmailSent(false); setEmail('')
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const tier = session?.user?.tier || 'free'
  const tierInfo = TIERS[tier] || TIERS.free
  const isProUser = ['growth', 'scale', 'enterprise'].includes(tier)
  const usedDocs = usage?.current_month?.documents_used ?? 0
  const limitDocs = usage?.current_month?.monthly_limit ?? tierInfo.limit
  const pct = typeof limitDocs === 'number' ? Math.min(100, Math.round((usedDocs / limitDocs) * 100)) : 0

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (view === 'loading') return (
    <div className="dash-loading">
      <div className="dash-spinner" />
      <p>Signing you in…</p>
    </div>
  )

  // ── Login ────────────────────────────────────────────────────────────────────
  if (view === 'login') return (
    <>
      <Helmet><title>Sign In — Ebenova Dashboard</title></Helmet>
      <div className="dash-login-wrap">
        <div className="dash-login-card">
          <div className="dash-login-logo">⚖️</div>
          <h1>Ebenova Dashboard</h1>
          <p className="dash-login-sub">Sign in to manage your API keys and usage</p>

          {!emailSent ? (
            <>
              <div className="dash-field-group">
                <label>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && sendMagicLink()}
                  placeholder="you@example.com"
                  className="dash-input"
                  autoFocus
                />
              </div>
              {error && <p className="dash-error">{error}</p>}
              <button className="dash-btn-primary" onClick={sendMagicLink} disabled={sendingLink}>
                {sendingLink ? 'Sending…' : 'Send Magic Link →'}
              </button>
              <p className="dash-login-note">No password needed. We'll email you a sign-in link.</p>
            </>
          ) : (
            <div className="dash-email-sent">
              <div className="dash-email-icon">📧</div>
              <h3>Check your inbox</h3>
              <p>We sent a sign-in link to <strong>{email}</strong></p>
              <p className="dash-login-note">Link expires in 15 minutes.</p>
              <button className="dash-btn-ghost" onClick={() => { setEmailSent(false); setError('') }}>
                ← Use different email
              </button>
            </div>
          )}

          <div className="dash-login-divider" />
          <p className="dash-login-note">
            Don't have an account? Just enter your email — we'll create one automatically.
          </p>
        </div>
      </div>
    </>
  )

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <>
      <Helmet><title>Dashboard — Ebenova</title></Helmet>
      <div className="dash-wrap">

        {/* Header */}
        <header className="dash-header">
          <div className="dash-header-left">
            <span className="dash-logo">⚖️ Ebenova</span>
            <span className="dash-tier-badge" style={{ background: tierInfo.color }}>
              {tierInfo.label}
            </span>
          </div>
          <div className="dash-header-right">
            <span className="dash-email">{session?.user?.email}</span>
            <button className="dash-btn-ghost" onClick={logout}>Sign out</button>
          </div>
        </header>

        <main className="dash-main">
          {error && <div className="dash-alert-error">{error} <button onClick={() => setError('')}>✕</button></div>}

          {/* Usage Card */}
          <section className="dash-card">
            <h2 className="dash-card-title">Usage this month</h2>
            <div className="dash-usage-row">
              <span className="dash-usage-count">{usedDocs} / {typeof limitDocs === 'number' ? limitDocs : '∞'}</span>
              <span className="dash-usage-label">documents generated</span>
            </div>
            <div className="dash-progress-track">
              <div className="dash-progress-fill" style={{ width: `${pct}%`, background: pct > 80 ? '#ef4444' : tierInfo.color }} />
            </div>
            {usage?.current_month?.resets_at && (
              <p className="dash-usage-reset">
                Resets {new Date(usage.current_month.resets_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
              </p>
            )}
          </section>

          {/* Usage trend chart */}
          {usage?.history && usage.history.length > 0 && (
            <section className="dash-card">
              <UsageChart history={usage.history} />
            </section>
          )}

          {/* API Keys */}
          <section className="dash-card">
            <h2 className="dash-card-title">Your API Key</h2>
            {session?.api_keys?.map(k => (
              <div key={k.key} className="dash-key-row">
                <div className="dash-key-meta">
                  <span className="dash-key-label">{k.label || 'Default key'}</span>
                  <span className="dash-key-tier">{k.tier}</span>
                </div>
                <div className="dash-key-value-row">
                  <code className="dash-key-code">{k.key.slice(0, 20)}••••••••••••••••</code>
                  <button className="dash-btn-copy" onClick={() => copyKey(k.key)}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="dash-key-hint">Add to requests: <code>Authorization: Bearer {k.key.slice(0,16)}…</code></p>
              </div>
            ))}
          </section>

          {/* Scope Guard */}
          <section className={`dash-card ${!isProUser ? 'dash-card-locked' : ''}`}>
            <div className="dash-card-title-row">
              <h2 className="dash-card-title">🛡️ Scope Guard</h2>
              {!isProUser && <span className="dash-pro-badge">Pro</span>}
            </div>
            {isProUser ? (
              <div className="dash-scope-active">
                <p>Scope Guard is active on your account. Use the API to analyze client requests:</p>
                <code className="dash-code-block">POST /v1/scope/analyze</code>
                <code className="dash-code-block">POST /v1/scope/change-order</code>
                <a href="/docs#scope-guard" className="dash-btn-secondary">View Docs →</a>
              </div>
            ) : (
              <div className="dash-scope-locked">
                <p>Automatically detect scope creep and draft professional responses. Upgrade to Growth or Scale to unlock.</p>
                <button className="dash-btn-primary" onClick={() => handleUpgrade('growth')} disabled={upgrading === 'growth'}>
                  {upgrading === 'growth' ? 'Loading…' : 'Upgrade to Growth — $79/mo →'}
                </button>
              </div>
            )}
          </section>

          {/* Scope Guard Stats */}
          {isProUser && scopeGuardStats && (
            <section className="dash-card">
              <h2 className="dash-card-title">📊 Scope Guard Activity</h2>
              <ScopeGuardStats stats={scopeGuardStats} />
            </section>
          )}

          {/* Revenue Dashboard (Admin Only) */}
          {isAdmin && revenueMetrics && (
            <section className="dash-card dash-admin-section">
              <h2 className="dash-card-title">💰 Revenue Dashboard</h2>
              <RevenueMetrics metrics={revenueMetrics.metrics} monthlyData={revenueMetrics.monthlyRevenue} />
            </section>
          )}

          {/* Upgrade Plans (only for free/starter) */}
          {!['scale','enterprise'].includes(tier) && (
            <section className="dash-card">
              <h2 className="dash-card-title">Upgrade your plan</h2>
              <div className="dash-plans-grid">
                {UPGRADE_PLANS.filter(p => p.price > (tierInfo.price || 0)).map(plan => (
                  <div key={plan.tier} className={`dash-plan-card ${plan.tier === 'growth' ? 'dash-plan-featured' : ''}`}>
                    {plan.tier === 'growth' && <div className="dash-plan-popular">Most Popular</div>}
                    <h3>{plan.label}</h3>
                    <div className="dash-plan-price">${plan.price}<span>/mo</span></div>
                    <ul className="dash-plan-features">
                      {plan.features.map(f => <li key={f}>✓ {f}</li>)}
                    </ul>
                    <button
                      className={`dash-btn-plan ${plan.tier === 'growth' ? 'dash-btn-primary' : 'dash-btn-secondary'}`}
                      onClick={() => handleUpgrade(plan.tier)}
                      disabled={!!upgrading}
                    >
                      {upgrading === plan.tier ? 'Loading…' : `Upgrade to ${plan.label} →`}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick Start */}
          <section className="dash-card">
            <h2 className="dash-card-title">Quick start</h2>
            <pre className="dash-quickstart">{`curl -X POST https://api.ebenova.dev/v1/documents/generate \\
  -H "Authorization: Bearer ${activeKey?.key?.slice(0,20) ?? 'sk_live_...'}..." \\
  -H "Content-Type: application/json" \\
  -d '{"document_type":"nda","fields":{"party_a":"Acme Inc","party_b":"Jane Smith"},"jurisdiction":"Nigeria"}'`}</pre>
            <div className="dash-links-row">
              <a href="/docs" className="dash-link">📄 API Docs</a>
              <a href="https://ebenova.dev/blog" className="dash-link">📝 Blog</a>
              <a href="mailto:api@ebenova.dev" className="dash-link">💬 Support</a>
            </div>
          </section>

        </main>
      </div>
    </>
  )
}
