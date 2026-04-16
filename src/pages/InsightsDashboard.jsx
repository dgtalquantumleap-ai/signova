// src/pages/InsightsDashboard.jsx
// Ebenova Insights — Client Dashboard at /insights/dashboard
// Login with API key → see monitors, matches, AI drafts, feedback

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Broadcast, MagnifyingGlass, Warning, ThumbsUp, ThumbsDown, Sparkle, Lightning,
} from '@phosphor-icons/react'
import './InsightsDashboard.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.ebenova.dev'

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, apiKey, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  })
  return res.json()
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [key, setKey]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [requestError, setRequestError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!key.trim()) return
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/v1/insights/monitors', key.trim())
      if (data.success) {
        localStorage.setItem('insights_key', key.trim())
        onLogin(key.trim(), data.monitors)
      } else {
        setError(data.error?.message || 'Invalid API key')
      }
    } catch { setError('Connection error — check your network') }
    finally { setLoading(false) }
  }

  async function handleRequestAccess(e) {
    e.preventDefault()
    if (!requestEmail.trim()) return
    setRequestLoading(true); setRequestError('')
    try {
      const res = await fetch(`${API_BASE}/api/insights/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: requestEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRequestSuccess(true)
        setRequestEmail('')
      } else {
        setRequestError('Something went wrong. Email akin@ebenova.dev directly.')
      }
    } catch {
      setRequestError('Something went wrong. Email akin@ebenova.dev directly.')
    }
    finally { setRequestLoading(false) }
  }

  return (
    <div className="idb-login">
      <div className="idb-login-box">
        <div className="idb-login-logo"><Broadcast size={22} weight="duotone" style={{ verticalAlign: '-5px', marginRight: 8 }} />Ebenova Insights</div>
        <h1>Dashboard</h1>
        <p>Enter your API key to access your monitors and matches.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="insights-api-key" className="sr-only">API Key</label>
          <input
            id="insights-api-key"
            name="api_key"
            type="password"
            placeholder="sk_live_your_key"
            value={key}
            onChange={e => setKey(e.target.value)}
            autoFocus
            spellCheck={false}
            required
            autoComplete="current-password"
          />
          <button type="submit" disabled={loading || !key.trim()}>
            {loading ? 'Checking…' : 'Sign in →'}
          </button>
        </form>
        {error && <div className="idb-error">{error}</div>}
        <div className="idb-login-help" style={{ borderTop: '1px solid #1e1e1e', marginTop: '20px', paddingTop: '20px' }}>
          {requestSuccess ? (
            <div style={{ color: '#5ad45a', fontSize: '13px' }}>✓ Request received. We'll send your key within 24 hours.</div>
          ) : (
            <form onSubmit={handleRequestAccess}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={requestEmail}
                  onChange={e => setRequestEmail(e.target.value)}
                  required
                  style={{ flex: 1, background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#f0ece4', outline: 'none' }}
                />
                <button type="submit" disabled={requestLoading || !requestEmail.trim()} style={{ background: '#c9a84c', color: '#0e0e0e', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: '700', cursor: requestLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {requestLoading ? 'Sending…' : 'Request Access →'}
                </button>
              </div>
              {requestError && <div className="idb-error" style={{ fontSize: '12px', padding: '6px 10px' }}>{requestError}</div>}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Match Card ────────────────────────────────────────────────────────────────
function MatchCard({ match, apiKey, monitorId }) {
  const [draft, setDraft]       = useState(match.draft || null)
  const [feedback, setFeedback] = useState(match.feedback || null)
  const [loading, setLoading]   = useState(false)
  const [copied, setCopied]     = useState(false)

  async function regenerateDraft() {
    setLoading(true)
    const data = await apiFetch('/v1/insights/matches/draft', apiKey, {
      method: 'POST',
      body: JSON.stringify({ monitor_id: monitorId, match_id: match.id }),
    })
    if (data.success) setDraft(data.draft)
    setLoading(false)
  }

  async function sendFeedback(fb) {
    setFeedback(fb)
    await apiFetch('/v1/insights/matches/feedback', apiKey, {
      method: 'POST',
      body: JSON.stringify({ monitor_id: monitorId, match_id: match.id, feedback: fb }),
    })
  }

  function copyDraft() {
    if (!draft) return
    navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const timeAgo = (iso) => {
    const diff = (Date.now() - new Date(iso)) / 1000
    if (diff < 60) return `${Math.floor(diff)}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className={`idb-match ${!match.approved ? 'dnp' : ''}`}>
      <div className="idb-match-meta">
        <span className="idb-subreddit">r/{match.subreddit}</span>
        <span className="idb-author">u/{match.author}</span>
        <span className="idb-score">▲ {match.score}</span>
        <span className="idb-time">{timeAgo(match.createdAt)}</span>
        {match.semanticScore && <span className="idb-semantic"><MagnifyingGlass size={12} weight="regular" style={{ verticalAlign: '-1px', marginRight: 3 }} />{Math.round(match.semanticScore * 100)}%</span>}
        {!match.approved && <span className="idb-dnp-badge"><Warning size={12} weight="fill" style={{ verticalAlign: '-1px', marginRight: 3 }} />DO NOT POST</span>}
      </div>

      <a className="idb-match-title" href={match.url} target="_blank" rel="noreferrer">
        {match.title}
      </a>

      {match.body && <p className="idb-match-body">{match.body}{match.body.length >= 300 ? '…' : ''}</p>}

      <div className="idb-match-kw">Keyword: <span>{match.keyword}</span></div>

      {/* Draft section */}
      <div className="idb-draft-section">
        {draft ? (
          <>
            <div className="idb-draft-header">
              <span className="idb-draft-label">✏️ Suggested reply</span>
              <div className="idb-draft-actions">
                <button className="idb-copy-btn" onClick={copyDraft}>{copied ? '✓ Copied' : 'Copy'}</button>
                <button className="idb-regen-btn" onClick={regenerateDraft} disabled={loading}>
                  {loading ? '…' : '↺'}
                </button>
                <button
                  className={`idb-fb-btn ${feedback === 'up' ? 'active-up' : ''}`}
                  onClick={() => sendFeedback('up')}><ThumbsUp size={18} weight="duotone" /></button>
                <button
                  className={`idb-fb-btn ${feedback === 'down' ? 'active-down' : ''}`}
                  onClick={() => sendFeedback('down')}><ThumbsDown size={18} weight="duotone" /></button>
              </div>
            </div>
            <div className="idb-draft-text">{draft}</div>
          </>
        ) : (
          <button className="idb-gen-btn" onClick={regenerateDraft} disabled={loading}>
            {loading ? 'Generating…' : <><Sparkle size={14} weight="fill" style={{ verticalAlign: '-2px', marginRight: 6 }} />Generate reply draft</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Monitor Panel ─────────────────────────────────────────────────────────────
function MonitorPanel({ monitor, apiKey, onDeactivate }) {
  const [matches, setMatches]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [loaded, setLoaded]     = useState(false)
  const [offset, setOffset]     = useState(0)
  const [hasMore, setHasMore]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const LIMIT = 10

  const loadMatches = useCallback(async (reset = false) => {
    setLoading(true)
    const off = reset ? 0 : offset
    const data = await apiFetch(
      `/v1/insights/matches?monitor_id=${monitor.id}&limit=${LIMIT}&offset=${off}`,
      apiKey
    )
    if (data.success) {
      const newMatches = data.matches || []
      setMatches(prev => reset ? newMatches : [...prev, ...newMatches])
      setOffset(off + newMatches.length)
      setHasMore(newMatches.length === LIMIT)
      setLoaded(true)
    }
    setLoading(false)
  }, [monitor.id, apiKey, offset])

  useEffect(() => { loadMatches(true) }, [monitor.id])

  async function handleDeactivate() {
    if (!confirm(`Deactivate "${monitor.name}"?`)) return
    const data = await apiFetch(`/v1/insights/monitors/${monitor.id}`, apiKey, { method: 'DELETE' })
    if (data.success) onDeactivate(monitor.id)
  }

  const filtered = filter === 'all' ? matches
    : filter === 'approved' ? matches.filter(m => m.approved)
    : filter === 'drafted' ? matches.filter(m => m.draft)
    : matches

  return (
    <div className="idb-monitor-panel">
      <div className="idb-monitor-header">
        <div className="idb-monitor-info">
          <div className="idb-monitor-name">{monitor.name}</div>
          <div className="idb-monitor-stats">
            <span>{monitor.keyword_count} keywords</span>
            <span>·</span>
            <span>{monitor.total_matches_found || 0} total matches</span>
            <span>·</span>
            <span className={`idb-status ${monitor.active ? 'active' : 'inactive'}`}>
              {monitor.active ? '● Live' : '○ Paused'}
            </span>
            {monitor.last_poll_at && (
              <><span>·</span><span className="idb-last-poll">
                Last polled {new Date(monitor.last_poll_at).toLocaleTimeString()}
              </span></>
            )}
          </div>
        </div>
        <div className="idb-monitor-actions">
          <button className="idb-pause-btn" onClick={handleDeactivate}>Deactivate</button>
        </div>
      </div>

      <div className="idb-keywords-strip">
        {monitor.keywords?.slice(0, 8).map(kw => (
          <span key={kw} className="idb-kw-chip">{kw}</span>
        ))}
        {monitor.keyword_count > 8 && (
          <span className="idb-kw-chip muted">+{monitor.keyword_count - 8} more</span>
        )}
      </div>

      <div className="idb-matches-area">
        <div className="idb-matches-toolbar">
          <div className="idb-matches-title">Recent matches ({matches.length})</div>
          <div className="idb-filter-tabs">
            {['all', 'approved', 'drafted'].map(f => (
              <button key={f} className={`idb-filter-tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          <button className="idb-refresh-btn" onClick={() => loadMatches(true)} disabled={loading}>
            {loading ? '…' : '↺ Refresh'}
          </button>
        </div>

        {!loaded && loading && <div className="idb-loading">Loading matches…</div>}
        {loaded && filtered.length === 0 && (
          <div className="idb-empty">No matches yet — the monitor runs every 15 minutes.</div>
        )}

        <div className="idb-matches-list">
          {filtered.map(m => (
            <MatchCard key={m.id} match={m} apiKey={apiKey} monitorId={monitor.id} />
          ))}
        </div>

        {hasMore && loaded && (
          <button className="idb-load-more" onClick={() => loadMatches(false)} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Create Monitor Modal ──────────────────────────────────────────────────────
function CreateMonitorModal({ apiKey, onCreated, onClose }) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [context, setContext] = useState('')
  const [kwText, setKwText]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    const keywords = kwText.split('\n').map(l => l.trim()).filter(Boolean)
    if (!name || keywords.length === 0) { setError('Name and at least one keyword required'); return }
    setLoading(true); setError('')
    const data = await apiFetch('/v1/insights/monitors', apiKey, {
      method: 'POST',
      body: JSON.stringify({ name, alertEmail: email, productContext: context, keywords }),
    })
    if (data.success) { onCreated(data); onClose() }
    else setError(data.error?.message || 'Failed to create monitor')
    setLoading(false)
  }

  return (
    <div className="idb-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="idb-modal">
        <div className="idb-modal-header">
          <h2>New Monitor</h2>
          <button className="idb-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="idb-modal-form">
          <label>Monitor name
            <input value={name} onChange={e => setName(e.target.value)} placeholder="My SaaS — Reddit Monitor" required />
          </label>
          <label>Alert email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
          </label>
          <label>Product context <span className="idb-opt">(helps AI write better drafts)</span>
            <textarea value={context} onChange={e => setContext(e.target.value)}
              placeholder="We help freelancers send professional invoices in 30 seconds…" rows={4} />
          </label>
          <label>Keywords <span className="idb-opt">(one per line — add [subreddit,subreddit] to scope)</span>
            <textarea value={kwText} onChange={e => setKwText(e.target.value)}
              placeholder={'invoice tool freelance [freelance,freelancers]\nunpaid invoice\nclient refused to pay'}
              rows={6} required />
          </label>
          {error && <div className="idb-error">{error}</div>}
          <div className="idb-modal-footer">
            <button type="button" className="idb-modal-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="idb-modal-submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create monitor →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function InsightsDashboard() {
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem('insights_key') || '')
  const [monitors, setMonitors]   = useState([])
  const [loggedIn, setLoggedIn]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [networkError, setNetworkError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [activeId, setActiveId]   = useState(null)

  // Set document title on mount
  useEffect(() => {
    document.title = 'Ebenova Insights — Dashboard'
  }, [])

  // Auto-login if key stored
  useEffect(() => {
    const stored = localStorage.getItem('insights_key')
    if (stored) autoLogin(stored)
  }, [])

  async function autoLogin(key) {
    setLoading(true)
    setNetworkError(false)
    try {
      const data = await apiFetch('/v1/insights/monitors', key)
      if (data.success) {
        setApiKey(key)
        const mons = (data.monitors || []).map(m => ({ ...m, id: m.id || m.monitor_id }))
        setMonitors(mons)
        setActiveId(mons[0]?.id || null)
        setLoggedIn(true)
      } else {
        localStorage.removeItem('insights_key')
      }
    } catch (_) {
      // Network unreachable — don't wipe the stored key, let user retry
      setNetworkError(true)
    }
    setLoading(false)
  }

  function handleLogin(key, mons) {
    setApiKey(key)
    const normalized = (mons || []).map(m => ({ ...m, id: m.id || m.monitor_id }))
    setMonitors(normalized)
    setActiveId(normalized[0]?.id || null)
    setNetworkError(false)
    setLoggedIn(true)
  }

  function handleLogout() {
    localStorage.removeItem('insights_key')
    setLoggedIn(false); setApiKey(''); setMonitors([])
  }

  function handleDeactivate(id) {
    setMonitors(prev => prev.filter(m => m.id !== id))
    if (activeId === id) setActiveId(monitors.find(m => m.id !== id)?.id || null)
  }

  function handleCreated(data) {
    const newMon = { id: data.monitor_id, name: data.name, active: true,
      keyword_count: data.keyword_count, keywords: data.keywords,
      alert_email: data.alert_email, plan: data.plan,
      total_matches_found: 0, last_poll_at: null }
    setMonitors(prev => [newMon, ...prev])
    setActiveId(newMon.id)
  }

  const activeMonitor = monitors.find(m => m.id === activeId)

  if (loading) return (
    <div className="idb-splash">
      <div className="idb-splash-logo"><Broadcast size={48} weight="duotone" /></div>
      <div className="idb-splash-text">Loading…</div>
    </div>
  )

  if (networkError) return (
    <div className="idb-splash">
      <div className="idb-splash-logo"><Lightning size={48} weight="duotone" /></div>
      <div className="idb-splash-text" style={{ color: '#fa5a5a', marginBottom: 12 }}>Can't reach the API</div>
      <div className="idb-splash-text" style={{ marginBottom: 20, maxWidth: 340, textAlign: 'center', lineHeight: 1.5 }}>
        Could not connect to <code>api.ebenova.dev</code>. Check your internet connection or try again shortly.
      </div>
      <button className="idb-btn-gold" onClick={() => autoLogin(apiKey)}>Retry</button>
      <button style={{ marginTop: 10, background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer' }}
        onClick={() => { localStorage.removeItem('insights_key'); setNetworkError(false) }}>Sign out</button>
    </div>
  )

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />

  return (
    <div className="idb-page">
      <Helmet>
        <title>Ebenova Insights — Dashboard</title>
        <meta name="description" content="Monitor your Reddit and Nairaland keyword alerts. View AI-drafted replies and manage your monitors." />
        <meta name="robots" content="noindex" />
        <link rel="canonical" href="https://www.ebenova.dev/insights/dashboard" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ebenova" />
        <meta property="og:url" content="https://www.ebenova.dev/insights/dashboard" />
        <meta property="og:title" content="Ebenova Insights — Dashboard" />
        <meta property="og:description" content="Monitor your Reddit and Nairaland keyword alerts. View AI-drafted replies and manage your monitors." />
        <meta property="og:image" content="https://www.ebenova.dev/og-image-ebenova.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@quantimleap100" />
        <meta name="twitter:title" content="Ebenova Insights — Dashboard" />
        <meta name="twitter:description" content="Monitor your Reddit and Nairaland keyword alerts. View AI-drafted replies and manage your monitors." />
        <meta name="twitter:image" content="https://www.ebenova.dev/og-image-ebenova.png" />
      </Helmet>

      {/* ── Sidebar ── */}
      <aside className="idb-sidebar">
        <div className="idb-sidebar-brand">
          <Link to="/insights" className="idb-brand-link"><Broadcast size={16} weight="duotone" style={{ verticalAlign: '-3px', marginRight: 6 }} />Insights</Link>
        </div>

        <div className="idb-sidebar-section-label">Monitors</div>
        <div className="idb-monitor-list">
          {monitors.length === 0 && (
            <div className="idb-no-monitors">No monitors yet</div>
          )}
          {monitors.map(m => (
            <button key={m.id}
              className={`idb-monitor-btn ${activeId === m.id ? 'active' : ''}`}
              onClick={() => setActiveId(m.id)}>
              <span className={`idb-dot ${m.active ? 'live' : 'off'}`} />
              <span className="idb-monitor-btn-name">{m.name}</span>
              <span className="idb-monitor-btn-count">{m.total_matches_found || 0}</span>
            </button>
          ))}
        </div>

        <button className="idb-new-monitor-btn" onClick={() => setShowCreate(true)}>
          + New monitor
        </button>

        <div className="idb-sidebar-footer">
          <a href="https://ebenova.dev/insights" className="idb-sidebar-link">← Back to Insights</a>
          <button className="idb-logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="idb-main">
        {monitors.length === 0 ? (
          <div className="idb-empty-state">
            <div className="idb-empty-icon"><Broadcast size={40} weight="duotone" /></div>
            <h2>No monitors yet</h2>
            <p>Create your first monitor to start tracking Reddit for your keywords.</p>
            <button className="idb-btn-gold" onClick={() => setShowCreate(true)}>
              + Create monitor
            </button>
          </div>
        ) : activeMonitor ? (
          <MonitorPanel
            key={activeMonitor.id}
            monitor={activeMonitor}
            apiKey={apiKey}
            onDeactivate={handleDeactivate}
          />
        ) : null}
      </main>

      {showCreate && (
        <CreateMonitorModal apiKey={apiKey} onCreated={handleCreated} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
