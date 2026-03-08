import { useState } from 'react'

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleUnlock = (e) => {
    e.preventDefault()
    if (secret.trim()) setAuthed(true)
  }

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    setCode('')
    setCopied(false)
    try {
      const res = await fetch('/api/create-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate code.')
        if (res.status === 401) setAuthed(false)
        return
      }
      setCode(data.code)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const waMessage = code
    ? encodeURIComponent(
        `Hi! Your payment has been confirmed ✅\n\nHere is your Signova download code:\n\n*${code}*\n\nSteps to download your document:\n1. Go back to getsignova.com and fill in your document details again\n2. On the preview page, scroll down and click *"Already paid? Enter your code"*\n3. Enter the code above and click *"Unlock my document"*\n\nYour code expires in 24 hours. Reply here if you need any help!`
      )
    : ''

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.logoMark}>S</span>
          <span style={styles.logoText}>Signova Admin</span>
        </div>

        {!authed ? (
          <form onSubmit={handleUnlock} style={styles.form}>
            <p style={styles.label}>Enter admin password</p>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••••••"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              autoFocus
            />
            <button style={styles.btn} type="submit">Unlock →</button>
          </form>
        ) : (
          <div style={styles.body}>
            <p style={styles.title}>Generate WhatsApp Bypass Code</p>
            <p style={styles.sub}>
              Use this after a customer confirms payment via bank transfer.
              Each code unlocks one download and expires in 24 hours.
            </p>

            <button
              style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Generating…' : '⚡ Generate New Code'}
            </button>

            {error && <p style={styles.error}>{error}</p>}

            {code && (
              <div style={styles.result}>
                <p style={styles.codeLabel}>YOUR CODE</p>
                <div style={styles.codeRow}>
                  <span style={styles.code}>{code}</span>
                  <button style={styles.copyBtn} onClick={handleCopy}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p style={styles.expiry}>⏱ Expires in 24 hours · Single use</p>

                <a
                  href={`https://wa.me/?text=${waMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.waBtn}
                >
                  💬 Send via WhatsApp
                </a>
                <p style={styles.waSub}>Opens WhatsApp with the message pre-written</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const gold = '#c9a84c'
const bg = '#0e0e0e'

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 420,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoMark: {
    width: 36, height: 36,
    background: gold,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    fontWeight: 800,
    color: bg,
    lineHeight: '36px',
    textAlign: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 1,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: { color: '#888', fontSize: 13, margin: 0 },
  input: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 10,
    color: '#fff',
    fontSize: 16,
    padding: '12px 16px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    background: gold,
    color: bg,
    border: 'none',
    borderRadius: 10,
    padding: '14px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  body: { display: 'flex', flexDirection: 'column', gap: 14 },
  title: { color: '#fff', fontSize: 17, fontWeight: 700, margin: 0 },
  sub: { color: '#777', fontSize: 13, lineHeight: 1.6, margin: 0 },
  error: { color: '#ff6b6b', fontSize: 13, margin: 0 },
  result: {
    background: '#1a1a1a',
    border: `1px solid ${gold}`,
    borderRadius: 12,
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  codeLabel: { color: '#777', fontSize: 11, letterSpacing: 3, margin: 0 },
  codeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  code: {
    fontSize: 28,
    fontWeight: 800,
    color: gold,
    fontFamily: 'monospace',
    letterSpacing: 4,
  },
  copyBtn: {
    background: '#2a2a2a',
    border: 'none',
    color: '#aaa',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
  },
  expiry: { color: '#555', fontSize: 12, margin: 0 },
  waBtn: {
    display: 'block',
    background: '#25D366',
    color: '#fff',
    textDecoration: 'none',
    borderRadius: 10,
    padding: '13px',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 700,
  },
  waSub: { color: '#555', fontSize: 11, margin: 0, textAlign: 'center' },
}
