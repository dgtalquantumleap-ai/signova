import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useState } from 'react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

const gold = '#c9a84c'
const inp = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px', padding: '12px 16px',
  fontSize: '14px', color: 'var(--text)',
  fontFamily: 'var(--font-body)', outline: 'none',
  transition: 'border-color 0.2s',
}

export default function ContactPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.email || !form.email.includes('@') || !form.message.trim()) {
      setError('Please fill in your email and message.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSent(true)
      } else {
        setError('Something went wrong. Email us directly at info@ebenova.net')
      }
    } catch {
      setError('Something went wrong. Email us directly at info@ebenova.net')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font-body)' }}>
      <Helmet>
        <title>Contact Signova — Get Help or Send Feedback</title>
        <meta name="description" content="Get in touch with Signova. Questions about documents, payments, or your download? We respond within 24 hours." />
        <link rel="canonical" href="https://www.getsignova.com/contact" />
      </Helmet>

      <SiteNav variant="signova" />

      {/* Content */}
      <section style={{ maxWidth: '560px', margin: '0 auto', padding: '64px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '34px', fontWeight: 700, marginBottom: '10px' }}>
          Get in touch
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text2)', lineHeight: 1.7, marginBottom: '40px' }}>
          We respond to every message within 24 hours — usually faster.
        </p>

        {sent ? (
          <div style={{ background: 'rgba(201,168,76,0.08)', border: `1px solid rgba(201,168,76,0.3)`, borderRadius: '16px', padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
            <h2 style={{ color: gold, fontFamily: 'var(--font-display)', fontSize: '22px', marginBottom: '10px' }}>Message sent</h2>
            <p style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.7 }}>
              We'll get back to you within 24 hours at <strong style={{ color: 'var(--text)' }}>{form.email}</strong>.
            </p>
            <button onClick={() => navigate('/')}
              style={{ marginTop: '24px', background: gold, color: '#0e0e0e', border: 'none', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Back to Signova →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Common topics */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {['Payment issue', 'Refund request', 'Document question', 'Feature request'].map(t => (
                <button key={t} onClick={() => update('subject', t)}
                  style={{ background: form.subject === t ? `rgba(201,168,76,0.15)` : 'rgba(255,255,255,0.04)', border: `1px solid ${form.subject === t ? gold : 'rgba(255,255,255,0.1)'}`, borderRadius: '20px', padding: '6px 14px', fontSize: '12px', color: form.subject === t ? gold : 'var(--text2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  {t}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <input style={inp} placeholder="Your name" value={form.name} onChange={e => update('name', e.target.value)} />
              <input style={inp} type="email" placeholder="Your email *" value={form.email} onChange={e => update('email', e.target.value)} required />
            </div>

            <input style={inp} placeholder="Subject" value={form.subject} onChange={e => update('subject', e.target.value)} />

            <textarea style={{ ...inp, resize: 'vertical', minHeight: '140px', lineHeight: 1.6 }}
              placeholder="Tell us what's going on *"
              value={form.message}
              onChange={e => update('message', e.target.value)}
            />

            {error && (
              <p style={{ color: '#e05c5c', fontSize: '13px', margin: 0 }}>{error}</p>
            )}

            <button onClick={handleSubmit} disabled={loading}
              style={{ background: gold, color: '#0e0e0e', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
              {loading ? 'Sending…' : 'Send message →'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center' }}>
              Or email directly: <a href={`mailto:${'info'}@${'ebenova.net'}`} style={{ color: 'var(--text2)' }}>
                <span className="email-obfuscated" data-user="info" data-domain="ebenova.net"></span>
              </a>
            </p>
          </div>
        )}
      </section>

      <SiteFooter variant="signova" />
    </div>
  )
}
