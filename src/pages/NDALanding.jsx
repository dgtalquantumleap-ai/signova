import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import './Landing.css'
import './NDALanding.css'

const FAQS = [
  {
    q: 'What is an NDA?',
    a: 'A Non-Disclosure Agreement (NDA) is a legally binding contract that prevents one or more parties from sharing confidential information with outside parties. Businesses use NDAs to protect trade secrets, product plans, client lists, financial data, and any other sensitive information shared during negotiations, partnerships, or employment.',
  },
  {
    q: 'When do I need an NDA?',
    a: 'You need an NDA any time you share confidential information with someone outside your organisation — before hiring a contractor, starting a business partnership, pitching investors, discussing a merger, or onboarding an employee with access to sensitive data. An NDA creates a legal record of what was shared and gives you recourse if the information is leaked.',
  },
  {
    q: 'What is the difference between a mutual and one-way NDA?',
    a: 'A one-way (unilateral) NDA protects confidential information flowing in one direction — from you to the other party. A mutual (bilateral) NDA protects information flowing both ways, which is common in partnerships where both sides share sensitive details. Signova generates both types based on your inputs.',
  },
  {
    q: 'Is an AI-generated NDA legally valid?',
    a: 'Yes. An NDA is legally valid as long as it contains the essential elements: identification of the parties, definition of what is confidential, the obligations of the receiving party, the term of the agreement, and signatures. Signova generates documents that include all required clauses. As with any legal document, you may wish to have a qualified attorney review it before signing for high-stakes situations.',
  },
  {
    q: 'How long does an NDA last?',
    a: 'Most NDAs last between 1 and 5 years, though some — particularly those covering trade secrets — can be indefinite. The appropriate term depends on the nature of the information and your jurisdiction. Signova asks you for the desired term during generation and includes it in your document.',
  },
  {
    q: 'Can I use this NDA in Nigeria or Africa?',
    a: 'Yes. Signova generates NDAs suitable for use across jurisdictions including Nigeria, Ghana, Kenya, South Africa, the UK, Canada, and the US. You specify your country during generation and the document is tailored accordingly. For cross-border agreements, the governing law clause will reflect the jurisdiction you select.',
  },
  {
    q: 'How much does it cost?',
    a: 'Generating a preview of your NDA is completely free — no account required. You only pay $4.99 to download the clean, watermark-free PDF. If you need multiple documents, the unlimited plan is $9.99/month.',
  },
]

export default function NDALanding() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      <Helmet>
        <title>Free NDA Generator — Create a Non-Disclosure Agreement in Minutes | Signova</title>
        <meta
          name="description"
          content="Generate a professional Non-Disclosure Agreement (NDA) in minutes. Free preview, $4.99 to download. One-way or mutual NDAs for any country. No account needed."
        />
        <meta property="og:title" content="Free NDA Generator | Signova" />
        <meta property="og:description" content="Create a legally sound NDA in minutes. Free preview — pay only to download." />
        <link rel="canonical" href="https://www.getsignova.com/nda-generator" />
      </Helmet>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="logo-mark">S</div>
            <span className="logo-text">Signova</span>
          </div>
          <div className="nav-links">
            <a href="/#how-it-works">How it works</a>
            <a href="/#pricing">Pricing</a>
            <a href="/blog">Blog</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="nda-hero">
        <div className="hero-glow" />
        <div className="nda-hero-inner">
          <div className="nda-badge">🤝 NDA Generator</div>
          <h1 className="nda-h1">
            Create a Non-Disclosure<br />Agreement in Minutes
          </h1>
          <p className="nda-sub">
            Answer a few questions. Get a professional, AI-drafted NDA tailored to your situation.
            Free preview — pay $4.99 to download the clean PDF.
          </p>
          <button className="nda-cta" onClick={() => navigate('/generate/nda')}>
            Generate My NDA Free →
          </button>
          <p className="nda-cta-sub">No account required · Takes about 3 minutes</p>

          {/* Trust row */}
          <div className="nda-trust">
            <span>✓ One-way &amp; mutual NDAs</span>
            <span>✓ Any country or jurisdiction</span>
            <span>✓ Instant download</span>
            <span>✓ AI-drafted by Claude</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="nda-section">
        <div className="nda-container">
          <h2 className="nda-section-title">How it works</h2>
          <div className="nda-steps">
            <div className="nda-step">
              <div className="nda-step-num">1</div>
              <h3>Fill in the details</h3>
              <p>Tell us the party names, what information needs protecting, the NDA type, your jurisdiction, and the term length.</p>
            </div>
            <div className="nda-step">
              <div className="nda-step-num">2</div>
              <h3>Preview your NDA</h3>
              <p>Claude generates a complete, tailored NDA instantly. Read through the full document before paying anything.</p>
            </div>
            <div className="nda-step">
              <div className="nda-step-num">3</div>
              <h3>Download the PDF</h3>
              <p>Pay $4.99 to unlock the clean, watermark-free PDF. Print it, sign it, send it — it's yours.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Types of NDA */}
      <section className="nda-section nda-section-alt">
        <div className="nda-container">
          <h2 className="nda-section-title">What type of NDA do you need?</h2>
          <div className="nda-types">
            <div className="nda-type-card" onClick={() => navigate('/generate/nda')}>
              <div className="nda-type-icon">→</div>
              <h3>One-Way NDA</h3>
              <p>You share confidential information with a contractor, employee, or partner. Only they are bound by the agreement.</p>
              <span className="nda-type-cta">Generate →</span>
            </div>
            <div className="nda-type-card" onClick={() => navigate('/generate/nda')}>
              <div className="nda-type-icon">⇄</div>
              <h3>Mutual NDA</h3>
              <p>Both parties share sensitive information with each other. Both are equally bound — common in partnerships and joint ventures.</p>
              <span className="nda-type-cta">Generate →</span>
            </div>
            <div className="nda-type-card" onClick={() => navigate('/generate/nda')}>
              <div className="nda-type-icon">👤</div>
              <h3>Employee NDA</h3>
              <p>Protect proprietary information, client data, and trade secrets when onboarding staff with access to sensitive systems.</p>
              <span className="nda-type-cta">Generate →</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="nda-cta-band">
        <div className="nda-container" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '28px', marginBottom: '12px' }}>Ready to protect your information?</h2>
          <p style={{ color: '#888', marginBottom: '28px' }}>Generate your NDA now — free preview, $4.99 to download.</p>
          <button className="nda-cta" onClick={() => navigate('/generate/nda')}>
            Generate My NDA Free →
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="nda-section">
        <div className="nda-container nda-faq-wrap">
          <h2 className="nda-section-title">Frequently asked questions</h2>
          <div className="nda-faqs">
            {FAQS.map((faq, i) => (
              <div className="nda-faq" key={i}>
                <h3 className="nda-faq-q">{faq.q}</h3>
                <p className="nda-faq-a">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="logo-mark">S</div>
            <span className="logo-text">Signova</span>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} Signova. All rights reserved.</p>
          <div className="footer-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/blog">Blog</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
