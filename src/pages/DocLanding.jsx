import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import './Landing.css'
import './NDALanding.css'

export default function DocLanding() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [config, setConfig] = useState(null)

  // Load doc landing data asynchronously — not in initial bundle
  useEffect(() => {
    let cancelled = false
    import('../data/docLandingData').then(({ DOC_LANDING_DATA }) => {
      if (!cancelled) {
        const found = Object.values(DOC_LANDING_DATA).find(d => d.slug === slug)
        setConfig(found || null)
      }
    })
    return () => { cancelled = true }
  }, [slug])

  // Navigate if slug not found
  useEffect(() => {
    if (config === null) return // still loading
    if (!config) navigate('/')
  }, [config, navigate])

  if (!config) return (
    <div style={{ minHeight: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>Loading...</div>
    </div>
  )

  const {
    docId, icon: _icon, name, headline, subheadline,
    titleTag, metaDesc, badge, whatIs, whenYouNeedIt,
    useCases, faqs,
  } = config

  return (
    <div className="landing">
      <Helmet>
        <title>{titleTag}</title>
        <meta name="description" content={metaDesc} />
        <meta property="og:title" content={titleTag} />
        <meta property="og:description" content={metaDesc} />
        <link rel="canonical" href={`https://www.getsignova.com/${slug}`} />
      </Helmet>

      <SiteNav variant="signova" />

      {/* Hero */}
      <section className="nda-hero">
        <div className="hero-glow" />
        <div className="nda-hero-inner">
          <div className="nda-badge">{badge}</div>
          <h1 className="nda-h1">{headline}</h1>
          <p className="nda-sub">{subheadline}</p>
          <button className="nda-cta" onClick={() => navigate(`/generate/${docId}`)}>
            Generate My {name} Free →
          </button>
          <p className="nda-cta-sub">No account required · Takes just a few minutes</p>
          <div className="nda-trust">
            <span>✓ AI-drafted by Claude</span>
            <span>✓ Any country or jurisdiction</span>
            <span>✓ Free preview</span>
            <span>✓ Instant PDF download</span>
          </div>
        </div>
      </section>

      {/* What is this document */}
      <section className="nda-section">
        <div className="nda-container nda-faq-wrap">
          <h2 className="nda-section-title">What is a {name}?</h2>
          <p style={{ color: 'var(--text2)', fontSize: '16px', lineHeight: '1.8', textAlign: 'center' }}>
            {whatIs}
          </p>
        </div>
      </section>

      {/* When you need it */}
      <section className="nda-section nda-section-alt">
        <div className="nda-container nda-faq-wrap">
          <h2 className="nda-section-title">When do you need one?</h2>
          <p style={{ color: 'var(--text2)', fontSize: '16px', lineHeight: '1.8', textAlign: 'center' }}>
            {whenYouNeedIt}
          </p>
        </div>
      </section>

      {/* Use cases */}
      <section className="nda-section">
        <div className="nda-container">
          <h2 className="nda-section-title">Common uses</h2>
          <div className="nda-types">
            {useCases.map((uc, i) => (
              <div className="nda-type-card" key={i} onClick={() => navigate(`/generate/${docId}`)}>
                <div className="nda-type-icon">{uc.icon}</div>
                <h3>{uc.title}</h3>
                <p>{uc.desc}</p>
                <span className="nda-type-cta">Generate →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="nda-section nda-section-alt">
        <div className="nda-container">
          <h2 className="nda-section-title">How it works</h2>
          <div className="nda-steps">
            <div className="nda-step">
              <div className="nda-step-num">1</div>
              <h3>Fill in the details</h3>
              <p>Answer a few questions about your specific situation — parties, terms, jurisdiction, and any special requirements.</p>
            </div>
            <div className="nda-step">
              <div className="nda-step-num">2</div>
              <h3>Preview your document</h3>
              <p>Claude generates a complete, tailored {name} instantly. Read the full document before paying anything.</p>
            </div>
            <div className="nda-step">
              <div className="nda-step-num">3</div>
              <h3>Download the PDF</h3>
              <p>Pay $4.99 to unlock the clean, watermark-free PDF. Print it, sign it, send it — it's yours to keep.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="nda-cta-band">
        <div className="nda-container" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#fff', fontSize: '28px', marginBottom: '12px' }}>
            Ready to generate your {name}?
          </h2>
          <p style={{ color: '#888', marginBottom: '28px' }}>
            Free preview — pay $4.99 only when you're ready to download.
          </p>
          <button className="nda-cta" onClick={() => navigate(`/generate/${docId}`)}>
            Generate My {name} Free →
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="nda-section">
        <div className="nda-container nda-faq-wrap">
          <h2 className="nda-section-title">Frequently asked questions</h2>
          <div className="nda-faqs">
            {faqs.map((faq, i) => (
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
