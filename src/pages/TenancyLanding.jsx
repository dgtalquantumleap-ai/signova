import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { House, Buildings, Handshake, DeviceMobile } from '@phosphor-icons/react'
import SiteFooter from '../components/SiteFooter'
import './Landing.css'
import './NDALanding.css'
import './TenancyLanding.css'

const TL_ICON = { size: 28, weight: 'duotone', color: 'currentColor' }

const FAQS = [
  {
    q: 'Is a tenancy agreement legally binding in Nigeria?',
    a: 'Yes. A tenancy agreement is legally binding in Nigeria once signed by both landlord and tenant. It is enforceable under the Lagos State Tenancy Law 2011, the Tenancy Law of other states, and relevant common law principles. The agreement should be witnessed and, for tenancies above 3 years, registered at the land registry.',
  },
  {
    q: 'What should a tenancy agreement include?',
    a: 'A valid tenancy agreement should include: full names and addresses of landlord and tenant, the property address, the rent amount and payment schedule, the tenancy duration and start date, the caution/security deposit amount, permitted use of the property, restrictions (subletting, pets, alterations), utilities responsibility, and the conditions for termination and renewal.',
  },
  {
    q: 'What is a caution deposit and how much should it be?',
    a: 'A caution deposit (also called a security deposit) is money held by the landlord to cover unpaid rent or damages beyond normal wear and tear. In Nigeria, it is typically 6 months to 1 year\'s rent. The deposit must be refunded at the end of the tenancy if there are no deductions, and any deductions must be itemised.',
  },
  {
    q: 'Can I use this agreement in Ghana, Kenya, or the UK?',
    a: 'Yes. When generating your tenancy agreement, you select your governing law — Nigeria, Ghana, Kenya, South Africa, or the UK. The document is tailored to the relevant legal framework for your jurisdiction. For UK tenancies, the agreement reflects the Housing Act 1988 and relevant regulations.',
  },
  {
    q: 'How long does it take to generate the agreement?',
    a: 'The form takes about 3 minutes to complete. Once you submit, your tenancy agreement is generated instantly — you can preview the full document before paying anything.',
  },
  {
    q: 'Is a verbal tenancy agreement enforceable?',
    a: 'Verbal agreements are generally difficult to enforce because there is no written record of the terms. Courts will typically look for evidence of what was agreed — which is why a written, signed tenancy agreement is essential for both landlord and tenant.',
  },
  {
    q: 'How much does it cost?',
    a: 'Previewing your tenancy agreement is completely free — no account or credit card required. You only pay $4.99 (or ₦7,400) once to download the clean, watermark-free PDF.',
  },
]

const USE_CASES = [
  {
    icon: <House {...TL_ICON} />,
    title: 'Residential rentals',
    body: 'Flats, duplexes, bungalows, and self-contained apartments. Protects both landlord and tenant on everything from rent to notice periods.',
  },
  {
    icon: <Buildings {...TL_ICON} />,
    title: 'Commercial properties',
    body: 'Office space, shops, warehouses, and event venues. Covers business use restrictions, alterations, and sub-letting clauses.',
  },
  {
    icon: <Handshake {...TL_ICON} />,
    title: 'Agent-managed lettings',
    body: 'Estate agents generating agreements on behalf of landlord clients. Professional-grade document in minutes, not days.',
  },
  {
    icon: <DeviceMobile {...TL_ICON} />,
    title: 'WhatsApp negotiations',
    body: 'Already agreed rent and terms over WhatsApp? Paste the conversation and we auto-fill the form — faster than typing it manually.',
  },
]

export default function TenancyLanding() {
  const navigate = useNavigate()

  return (
    <div className="landing">
      <Helmet>
        <title>Tenancy Agreement Template Nigeria | Free Generator — Signova</title>
        <meta
          name="description"
          content="Generate a professional tenancy agreement for Nigeria, Ghana, Kenya or the UK in minutes. Covers rent, caution deposit, duration, restrictions. Free preview, $4.99 to download. No account needed."
        />
        <meta name="keywords" content="tenancy agreement Nigeria, tenancy agreement template, tenancy agreement Lagos, rental agreement Nigeria, tenancy agreement Ghana, tenancy agreement Kenya, landlord tenant agreement Nigeria, tenancy agreement generator" />
        <meta property="og:title" content="Tenancy Agreement Generator Nigeria | Signova" />
        <meta property="og:description" content="Professional tenancy agreement in minutes. Free preview — pay $4.99 to download." />
        <meta property="og:image" content="https://www.getsignova.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tenancy Agreement Generator Nigeria | Signova" />
        <meta name="twitter:description" content="Professional tenancy agreement in minutes. Free preview — pay $4.99 to download." />
        <meta name="twitter:image" content="https://www.getsignova.com/og-image.png" />
        <link rel="canonical" href="https://www.getsignova.com/tenancy-agreement-nigeria" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": FAQS.map(f => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        })}</script>
      </Helmet>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="logo-mark">S</div>
            <span className="logo-text">Signova</span>
          </div>
          <div className="nav-links">
            <a href="/#how">How it works</a>
            <a href="/#documents">Documents</a>
            <a href="/blog">Blog</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="nda-hero">
        <div className="hero-glow" />
        <div className="nda-hero-inner">
          <div className="nda-badge"><House size={16} weight="duotone" style={{ verticalAlign: '-3px', marginRight: 6 }} />Tenancy Agreement Generator</div>
          <h1 className="nda-h1">
            Tenancy Agreement —<br />Ready in 3 Minutes
          </h1>
          <p className="nda-sub">
            Generate a professional, legally sound tenancy agreement for Nigeria, Ghana, Kenya or the UK.
            Answer a few questions, preview the full document free, download for $4.99.
          </p>
          <button className="nda-cta" onClick={() => navigate('/generate/tenancy-agreement')}>
            Generate My Tenancy Agreement →
          </button>
          <p className="nda-cta-sub">No account required · Free preview · ₦7,400 or $4.99 to download</p>
          <div className="nda-trust">
            <span>✓ Nigeria, Ghana, Kenya & UK</span>
            <span>✓ Covers rent, deposit & restrictions</span>
            <span>✓ Instant PDF download</span>
            <span>✓ WhatsApp auto-fill</span>
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="nda-section">
        <div className="nda-container">
          <h2 className="nda-section-title">What your tenancy agreement covers</h2>
          <div className="tenancy-clauses">
            {[
              { label: 'Parties', desc: 'Full legal names and addresses of landlord and tenant' },
              { label: 'Property', desc: 'Complete property address and description of the premises' },
              { label: 'Rent & payment', desc: 'Annual rent amount, payment schedule (monthly/quarterly/annually), and payment method' },
              { label: 'Caution deposit', desc: 'Security deposit amount, conditions for deduction, and refund terms' },
              { label: 'Duration', desc: 'Tenancy start date, end date, and renewal conditions' },
              { label: 'Restrictions', desc: 'No subletting, no pets, no structural alterations — whatever you specify' },
              { label: 'Utilities', desc: 'Clear assignment of who pays electricity, water, service charge, and PHCN bills' },
              { label: 'Termination', desc: 'Notice period required by either party and conditions for early termination' },
              { label: 'Breach & remedies', desc: 'Consequences of non-payment, damage, or violation of terms' },
              { label: 'Signature block', desc: 'Dated signature lines for landlord, tenant, and witness' },
            ].map(c => (
              <div className="tenancy-clause" key={c.label}>
                <span className="tenancy-clause-check">✓</span>
                <div>
                  <strong className="tenancy-clause-label">{c.label}</strong>
                  <span className="tenancy-clause-desc"> — {c.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="nda-section nda-section-alt">
        <div className="nda-container">
          <h2 className="nda-section-title">Who uses this?</h2>
          <div className="nda-types">
            {USE_CASES.map(u => (
              <div className="nda-type-card" key={u.title} onClick={() => navigate('/generate/tenancy-agreement')}>
                <div className="nda-type-icon">{u.icon}</div>
                <h3>{u.title}</h3>
                <p>{u.body}</p>
                <span className="nda-type-cta">Generate →</span>
              </div>
            ))}
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
              <p>Enter landlord and tenant names, property address, rent, deposit, duration, and any restrictions. Takes about 3 minutes.</p>
            </div>
            <div className="nda-step">
              <div className="nda-step-num">2</div>
              <h3>Preview instantly</h3>
              <p>Your full tenancy agreement is generated immediately — review every clause before paying anything.</p>
            </div>
            <div className="nda-step">
              <div className="nda-step-num">3</div>
              <h3>Download the PDF</h3>
              <p>Pay $4.99 (₦7,400) once to download the clean, watermark-free PDF. Print and sign — done.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="nda-cta-band">
        <div className="nda-container" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '28px', marginBottom: '12px' }}>
            Protect yourself before the tenant moves in
          </h2>
          <p style={{ color: '#888', marginBottom: '28px' }}>
            Generate your tenancy agreement now — free preview, $4.99 to download.
          </p>
          <button className="nda-cta" onClick={() => navigate('/generate/tenancy-agreement')}>
            Generate My Tenancy Agreement →
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

      <SiteFooter variant="signova" />
    </div>
  )
}
