import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Landing.css'

const DOCS = [
  {
    id: 'privacy-policy',
    icon: '🔒',
    name: 'Privacy Policy',
    desc: 'Required for any app, website or service that collects user data.',
    time: '2 min',
    popular: true,
  },
  {
    id: 'terms-of-service',
    icon: '📋',
    name: 'Terms of Service',
    desc: 'Define the rules users must agree to when using your product.',
    time: '2 min',
    popular: true,
  },
  {
    id: 'nda',
    icon: '🤝',
    name: 'Non-Disclosure Agreement',
    desc: 'Protect confidential information shared with employees or partners.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'freelance-contract',
    icon: '✍️',
    name: 'Freelance Contract',
    desc: 'Set expectations, deliverables, and payment terms for client work.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'independent-contractor',
    icon: '🏢',
    name: 'Independent Contractor Agreement',
    desc: 'Formally define the relationship between your business and contractors.',
    time: '3 min',
    popular: false,
  },
]

const TICKER_ITEMS = [
  'Privacy Policies', 'NDAs', 'Freelance Contracts', 'Terms of Service',
  'Contractor Agreements',
]

export default function Landing() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useState(0)
  const [tickerVisible, setTickerVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setTickerVisible(false)
      setTimeout(() => {
        setTicker(p => (p + 1) % TICKER_ITEMS.length)
        setTickerVisible(true)
      }, 300)
    }, 2500)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="landing">
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-mark">S</span>
            <span className="logo-text">Signova</span>
          </div>
          <div className="nav-links">
            <a href="#documents">Documents</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="badge-dot" />
            AI-Powered · No Account Required · First Document Free
          </div>
          <h1 className="hero-title">
            Generate professional
            <br />
            <span className={`hero-accent ${tickerVisible ? 'visible' : ''}`}>
              {TICKER_ITEMS[ticker]}
            </span>
            <br />
            in under 3 minutes.
          </h1>
          <p className="hero-sub">
            Stop paying $300/hr for standard legal documents. Answer a few questions,
            get a lawyer-quality document instantly. Preview free, pay $4.99 to download.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
            >
              Generate your document
              <span className="btn-arrow">→</span>
            </button>
            <span className="hero-note">No credit card · No account · First preview free</span>
          </div>
          <div className="hero-stats">
            <div className="stat"><span className="stat-num">5</span><span className="stat-label">Document types</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-num">~2 min</span><span className="stat-label">Average time</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-num">$4.99</span><span className="stat-label">Per document</span></div>
          </div>
        </div>
      </section>

      <section className="docs-section" id="documents">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Choose your document</p>
            <h2 className="section-title">What do you need today?</h2>
          </div>
          <div className="docs-grid">
            {DOCS.map(doc => (
              <button key={doc.id} className="doc-card" onClick={() => navigate(`/generate/${doc.id}`)}>
                {doc.popular && <span className="doc-popular">Popular</span>}
                <div className="doc-icon">{doc.icon}</div>
                <div className="doc-content">
                  <h3 className="doc-name">{doc.name}</h3>
                  <p className="doc-desc">{doc.desc}</p>
                </div>
                <div className="doc-footer">
                  <span className="doc-time">⏱ {doc.time}</span>
                  <span className="doc-go">Generate →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">The process</p>
            <h2 className="section-title">Three steps to done.</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', title: 'Choose your document', body: 'Select from Privacy Policy, Terms of Service, NDA, Freelance Contract, or Independent Contractor Agreement.' },
              { n: '02', title: 'Answer a few questions', body: 'Tell us about your business, jurisdiction, and needs. Takes about 2 minutes. No legal knowledge required.' },
              { n: '03', title: 'Preview free, pay to download', body: 'See your complete document instantly. Pay $4.99 to download the clean, watermark-free PDF.' },
            ].map(s => (
              <div key={s.n} className="step">
                <span className="step-num">{s.n}</span>
                <div>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Pricing</p>
            <h2 className="section-title">Simple and honest.</h2>
          </div>
          <div className="pricing-grid">
            {[
              {
                tier: 'Free Preview', price: '$0', desc: 'See your complete document before paying anything.',
                features: ['Full document generated', 'Preview in browser', 'No account needed'],
                missing: ['Watermarked PDF', 'No download'],
                cta: 'Try for free', outline: true,
              },
              {
                tier: 'Single Document', price: '$4.99', desc: 'Pay once, download once. Clean PDF, yours to keep.', featured: true,
                features: ['Full document generated', 'Clean PDF, no watermark', 'Instant download', 'Legally reviewed templates', 'No subscription'],
                missing: [],
                cta: 'Get started', outline: false,
              },
              {
                tier: 'Unlimited', price: '$9.99', per: '/mo', desc: 'For freelancers and growing businesses.',
                features: ['Unlimited documents', 'All document types', 'Clean PDFs always', 'Priority generation', 'Cancel anytime'],
                missing: [],
                cta: 'Start free trial', outline: true,
              },
            ].map(p => (
              <div key={p.tier} className={`price-card ${p.featured ? 'price-featured' : ''}`}>
                {p.featured && <div className="price-top-badge">Most popular</div>}
                <div className="price-tier">{p.tier}</div>
                <div className="price-amount">{p.price}{p.per && <span className="price-per">{p.per}</span>}</div>
                <p className="price-desc">{p.desc}</p>
                <ul className="price-list">
                  {p.features.map(f => <li key={f} className="price-yes">✓ {f}</li>)}
                  {p.missing.map(f => <li key={f} className="price-no">✗ {f}</li>)}
                </ul>
                <button
                  className={p.outline ? 'btn-outline' : 'btn-primary'}
                  onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
                >
                  {p.cta} {!p.outline && <span className="btn-arrow">→</span>}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-section">
        <div className="section-inner">
          <div className="trust-grid">
            {[
              { icon: '⚡', title: 'Instant generation', body: 'Documents ready in seconds, not days.' },
              { icon: '🔐', title: 'Privacy first', body: 'Your answers are never stored or shared.' },
              { icon: '📄', title: 'Lawyer-reviewed', body: 'Templates built from real legal frameworks.' },
              { icon: '🌍', title: 'Jurisdiction-aware', body: 'Tailored for your country and industry.' },
            ].map(t => (
              <div key={t.title} className="trust-item">
                <span className="trust-icon">{t.icon}</span>
                <h3 className="trust-title">{t.title}</h3>
                <p className="trust-body">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="section-inner">
          <div className="cta-box">
            <h2 className="cta-title">Ready to get protected?</h2>
            <p className="cta-sub">Your first document preview is completely free. No credit card, no account.</p>
            <button
              className="btn-primary btn-large"
              onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
            >
              Generate your document now <span className="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div className="logo">
            <span className="logo-mark">S</span>
            <span className="logo-text">Signova</span>
          </div>
          <div className="footer-links">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Use</a>
            <a href="mailto:hello@getsignova.com">Contact</a>
          </div>
          <p className="footer-disc">
            Documents generated by Signova are based on legal templates and AI assistance.
            For complex legal matters, consult a qualified attorney.
          </p>
          <p className="footer-copy">© 2026 Signova · Ebenova Solutions</p>
        </div>
      </footer>
    </div>
  )
}
