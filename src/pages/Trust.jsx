import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  ShieldCheck, Fingerprint, Certificate, Clock, LinkSimple,
  CheckCircle, XCircle, Warning, ArrowRight, Copy, Check,
} from '@phosphor-icons/react'
import './Trust.css'

function CopyCode({ value }) {
  const [copied, setCopied] = useState(false)
  if (!value) return <code>—</code>
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked */ }
  }
  return (
    <span className="trust-copy-wrap">
      <code>{value}</code>
      <button type="button" className="trust-copy-btn" onClick={copy} aria-label="Copy to clipboard">
        {copied ? <Check size={12} weight="bold" /> : <Copy size={12} weight="regular" />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </span>
  )
}

const TILE = { size: 24, weight: 'duotone', color: 'currentColor' }

function StatusPill({ kind, children }) {
  const map = {
    ok:   { icon: <CheckCircle size={14} weight="fill" />, cls: 'tr-pill tr-pill--ok' },
    bad:  { icon: <XCircle size={14} weight="fill" />,     cls: 'tr-pill tr-pill--bad' },
    warn: { icon: <Warning size={14} weight="fill" />,     cls: 'tr-pill tr-pill--warn' },
  }[kind] || { icon: null, cls: 'tr-pill' }
  return <span className={map.cls}>{map.icon} {children}</span>
}

export default function Trust() {
  const [params] = useSearchParams()
  const initialHash = (params.get('hash') || '').trim()
  const [hash, setHash] = useState(initialHash)
  const [docText, setDocText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stickyVisible, setStickyVisible] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/audit/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.ok) setStats(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const card = document.querySelector('.trust-card')
      if (!card) return
      const rect = card.getBoundingClientRect()
      setStickyVisible(rect.bottom < 80)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToVerify = () => {
    const card = document.querySelector('.trust-card')
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (initialHash) verifyHash(initialHash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verifyHash(h) {
    setError(''); setResult(null); setLoading(true)
    try {
      const r = await fetch(`/api/verify?hash=${encodeURIComponent(h)}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Verification failed')
      setResult({ kind: 'hash', data })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyText() {
    if (!docText.trim()) { setError('Paste the full document text first.'); return }
    setError(''); setResult(null); setLoading(true)
    try {
      const r = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: docText }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Verification failed')
      setResult({ kind: 'text', data })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="trust-page">
      <Helmet>
        <title>Document Trust &amp; Provenance | Signova</title>
        <meta name="description" content="Every Signova document carries a tamper-evident SHA-256 fingerprint. Verify that what you hold is byte-for-byte what we generated." />
        <link rel="canonical" href="https://www.getsignova.com/trust" />
      </Helmet>

      <nav className="trust-nav">
        <Link to="/" className="trust-logo">
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </Link>
        <Link to="/" className="trust-back">← Back to home</Link>
      </nav>

      <header className="trust-hero">
        <div className="trust-eyebrow">
          <ShieldCheck size={14} weight="fill" /> Trust &amp; Provenance
        </div>
        <h1 className="trust-title">Every document carries a fingerprint.</h1>
        <p className="trust-sub">
          Signova stamps each generated document with a SHA-256 content hash — a unique 64-character
          fingerprint derived from the text itself. Change a single character and the fingerprint
          changes. Paste any Signova document below to verify it hasn't been altered.
        </p>

        {stats && (
          <div className="trust-live-strip" aria-label="Live chain status">
            <span className="trust-live-dot" aria-hidden="true" />
            <span className="trust-live-label">Chain live</span>
            <span className="trust-live-sep" aria-hidden="true">·</span>
            <span><strong>{stats.sequence.toLocaleString()}</strong> entries sealed</span>
            {stats.latest_stored_at && (
              <>
                <span className="trust-live-sep" aria-hidden="true">·</span>
                <span>latest {new Date(stats.latest_stored_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </>
            )}
            {stats.head_hash && (
              <>
                <span className="trust-live-sep" aria-hidden="true">·</span>
                <span className="trust-live-head">head <code>{stats.head_hash.slice(0, 12)}…</code></span>
              </>
            )}
          </div>
        )}
      </header>

      <section className="trust-verify">
        <div className="trust-card">
          <h2 className="trust-card-title">Verify a document</h2>
          <p className="trust-card-sub">
            Paste the full text of any Signova document (including the provenance block at the bottom).
            We recompute the hash and compare it to the one stamped inside.
          </p>
          <textarea
            className="trust-textarea"
            placeholder="Paste the full document text here — including the 'Document Provenance' block at the end."
            value={docText}
            onChange={e => setDocText(e.target.value)}
            rows={8}
          />
          <div className="trust-actions">
            <button className="trust-btn trust-btn--primary" onClick={verifyText} disabled={loading}>
              {loading ? 'Verifying…' : <>Verify document <ArrowRight size={14} weight="bold" /></>}
            </button>
            <span className="trust-actions-or">or verify a hash directly</span>
          </div>
          <div className="trust-hash-row">
            <input
              className="trust-input"
              placeholder="Paste a 64-character SHA-256 hash (hex)"
              value={hash}
              onChange={e => setHash(e.target.value)}
              maxLength={128}
            />
            <button className="trust-btn trust-btn--secondary" onClick={() => verifyHash(hash.trim())} disabled={loading || !hash.trim()}>
              Check hash
            </button>
          </div>
          {error && <p className="trust-error"><Warning size={14} weight="fill" /> {error}</p>}
        </div>

        {result && (
          <div className="trust-result">
            {result.kind === 'text' && result.data.embedded && (
              <>
                {result.data.embedded.matches
                  ? <StatusPill kind="ok">Document intact — fingerprint matches</StatusPill>
                  : <StatusPill kind="bad">Tampered — fingerprint does not match</StatusPill>}
                <dl className="trust-kv">
                  <dt>Claimed hash</dt>
                  <dd><CopyCode value={result.data.embedded.claimed_hash} /></dd>
                  <dt>Recomputed body hash</dt>
                  <dd><CopyCode value={result.data.embedded.recomputed_body_hash} /></dd>
                  <dt>Full-document hash</dt>
                  <dd><CopyCode value={result.data.full_document_hash} /></dd>
                  {result.data.signature && (
                    <>
                      <dt>Signature</dt>
                      <dd>
                        {result.data.signature.verified
                          ? <StatusPill kind="ok">Ed25519 · {result.data.signature.key_id} · verified</StatusPill>
                          : <StatusPill kind="bad">Ed25519 · {result.data.signature.reason}</StatusPill>}
                      </dd>
                    </>
                  )}
                  {result.data.audit && (
                    <>
                      <dt>Audit sequence</dt>
                      <dd>#{result.data.audit.sequence} · stored {new Date(result.data.audit.stored_at).toLocaleString()}</dd>
                      <dt>Previous chain hash</dt>
                      <dd>{result.data.audit.prev_hash ? <CopyCode value={result.data.audit.prev_hash} /> : <code>(genesis)</code>}</dd>
                    </>
                  )}
                  {result.data.timestamp && (
                    <>
                      <dt>OpenTimestamps</dt>
                      <dd>
                        {result.data.timestamp.anchored
                          ? <StatusPill kind="ok">Anchored · {result.data.timestamp.calendar}</StatusPill>
                          : <StatusPill kind="warn">Not yet anchored</StatusPill>}
                      </dd>
                    </>
                  )}
                </dl>
              </>
            )}
            {result.kind === 'text' && !result.data.embedded && (
              <>
                <StatusPill kind="warn">No Signova provenance block found</StatusPill>
                <p className="trust-result-note">
                  The text was hashed, but it does not contain a Signova fingerprint block.
                  This may not be a Signova-generated document.
                </p>
                <dl className="trust-kv">
                  <dt>Computed hash</dt>
                  <dd><CopyCode value={result.data.full_document_hash} /></dd>
                </dl>
              </>
            )}
            {result.kind === 'hash' && (
              <>
                <StatusPill kind="ok">Valid SHA-256 hash format</StatusPill>
                <dl className="trust-kv">
                  <dt>Hash</dt>
                  <dd><CopyCode value={result.data.hash} /></dd>
                  <dt>Fingerprint</dt>
                  <dd><CopyCode value={result.data.fingerprint} /></dd>
                </dl>
                <p className="trust-result-note">
                  Hash format is valid. To verify a specific document matches this hash,
                  paste the full document text above.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <section className="trust-how">
        <h2 className="trust-section-title">How the fingerprint is built</h2>
        <div className="trust-steps">
          <div className="trust-step">
            <div className="trust-step-icon"><Fingerprint {...TILE} /></div>
            <div className="trust-step-num">01</div>
            <h3>Normalise</h3>
            <p>Line endings, trailing whitespace, and redundant blank lines are collapsed so cosmetic differences never affect the hash.</p>
          </div>
          <div className="trust-step">
            <div className="trust-step-icon"><Certificate {...TILE} /></div>
            <div className="trust-step-num">02</div>
            <h3>Hash</h3>
            <p>SHA-256 produces a deterministic 64-character hex fingerprint. Any change to the text — a single digit, a comma — produces a completely different hash.</p>
          </div>
          <div className="trust-step">
            <div className="trust-step-icon"><Clock {...TILE} /></div>
            <div className="trust-step-num">03</div>
            <h3>Stamp</h3>
            <p>The hash is embedded as a provenance block at the end of the document, along with the issuer, algorithm, and issue time.</p>
          </div>
          <div className="trust-step">
            <div className="trust-step-icon"><LinkSimple {...TILE} /></div>
            <div className="trust-step-num">04</div>
            <h3>Verify</h3>
            <p>Anyone holding the document can recompute the hash and compare it to the stamped value. This page does exactly that — no account, no tracking.</p>
          </div>
        </div>
      </section>

      <section className="trust-roadmap">
        <h2 className="trust-section-title">How we layer the proof</h2>
        <ul className="trust-roadmap-list">
          <li>
            <strong>Ed25519-signed receipts · Live</strong> — every receipt is cryptographically signed with a Signova private key. The published public key at <Link to="/api/pubkey" className="trust-footer-link">/api/pubkey</Link> lets anyone verify authorship without contacting us.
          </li>
          <li>
            <strong>Tamper-evident audit log · Live</strong> — each receipt references the hash of the previous receipt, forming an append-only chain. A single entry cannot be altered without invalidating every entry that follows it. Look up an entry with <code>GET /api/audit?hash=…</code>.
          </li>
          <li>
            <strong>OpenTimestamps anchoring · Live</strong> — document hashes can be submitted to a public OpenTimestamps calendar via <code>POST /api/timestamp</code>. The resulting commitment is upgradable into a full Bitcoin proof, giving you a free, wallet-less, trust-minimised record that the document existed at a specific moment.
          </li>
        </ul>
        <p className="trust-roadmap-note">
          Each layer is additive. The SHA-256 fingerprint never changes — signatures, the chain, and Bitcoin anchoring stack on top of the same hash.
        </p>
      </section>

      <section className="trust-api">
        <h2 className="trust-section-title">Programmatic verification</h2>
        <p className="trust-api-sub">Every endpoint is public, unauthenticated, and side-effect free.</p>
        <pre className="trust-code">{`# Verify a document's integrity (hash + signature + audit + timestamp)
curl -X POST https://www.getsignova.com/api/verify \\
  -H 'Content-Type: application/json' \\
  -d '{"text": "<paste the full document here>"}'

# Validate a hash format
curl 'https://www.getsignova.com/api/verify?hash=<64-char-sha256-hex>'

# Fetch the Ed25519 public key used to sign receipts
curl https://www.getsignova.com/api/pubkey

# Look up an audit-chain entry by document hash or entry hash
curl 'https://www.getsignova.com/api/audit?hash=<64-char-sha256-hex>'

# Snapshot of chain state (count, head hash, latest timestamp)
curl https://www.getsignova.com/api/audit/stats

# Submit a hash for OpenTimestamps / Bitcoin anchoring (idempotent)
curl -X POST https://www.getsignova.com/api/timestamp \\
  -H 'Content-Type: application/json' \\
  -d '{"hash": "<64-char-sha256-hex>"}'

# Retrieve the stored OTS commitment for a hash
curl 'https://www.getsignova.com/api/timestamp?hash=<64-char-sha256-hex>'`}</pre>
      </section>

      {/* Sticky verify CTA — appears after the user scrolls past the verify card */}
      <div className={`trust-sticky ${stickyVisible ? 'visible' : ''}`} role="region" aria-label="Quick verify">
        <button type="button" className="trust-btn trust-btn--primary" onClick={scrollToVerify}>
          <ShieldCheck size={16} weight="fill" /> Verify a document
        </button>
      </div>

      <footer className="trust-footer">
        <Link to="/" className="trust-footer-link">Signova</Link>
        <span> · </span>
        <Link to="/privacy" className="trust-footer-link">Privacy</Link>
        <span> · </span>
        <Link to="/terms" className="trust-footer-link">Terms</Link>
      </footer>
    </div>
  )
}
