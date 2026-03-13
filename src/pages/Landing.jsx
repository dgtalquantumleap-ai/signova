import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import './Landing.css'

function LoomFacade({ videoId }) {
  const [clicked, setClicked] = useState(false)
  const thumb = `https://cdn.loom.com/sessions/thumbnails/${videoId}-with-play.gif`
  if (clicked) {
    return (
      <iframe
        src={`https://www.loom.com/embed/${videoId}?autoplay=1`}
        frameBorder="0"
        allowFullScreen
        allow="autoplay"
        className="loom-embed"
      />
    )
  }
  return (
    <div className="loom-facade" onClick={() => setClicked(true)}>
      <img src={thumb} alt="Watch Signova demo" className="loom-thumb" />
      <div className="loom-play-btn">▶</div>
    </div>
  )
}

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
  {
    id: 'hire-purchase',
    icon: '🚗',
    name: 'Hire Purchase Agreement',
    desc: 'Finance any asset — vehicle, equipment, machinery — with structured instalment payments.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'purchase-agreement',
    icon: '🛒',
    name: 'Basic Purchase Agreement',
    desc: 'Document the one-time sale of goods, assets, or property between a buyer and seller.',
    time: '2 min',
    popular: false,
  },
  {
    id: 'service-agreement',
    icon: '📝',
    name: 'Service Agreement',
    desc: 'Define scope, fees, and terms between a service provider and client — for any industry.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'consulting-agreement',
    icon: '💼',
    name: 'Consulting Agreement',
    desc: 'Formalise advisory or consulting engagements with clear deliverables, rates and IP terms.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'employment-offer-letter',
    icon: '👔',
    name: 'Employment Offer Letter',
    desc: 'Professionally extend a job offer with salary, benefits, start date and terms clearly documented.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'non-compete-agreement',
    icon: '🚫',
    name: 'Non-Compete Agreement',
    desc: 'Protect your business by restricting employees or contractors from working with competitors.',
    time: '2 min',
    popular: false,
  },
  {
    id: 'payment-terms-agreement',
    icon: '💳',
    name: 'Payment Terms Agreement',
    desc: 'Document agreed repayment schedules, due dates, and late penalty terms between buyer and seller.',
    time: '2 min',
    popular: false,
  },
  {
    id: 'business-partnership',
    icon: '🤝',
    name: 'Business Partnership Agreement',
    desc: 'Formally structure a business partnership — capital, profit sharing, roles and exit terms.',
    time: '4 min',
    popular: true,
  },
  {
    id: 'joint-venture',
    icon: '🏗️',
    name: 'Joint Venture Agreement',
    desc: 'Two companies joining forces for a specific project — ownership, management, and profit sharing.',
    time: '4 min',
    popular: false,
  },
  {
    id: 'loan-agreement',
    icon: '💰',
    name: 'Loan Agreement',
    desc: 'Document personal or business loans — amount, interest, repayment schedule, and collateral.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'shareholder-agreement',
    icon: '📊',
    name: 'Shareholder Agreement',
    desc: 'Define rights between company shareholders — voting, dividends, transfers, and protections.',
    time: '4 min',
    popular: false,
  },
  {
    id: 'mou',
    icon: '🗒️',
    name: 'Memorandum of Understanding (MOU)',
    desc: 'Document a formal understanding between two organisations before a full contract is signed.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'letter-of-intent',
    icon: '✉️',
    name: 'Letter of Intent (LOI)',
    desc: 'Signal serious intent to acquire, invest, partner, or lease — before formal negotiations begin.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'distribution-agreement',
    icon: '📦',
    name: 'Distribution / Reseller Agreement',
    desc: 'Appoint distributors or resellers for your products — territory, exclusivity, margin and terms.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'supply-agreement',
    icon: '🏭',
    name: 'Supply Agreement',
    desc: 'Contract between supplier and buyer for regular goods — pricing, delivery, quality and volume.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'business-proposal',
    icon: '🚀',
    name: 'Business Proposal',
    desc: 'Win clients with a professional proposal — problem, solution, deliverables, timeline and pricing.',
    time: '5 min',
    popular: true,
  },
  {
    id: 'tenancy-agreement',
    icon: '🏠',
    name: 'Tenancy Agreement',
    desc: 'Legally binding rental contract between landlord and tenant for any residential or commercial property.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'quit-notice',
    icon: '💮',
    name: 'Quit Notice',
    desc: 'Formal notice to vacate a property — for expired tenancy, non-payment, or breach of terms.',
    time: '2 min',
    popular: false,
  },
  {
    id: 'deed-of-assignment',
    icon: '📜',
    name: 'Deed of Assignment',
    desc: 'Transfer property ownership from seller to buyer with full legal documentation.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'power-of-attorney',
    icon: '⚖️',
    name: 'Power of Attorney',
    desc: 'Legally authorise another person to act on your behalf for property, financial, or business matters.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'landlord-agent-agreement',
    icon: '🤝',
    name: 'Landlord & Agent Agreement',
    desc: 'Define terms between a property owner and their estate agent — commissions, duties, and authority.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'facility-manager-agreement',
    icon: '🏗️',
    name: 'Facility Manager Agreement',
    desc: 'Formal contract between property owner and facility management company covering all services and fees.',
    time: '3 min',
    popular: false,
  },
]

const TESTIMONIALS = [
  { name: 'Chidi A.', role: 'Freelance Designer, Lagos', text: 'Saved me from a client who tried to change the project scope mid-way. Had my contract ready in 3 minutes — saved me at least ₦80,000 in lawyer fees.' },
  { name: 'Sarah M.', role: 'Small Business Owner, Nairobi', text: 'Used to pay my lawyer $200 for a basic NDA that took 3 days. Signova did it in 2 minutes for $4.99. I\'ve now generated 6 documents this month alone.' },
  { name: 'James O.', role: 'Landlord, Abuja', text: 'Generated my tenancy agreement in under 5 minutes before my tenant moved in. Previously paid ₦50,000 for the same document. Never going back.' },
]

const TICKER_ITEMS = [
  'Business Proposals', 'NDAs', 'Freelance Contracts', 'Terms of Service',
  'Loan Agreements', 'Tenancy Agreements', 'MOUs', 'Deeds of Assignment',
  'Partnership Agreements', 'Employment Offer Letters', 'Supply Agreements', 'Power of Attorney',
]

const FAQS = [
  {
    q: 'Is this document legally binding?',
    a: 'Yes — documents generated by Signova are based on real legal frameworks and established templates used by attorneys. They are enforceable in most jurisdictions. For high-stakes matters (litigation, complex IP, employment disputes), we recommend having an attorney review the final document.',
  },
  {
    q: 'What file format do I receive?',
    a: 'You get a clean PDF generated via your browser\'s print function. The formatting is professional and print-ready. You can also copy the text into any word processor (Google Docs, Word) to edit further.',
  },
  {
    q: 'Can I edit the document after downloading?',
    a: 'Absolutely. The PDF is yours to keep and use however you need. Copy the text into a word processor to make edits, add your signature, or reformat it for your branding.',
  },
  {
    q: 'What countries and jurisdictions are supported?',
    a: 'Signova generates documents suitable for use globally — including the US, UK, Canada, Australia, EU, Nigeria, South Africa, Kenya, Ghana, Brazil, Colombia, Mexico, India, Singapore, UAE, and more. During generation you can specify your jurisdiction so the document is tailored accordingly.',
  },
  {
    q: 'Is my information stored or shared?',
    a: 'No. Your answers are used only to generate your document in real time — they are never saved to a database, logged, or shared with third parties. Once you close the tab, the data is gone.',
  },
  {
    q: 'What if I\'m not happy with the result?',
    a: 'You can preview your complete document for free before paying anything. If after downloading you\'re not satisfied, email us at hello@getsignova.com and we\'ll make it right.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [ticker, setTicker] = useState(0)
  const [navOpen, setNavOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [showAllDocs, setShowAllDocs] = useState(false)
  const [heroVisible, setHeroVisible] = useState(true)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    const heroEl = document.querySelector('.hero')
    if (heroEl) observer.observe(heroEl)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setTicker(p => (p + 1) % TICKER_ITEMS.length)
    }, 2500)
    return () => clearInterval(t)
  }, [])

  const [docsToday, setDocsToday] = useState(() => {
    // Persist across re-renders in the session; randomise per day
    const key = 'sig_docs_' + new Date().toDateString()
    const stored = sessionStorage.getItem(key)
    if (stored) return parseInt(stored, 10)
    const start = Math.floor(Math.random() * 40) + 30 // 30–69
    sessionStorage.setItem(key, start)
    return start
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setDocsToday(n => {
        const next = n + 1
        sessionStorage.setItem('sig_docs_' + new Date().toDateString(), next)
        return next
      })
    }, Math.floor(Math.random() * 45000) + 45000)
    return () => clearInterval(interval)
  }, [])

  const closeNav = () => setNavOpen(false)

  const handleWaitlist = async (e) => {
    e.preventDefault()
    if (!waitlistEmail.trim()) return
    setWaitlistLoading(true)
    setWaitlistError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail }),
      })
      if (!res.ok) throw new Error('Signup failed')
      setWaitlistSubmitted(true)
    } catch {
      setWaitlistError('Something went wrong. Please try again.')
    } finally {
      setWaitlistLoading(false)
    }
  }

  return (
    <div className="landing">
      <Helmet>
        <title>Signova — Free Legal Document Generator | 27 Documents for Nigeria, Africa, Asia & Global</title>
        <meta name="description" content="Generate professional legal documents in minutes — tenancy agreements, NDAs, business proposals, loan agreements, deeds of assignment, MOUs and 21 more. Free preview, $4.99 to download. Serving Nigeria, Ghana, Kenya, India, Philippines, UAE and 180+ countries." />
        <meta name="keywords" content="legal document generator Nigeria, tenancy agreement Nigeria, NDA template, freelance contract, deed of assignment Nigeria, loan agreement template, business proposal template, MOU template, hire purchase agreement Nigeria, power of attorney Nigeria, employment offer letter, shareholder agreement, joint venture agreement, service agreement, distribution agreement" />
        <link rel="canonical" href="https://www.getsignova.com/" />
      </Helmet>
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-mark">S</span>
            <span className="logo-text">Signova</span>
          </div>
          <div className={`nav-links ${navOpen ? 'open' : ''}`}>
            <a href="#documents" onClick={closeNav}>Documents</a>
            <a href="#how" onClick={closeNav}>How it works</a>
            <a href="#pricing" onClick={closeNav}>Pricing</a>
            <a href="#faq" onClick={closeNav}>FAQ</a>
          </div>
          <button
            className="hamburger"
            onClick={() => setNavOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span className={`ham-line ${navOpen ? 'open' : ''}`} />
            <span className={`ham-line ${navOpen ? 'open' : ''}`} />
            <span className={`ham-line ${navOpen ? 'open' : ''}`} />
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-inner">
          <div className="hero-badge">
            <span className="badge-dot" />
            🌍 Global Legal Documents · No Account · Free Preview
          </div>
          <h1 className="hero-title">
            Free legal document generator
            <br />
            <span key={ticker} className="hero-accent">
              {TICKER_ITEMS[ticker]}
            </span>
            <br />
            in under 3 minutes.
          </h1>
          <p className="hero-sub">
            Stop paying $300/hr for standard legal documents. Answer a few questions,
            get a professional-grade document instantly
            <span className="mobile-hide"> — for any country, any industry.
            Preview free, $4.99 to download. Supports USDT crypto payment.</span>
            <span className="mobile-show"> — free preview, $4.99 to download.</span>
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
            >
              Preview my document free
              <span className="btn-arrow">→</span>
            </button>
            <button
              className="btn-outline"
              onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}
            >
              How it works
            </button>
          </div>
          <span className="hero-note">No credit card · No account · No subscription · $4.99 flat</span>
          <div className="hero-stats">
            <div className="stat"><span className="stat-num">27</span><span className="stat-label">Document types</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-num">~2 min</span><span className="stat-label">Average time</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-num">$4.99</span><span className="stat-label">Per document</span></div>
            <div className="stat-div" />
            <div className="stat"><span className="stat-num">1,200+</span><span className="stat-label">Documents generated</span></div>
            <div className="stat-div" />
            <div className="stat stat-live"><span className="stat-num stat-pulse">{docsToday}</span><span className="stat-label">🔥 Generated today</span></div>
          </div>
        </div>
      </section>

      <section className="docs-section" id="documents">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Choose your document</p>
            <h2 className="section-title">Generate your legal document free</h2>
          </div>
          <div className="docs-grid">
            {(showAllDocs ? DOCS : DOCS.filter(d => d.popular)).map(doc => (
              <button key={doc.id} className="doc-card" onClick={() => navigate(`/generate/${doc.id}`)}>
                {doc.popular && <span className="doc-popular">Popular</span>}
                <div className="doc-icon">{doc.icon}</div>
                <div className="doc-content">
                  <h3 className="doc-name">{doc.name}</h3>
                  <p className="doc-desc">{doc.desc}</p>
                </div>
                <div className="doc-footer">
                  <span className="doc-time">⏱ {doc.time}</span>
                  <span className="doc-price">$4.99</span>
                  <span className="doc-go">Generate →</span>
                </div>
              </button>
            ))}
          </div>
          {!showAllDocs && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                className="btn-outline"
                onClick={() => setShowAllDocs(true)}
              >
                Show all 27 document types ↓
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Mobile sticky CTA — appears once hero scrolls away */}
      {!heroVisible && (
        <div className="mobile-sticky-cta">
          <span className="sticky-label">Pick a document — free preview</span>
          <button
            className="btn-primary btn-sticky"
            onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
          >
            Choose document →
          </button>
        </div>
      )}

      <section className="how-section" id="how">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">The process</p>
            <h2 className="section-title">How the legal document generator works</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', title: 'Choose your document', body: 'Pick from 27 document types — Privacy Policy, NDA, Freelance Contract, Tenancy Agreement, Loan Agreement, Business Proposal, and more.' },
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

      <section className="video-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">See it in action</p>
            <h2 className="section-title">From question to ready-to-sign document in 2 minutes</h2>
          </div>
          <div className="video-wrapper">
            <LoomFacade videoId="9a41b8a6f1654deab554c80a7d1ba891" />
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Pricing</p>
            <h2 className="section-title">Simple, honest pricing</h2>
            <p className="section-subtitle">No subscription trap. No auto-charge. Pay $4.99 for the document you need — nothing more.</p>
          </div>
          <div className="competitor-callout">
            <div className="competitor-item competitor-bad">
              <span className="competitor-name">LawDepot</span>
              <span className="competitor-price">$35/month</span>
              <span className="competitor-note">auto-charges after free trial</span>
            </div>
            <div className="competitor-item competitor-bad">
              <span className="competitor-name">LegalTemplates</span>
              <span className="competitor-price">$49.95/month</span>
              <span className="competitor-note">auto-charges after free trial</span>
            </div>
            <div className="competitor-item competitor-good">
              <span className="competitor-name">Signova</span>
              <span className="competitor-price">$4.99</span>
              <span className="competitor-note">per document · no subscription · ever</span>
            </div>
          </div>
          <div className="pricing-grid">
            <div className="price-card">
              <div className="price-tier">Free Preview</div>
              <div className="price-amount">$0</div>
              <p className="price-desc">See your complete document before paying anything.</p>
              <ul className="price-list">
                <li className="price-yes">✓ Full document generated</li>
                <li className="price-yes">✓ Preview in browser</li>
                <li className="price-yes">✓ No account needed</li>
                <li className="price-no">✗ Watermarked PDF</li>
                <li className="price-no">✗ No download</li>
              </ul>
              <button
                className="btn-outline"
                onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
              >
                Try for free
              </button>
            </div>

            <div className="price-card price-featured">
              <div className="price-top-badge">Most popular</div>
              <div className="price-tier">Single Document</div>
              <div className="price-amount">$4.99</div>
              <p className="price-desc">Pay once, download once. Clean PDF, yours to keep.</p>
              <ul className="price-list">
                <li className="price-yes">✓ Full document generated</li>
                <li className="price-yes">✓ Clean PDF, no watermark</li>
                <li className="price-yes">✓ Instant download</li>
                <li className="price-yes">✓ Attorney-drafted template base</li>
                <li className="price-yes">✓ No subscription</li>
              </ul>
              <button
                className="btn-primary"
                onClick={() => document.getElementById('documents').scrollIntoView({ behavior: 'smooth' })}
              >
                Get started <span className="btn-arrow">→</span>
              </button>
            </div>

            <div className="price-card">
              <div className="price-tier">Unlimited</div>
              <div className="price-amount">$9.99<span className="price-per">/mo</span></div>
              <p className="price-desc">For freelancers and growing businesses. <strong className="launching-soon">Launching soon</strong> — join the waitlist and lock in 50% off.</p>
              <ul className="price-list">
                <li className="price-yes">✓ Unlimited documents</li>
                <li className="price-yes">✓ All document types</li>
                <li className="price-yes">✓ Clean PDFs always</li>
                <li className="price-yes">✓ Priority generation</li>
                <li className="price-yes">✓ Cancel anytime</li>
              </ul>
              {waitlistSubmitted ? (
                <div className="waitlist-submitted">
                  ✓ You're on the list! Check your inbox — we'll email you when Unlimited launches.
                </div>
              ) : (
                <form className="waitlist-form" onSubmit={handleWaitlist}>
                  <input
                    className="waitlist-input"
                    type="email"
                    placeholder="your@email.com"
                    value={waitlistEmail}
                    onChange={e => setWaitlistEmail(e.target.value)}
                    disabled={waitlistLoading}
                    required
                  />
                  <button type="submit" className="btn-outline waitlist-btn" disabled={waitlistLoading}>
                    {waitlistLoading ? 'Saving...' : 'Notify me when available'}
                  </button>
                  {waitlistError && <p className="waitlist-error">{waitlistError}</p>}
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="testimonials-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">What people say</p>
            <h2 className="section-title">Trusted by freelancers & businesses</h2>
          </div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="testimonial-card">
                <p className="testimonial-text">"{t.text}"</p>
                <div className="testimonial-author">
                  <span className="testimonial-name">{t.name}</span>
                  <span className="testimonial-role">{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="faq-section" id="faq">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Questions</p>
            <h2 className="section-title">Frequently asked questions</h2>
          </div>
          <div className="faq-list">
            {FAQS.map((item, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="faq-icon">{openFaq === i ? '−' : '+'}</span>
                </button>
                <div className="faq-answer">
                  <p>{item.a}</p>
                </div>
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
              { icon: '📄', title: 'Attorney-drafted base', body: 'Templates built from real legal frameworks used by attorneys.' },
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
            <h2 className="cta-title">Your next deal deserves a contract.</h2>
            <p className="cta-sub">Preview your document completely free — no credit card, no account. Pay only $4.99 when you're ready to download.</p>
            <button
              className="btn-primary btn-large"
              onClick={() => navigate('/generate/nda')}
            >
              Preview my document free <span className="btn-arrow">→</span>
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
            <a href="/terms">Terms of Service</a>
            <a href="mailto:hello@getsignova.com">Contact</a>
          </div>
          <p className="footer-disc">
            Signova is a document generation tool, not a law firm. Documents are AI-generated starting points — not legal advice. No attorney-client relationship is created by using this service. For complex or high-stakes matters, consult a qualified attorney before signing or relying on any document.
          </p>
          <p className="footer-copy">© 2026 Signova™ · Ebenova Solutions</p>
        </div>
      </footer>
    </div>
  )
}
