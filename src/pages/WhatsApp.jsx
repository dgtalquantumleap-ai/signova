import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { trackWaExtraction, trackWaExtractionSuccess } from '../lib/analytics'
import './WhatsApp.css'

// Geo-aware doc ordering — most relevant first per region
const GEO_DOC_PRIORITY = {
  // West Africa
  NG: ['tenancy-agreement','loan-agreement','freelance-contract','deed-of-assignment','business-partnership','quit-notice','nda','service-agreement'],
  GH: ['tenancy-agreement','loan-agreement','business-partnership','freelance-contract','service-agreement','nda','hire-purchase','mou'],
  // East/South Africa
  KE: ['tenancy-agreement','service-agreement','freelance-contract','loan-agreement','business-partnership','nda','mou','employment-offer-letter'],
  ZA: ['tenancy-agreement','service-agreement','freelance-contract','nda','employment-offer-letter','business-partnership','loan-agreement','non-compete-agreement'],
  // South Asia
  IN: ['service-agreement','freelance-contract','nda','employment-offer-letter','independent-contractor','consulting-agreement','mou','business-proposal'],
  PH: ['service-agreement','freelance-contract','employment-offer-letter','nda','independent-contractor','business-proposal','consulting-agreement','loan-agreement'],
  PK: ['service-agreement','freelance-contract','tenancy-agreement','employment-offer-letter','nda','business-partnership','mou','loan-agreement'],
  // Middle East
  AE: ['service-agreement','nda','consulting-agreement','employment-offer-letter','freelance-contract','mou','business-proposal','distribution-agreement'],
  SA: ['service-agreement','consulting-agreement','nda','employment-offer-letter','business-proposal','mou','joint-venture','distribution-agreement'],
  // North America
  US: ['nda','freelance-contract','independent-contractor','non-compete-agreement','service-agreement','employment-offer-letter','business-proposal','consulting-agreement'],
  CA: ['nda','freelance-contract','independent-contractor','service-agreement','employment-offer-letter','non-compete-agreement','business-proposal','consulting-agreement'],
  // UK & Europe
  GB: ['freelance-contract','nda','service-agreement','employment-offer-letter','independent-contractor','consulting-agreement','business-proposal','tenancy-agreement'],
  // Southeast Asia
  SG: ['service-agreement','nda','freelance-contract','consulting-agreement','employment-offer-letter','mou','distribution-agreement','joint-venture'],
  MY: ['service-agreement','freelance-contract','nda','employment-offer-letter','tenancy-agreement','consulting-agreement','business-proposal','distribution-agreement'],
  // East Asia
  CN: ['mou','joint-venture','distribution-agreement','supply-agreement','service-agreement','nda','consulting-agreement','business-proposal'],
  // Default global
  DEFAULT: ['nda','freelance-contract','service-agreement','tenancy-agreement','employment-offer-letter','consulting-agreement','loan-agreement','business-partnership'],
}

// Geo-aware use cases — global, specific to each region
const GEO_USECASES = {
  NG: [
    { icon: '🏠', title: 'Landlords & tenants', body: 'Rent amount, duration, caution deposit, move-in date — agreed on WhatsApp, turned into a signed tenancy agreement in minutes.' },
    { icon: '💰', title: 'Friends lending money', body: '"Pay back in 3 months" agreed on WhatsApp but never written down. Turn that chat into a loan agreement before money moves.' },
    { icon: '✍️', title: 'Freelancers & clients', body: 'Project scope, payment terms, IP ownership — negotiated over chat, extracted into a professional contract in minutes.' },
    { icon: '🤝', title: 'Business partners', body: 'Profit split, capital contribution — discussed in a WhatsApp group, turned into a partnership agreement before work begins.' },
  ],
  IN: [
    { icon: '✍️', title: 'Freelancers & clients', body: 'Scope, rate, delivery date — negotiated on WhatsApp or email, extracted into a professional service agreement.' },
    { icon: '🤝', title: 'Service providers', body: 'Agreed terms across IT services, consulting, and outsourcing — turned into a clean, signed contract from any chat thread.' },
    { icon: '🏠', title: 'Rental agreements', body: 'Rent, deposit, maintenance — agreed over messaging, generated into a proper tenancy agreement in minutes.' },
    { icon: '💼', title: 'Business proposals', body: 'Terms discussed over email with clients — extracted and formatted into a professional business proposal.' },
  ],
  US: [
    { icon: '🤝', title: 'NDAs & confidentiality', body: 'Agreed to keep something confidential over email or Slack? Extract those terms into a signed NDA.' },
    { icon: '✍️', title: 'Freelancers & contractors', body: 'Rate, scope, IP ownership — negotiated over email or iMessage, turned into an independent contractor agreement.' },
    { icon: '🚫', title: 'Non-compete agreements', body: 'Employment terms discussed over email — extract the agreed restrictions into a compliant non-compete clause.' },
    { icon: '💼', title: 'Consulting agreements', body: 'Scope, exclusivity, payment schedule — agreed over email, generated into a formal consulting contract.' },
  ],
  GB: [
    { icon: '✍️', title: 'Freelancers & contractors', body: 'Rate, deliverables, IP rights — negotiated on email or WhatsApp, extracted into a professional UK-compliant contract.' },
    { icon: '💼', title: 'Consultants', body: 'Engagement terms agreed over email — extracted into a signed consulting agreement ready for both parties.' },
    { icon: '🤝', title: 'NDAs', body: 'Confidentiality discussed in a chat — turn those agreed terms into a proper NDA in minutes.' },
    { icon: '👔', title: 'Employment offers', body: 'Offer terms discussed over email — generate a formal employment offer letter from the agreed conversation.' },
  ],
  DEFAULT: [
    { icon: '✍️', title: 'Freelancers & clients', body: 'Project scope, payment terms, IP ownership — negotiated over any messaging platform, extracted into a professional contract.' },
    { icon: '🤝', title: 'NDAs & confidentiality', body: 'Agreed to keep something confidential in a chat? Extract those terms into a properly signed NDA.' },
    { icon: '🏠', title: 'Rental agreements', body: 'Rent amount, duration, deposit — agreed over messaging, generated into a signed tenancy agreement in minutes.' },
    { icon: '💼', title: 'Business agreements', body: 'Partnership terms, consulting scope, service fees — discussed in any chat thread, turned into a legal document.' },
  ],
}

const ALL_DOCS = [
  { id: 'tenancy-agreement',    label: 'Tenancy Agreement',       icon: '🏠' },
  { id: 'loan-agreement',       label: 'Loan Agreement',           icon: '💰' },
  { id: 'freelance-contract',   label: 'Freelance Contract',       icon: '✍️' },
  { id: 'nda',                  label: 'NDA',                      icon: '🤝' },
  { id: 'service-agreement',    label: 'Service Agreement',        icon: '📝' },
  { id: 'business-partnership', label: 'Business Partnership',     icon: '🤝' },
  { id: 'payment-terms-agreement', label: 'Payment Agreement',     icon: '💳' },
  { id: 'deed-of-assignment',   label: 'Deed of Assignment',       icon: '📜' },
  { id: 'mou',                  label: 'MOU',                      icon: '🗒️' },
  { id: 'independent-contractor', label: 'Contractor Agreement',   icon: '📋' },
  { id: 'consulting-agreement', label: 'Consulting Agreement',     icon: '💼' },
  { id: 'hire-purchase',        label: 'Hire Purchase',            icon: '🚗' },
  { id: 'joint-venture',        label: 'Joint Venture',            icon: '🏗️' },
  { id: 'employment-offer-letter', label: 'Employment Offer',      icon: '👔' },
  { id: 'quit-notice',          label: 'Quit Notice',              icon: '📮' },
  { id: 'supply-agreement',     label: 'Supply Agreement',         icon: '🏭' },
  { id: 'distribution-agreement', label: 'Distribution Agreement', icon: '📦' },
  { id: 'business-proposal',    label: 'Business Proposal',        icon: '🚀' },
  { id: 'shareholder-agreement', label: 'Shareholder Agreement',   icon: '📊' },
  { id: 'power-of-attorney',    label: 'Power of Attorney',        icon: '⚖️' },
  { id: 'letter-of-intent',     label: 'Letter of Intent',         icon: '✉️' },
  { id: 'landlord-agent-agreement', label: 'Landlord & Agent',     icon: '🤝' },
  { id: 'non-compete-agreement', label: 'Non-Compete',             icon: '🚫' },
  { id: 'purchase-agreement',   label: 'Purchase Agreement',       icon: '🛒' },
  { id: 'privacy-policy',       label: 'Privacy Policy',           icon: '🔒' },
  { id: 'terms-of-service',     label: 'Terms of Service',         icon: '📋' },
  { id: 'facility-manager-agreement', label: 'Facility Manager',   icon: '🏢' },
]

// Sample conversations — globally representative
const SAMPLE_CONVOS = {
  'tenancy-agreement': `Landlord: The 2-bed flat at 14 Park Lane is available. Rent is £1,800/month, 12 months minimum.

Tenant: I'm James Okafor. Can we do £1,700?

Landlord: Best I can do is £1,750. I'm Mr. David Walsh. First month plus one month deposit required.

Tenant: Agreed. When can I move in?

Landlord: 1st of next month. No pets, no smoking inside. Utilities in your name.

Tenant: Fine. Let's get a tenancy agreement signed before I transfer anything.`,

  'loan-agreement': `Alex: Hey, I need to borrow $5,000. I can pay back in 6 months.

Jordan: That works. I'm Jordan Lee. No interest but I need it in writing this time.

Alex: Agreed. I'm Alex Chen. Monthly instalments of $833?

Jordan: Yes — $833 per month, starting next month. If you miss a payment, full amount becomes due.

Alex: Fair enough. Let's sign something before you transfer.

Jordan: Correct. I'll send a loan agreement over.`,

  'freelance-contract': `Client: Hi, we need a website built for our law firm. Budget is $4,500 flat.

Dev: Hi, I'm Maya Patel, freelance developer. $4,500 works. 6-week timeline from kickoff.

Client: I'm Sarah Chen from Chen & Associates. What's included?

Dev: Full 5-page site, CMS, contact form, mobile responsive. 2 rounds of revisions.

Client: Payment terms?

Dev: 50% upfront, 50% on launch. IP transfers to you after final payment.

Client: Perfect. Can you send a contract over?`,

  'nda': `Bob: I want to share our new SaaS idea with you before bringing you on as a co-founder.

Alice: Of course. I'm Alice Kim. Happy to sign an NDA first.

Bob: I'm Bob Nguyen. One-way NDA — you're the receiving party. 2-year confidentiality period.

Alice: Governing law?

Bob: Delaware, US. Standard mutual non-solicitation too.

Alice: Fine. Send it over and I'll sign today.`,
}

const FAQS = [
  {
    q: 'Which messaging platforms are supported?',
    a: 'Any platform where you can copy text — WhatsApp, iMessage, Telegram, email, SMS, Slack, Teams, Signal, WeChat, and more. If you can select and copy the conversation, it works.',
  },
  {
    q: 'How do I copy my conversation?',
    a: 'On WhatsApp: long-press a message, tap More, select all relevant messages, then Copy. On iMessage: long-press, tap Copy. On email: select the thread text and copy. Then paste it into the box above.',
  },
  {
    q: 'How accurate is the extraction?',
    a: 'Very accurate for clearly stated terms — names, amounts, dates, durations, restrictions. We only extract what is explicitly stated or strongly implied. We never guess or invent terms.',
  },
  {
    q: 'Is my conversation stored or read by anyone?',
    a: 'No. Your conversation is processed by AI only to extract the terms, then immediately discarded. We do not store, log, or retain your private messages.',
  },
  {
    q: 'Are the documents legally valid in my country?',
    a: 'Signova generates documents for any jurisdiction worldwide. Documents are tailored to the governing law you specify. For high-value transactions, we recommend having a local solicitor review the final document.',
  },
  {
    q: 'What if the extraction misses something?',
    a: 'You review every extracted field before generating. Any field you want to change, add, or remove can be edited directly. The extraction saves time — it does not replace your review.',
  },
  {
    q: 'How much does it cost?',
    a: 'Extracting terms and previewing your document is completely free. You pay $4.99 only when you want to download the clean, watermark-free PDF. One-time payment, no subscription.',
  },
]

// Helper — get priority list for country code
function getOrderedDocs(countryCode) {
  const priority = GEO_DOC_PRIORITY[countryCode] || GEO_DOC_PRIORITY.DEFAULT
  const prioritySet = new Set(priority)
  const rest = ALL_DOCS.filter(d => !prioritySet.has(d.id))
  const ordered = [
    ...priority.map(id => ALL_DOCS.find(d => d.id === id)).filter(Boolean),
    ...rest,
  ]
  return ordered
}

function getUseCases(countryCode) {
  return GEO_USECASES[countryCode] || GEO_USECASES.DEFAULT
}

export default function WhatsApp() {
  const navigate = useNavigate()
  const [conversation, setConversation] = useState('')
  const [docType, setDocType] = useState('nda')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [countryCode, setCountryCode] = useState('DEFAULT')
  const [geoLoaded, setGeoLoaded] = useState(false)

  // Geo detection — reuse session cache from Landing.jsx (key: sig_geo)
  useEffect(() => {
    let mounted = true
    const controller = new AbortController()

    const cached = sessionStorage.getItem('sig_geo')
    if (cached) {
      try {
        const d = JSON.parse(cached)
        const cc = d.countryCode || 'DEFAULT'
        if (cc !== 'DEFAULT') {
          setCountryCode(cc)
          const priority = GEO_DOC_PRIORITY[cc] || GEO_DOC_PRIORITY.DEFAULT
          setDocType(priority[0])
        }
      } catch {}
      setGeoLoaded(true)
      return () => { mounted = false }
    }

    // Use our own API endpoint which leverages Vercel geo headers (free, unlimited)
    fetch('/api/geo', { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (!mounted || !d.country_code) return
        const cc = d.country_code || 'DEFAULT'
        setCountryCode(cc)
        const priority = GEO_DOC_PRIORITY[cc] || GEO_DOC_PRIORITY.DEFAULT
        setDocType(priority[0])
        sessionStorage.setItem('sig_geo', JSON.stringify({
          countryCode: cc,
          currency: { code: d.currency || 'USD', symbol: '$', amount: 4.99 },
        }))
      })
      .catch(() => {})
      .finally(() => { if (mounted) setGeoLoaded(true) })

    return () => {
      mounted = false
      controller.abort()
    }
  }, [])

  const orderedDocs = getOrderedDocs(countryCode)
  const useCases = getUseCases(countryCode)
  const visibleDocs = showAll ? orderedDocs : orderedDocs.slice(0, 8)

  const handleExtract = async () => {
    if (!conversation.trim()) { setError('Please paste your conversation first.'); return }
    setExtracting(true)
    setError('')
    setExtracted(null)
    trackWaExtraction(docType)
    try {
      const res = await fetch('/api/extract-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation, docType }),
      })
      const data = await res.json()
      if (!res.ok || !data.fields) {
        setError(data.error || 'Extraction failed. Please try again.')
        return
      }
      const fieldCount = Object.keys(data.fields || {}).length
      trackWaExtractionSuccess(docType, fieldCount)
      setExtracted(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setExtracting(false)
    }
  }

  const handleGenerate = () => {
    if (!extracted?.fields) return
    sessionStorage.setItem('signova_prefill', JSON.stringify({
      docType,
      fields: extracted.fields,
      fromWhatsApp: true,
    }))
    navigate(`/generate/${docType}`)
  }

  const loadSample = () => {
    const sample = SAMPLE_CONVOS[docType] || SAMPLE_CONVOS['freelance-contract']
    setConversation(sample)
    setExtracted(null)
    setError('')
  }

  const currentDoc = ALL_DOCS.find(d => d.id === docType)

  return (
    <div className="wa-page">
      <Helmet>
        <title>Chat to Legal Document — Turn Any Conversation Into a Contract | Signova</title>
        <meta name="description" content="Paste WhatsApp, iMessage, Telegram or email conversations. Signova extracts agreed terms and generates a legal document in 2 minutes. Free preview." />
        <meta name="keywords" content="whatsapp to contract, chat to legal document, email to contract, imessage to agreement, telegram to legal document, conversation to contract generator, whatsapp agreement generator" />
        <link rel="canonical" href="https://www.getsignova.com/whatsapp" />
        <meta property="og:title" content="Turn Any Conversation Into a Legal Document | Signova" />
        <meta property="og:description" content="Paste your chat. We extract the agreed terms and generate a ready-to-sign legal document in 2 minutes." />
        <meta property="og:url" content="https://www.getsignova.com/whatsapp" />
      </Helmet>

      {/* Nav */}
      <nav className="wa-nav">
        <button className="wa-back" onClick={() => navigate('/')}>← Back</button>
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
        <a href="https://www.getsignova.com" className="wa-nav-cta">All documents →</a>
      </nav>

      {/* Hero */}
      <section className="wa-hero">
        <h1 className="wa-hero-title">
          Turn any conversation<br />into a legal document
        </h1>
        <p className="wa-hero-sub">
          Paste a chat from WhatsApp, iMessage, Telegram, email, or any messaging platform.
          We extract the agreed terms and generate a ready-to-sign document in 2 minutes.
        </p>
        <div className="wa-platforms">
          <span className="wa-platform">WhatsApp</span>
          <span className="wa-platform-dot">·</span>
          <span className="wa-platform">iMessage</span>
          <span className="wa-platform-dot">·</span>
          <span className="wa-platform">Telegram</span>
          <span className="wa-platform-dot">·</span>
          <span className="wa-platform">Email</span>
          <span className="wa-platform-dot">·</span>
          <span className="wa-platform">SMS</span>
          <span className="wa-platform-dot">·</span>
          <span className="wa-platform">Any chat</span>
        </div>
        <div className="wa-stats">
          <div className="wa-stat"><span className="wa-stat-num">27</span><span className="wa-stat-label">document types</span></div>
          <div className="wa-stat-div" />
          <div className="wa-stat"><span className="wa-stat-num">180+</span><span className="wa-stat-label">countries</span></div>
          <div className="wa-stat-div" />
          <div className="wa-stat"><span className="wa-stat-num">$4.99</span><span className="wa-stat-label">to download</span></div>
        </div>
      </section>

      {/* Main tool */}
      <section className="wa-tool">

        {/* Step 1 — doc type */}
        <div className="wa-step">
          <div className="wa-step-label">
            <span className="wa-step-num">1</span>
            What document do you need?
          </div>
          <div className="wa-doc-grid">
            {visibleDocs.map((d, i) => (
              <button
                key={d.id}
                className={`wa-doc-btn ${docType === d.id ? 'selected' : ''}`}
                onClick={() => { setDocType(d.id); setExtracted(null); setError('') }}
              >
                <span className="wa-doc-icon">{d.icon}</span>
                <span className="wa-doc-label">{d.label}</span>
                {i < 4 && <span className="wa-popular">Popular</span>}
              </button>
            ))}
          </div>
          <button className="wa-show-all" onClick={() => setShowAll(v => !v)}>
            {showAll ? '↑ Show fewer' : '+ Show all 27 document types'}
          </button>
        </div>

        {/* Step 2 — paste conversation */}
        <div className="wa-step">
          <div className="wa-step-label">
            <span className="wa-step-num">2</span>
            Paste your conversation
          </div>
          <p className="wa-step-hint">
            Copy directly from WhatsApp, iMessage, Telegram, email, or any messaging app and paste it below.
          </p>
          <div className="wa-textarea-wrap">
            <textarea
              className="wa-textarea"
              placeholder={`Paste your conversation here — WhatsApp, iMessage, Telegram, email, SMS, or any messaging platform.\n\nExample:\nParty A: The rate is $2,000 flat fee, delivered in 3 weeks.\nParty B: Agreed. 50% upfront, 50% on delivery?\nParty A: Yes. I'll send a contract.`}
              value={conversation}
              onChange={e => { setConversation(e.target.value); setExtracted(null); setError('') }}
              rows={10}
            />
            <button className="wa-sample-btn" onClick={loadSample}>
              Load sample →
            </button>
          </div>
          {error && <div className="wa-error">{error}</div>}
        </div>

        {/* Extract button */}
        {!extracted && (
          <button
            className="wa-extract-btn"
            onClick={handleExtract}
            disabled={extracting || !conversation.trim()}
          >
            {extracting
              ? <><span className="wa-spinner" /> Extracting terms…</>
              : <>Extract terms & generate {currentDoc?.label || 'document'} →</>
            }
          </button>
        )}

        {/* Extracted results */}
        {extracted && (
          <div className="wa-extracted">
            <div className="wa-extracted-header">
              <span className="wa-extracted-check">✓</span>
              <span className="wa-extracted-msg">{extracted.message}</span>
            </div>
            <div className="wa-extracted-fields">
              {Object.entries(extracted.fields).map(([key, val]) => (
                <div key={key} className="wa-field-row">
                  <span className="wa-field-key">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                  <span className="wa-field-val">
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </span>
                </div>
              ))}
            </div>
            <p className="wa-extracted-note">
              Review the terms above. You can edit any field in the next step before generating your document.
            </p>
            <div className="wa-extracted-actions">
              <button className="wa-generate-btn" onClick={handleGenerate}>
                Continue to {currentDoc?.label || 'document'} →
              </button>
              <button className="wa-redo-btn" onClick={() => setExtracted(null)}>
                ← Edit conversation
              </button>
            </div>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="wa-how">
        <h2 className="wa-section-title">How it works</h2>
        <div className="wa-steps-row">
          <div className="wa-how-step">
            <div className="wa-how-num">01</div>
            <div className="wa-how-title">Copy your conversation</div>
            <div className="wa-how-body">Select the messages where you agreed the terms — from WhatsApp, iMessage, Telegram, email, or SMS. Copy and paste the text above.</div>
          </div>
          <div className="wa-how-arrow">→</div>
          <div className="wa-how-step">
            <div className="wa-how-num">02</div>
            <div className="wa-how-title">AI extracts the terms</div>
            <div className="wa-how-body">The AI reads your conversation and identifies the key details — party names, amounts, dates, durations, and restrictions — and fills the document fields.</div>
          </div>
          <div className="wa-how-arrow">→</div>
          <div className="wa-how-step">
            <div className="wa-how-num">03</div>
            <div className="wa-how-title">Review and generate</div>
            <div className="wa-how-body">Check the extracted fields, adjust anything that needs changing, then generate your complete legal document. Free preview. $4.99 to download the clean PDF.</div>
          </div>
        </div>
      </section>

      {/* Use cases — geo-aware */}
      <section className="wa-usecases">
        <h2 className="wa-section-title">Common use cases</h2>
        <div className="wa-cases-grid">
          {useCases.map((c, i) => (
            <div key={i} className="wa-case">
              <div className="wa-case-icon">{c.icon}</div>
              <div className="wa-case-title">{c.title}</div>
              <div className="wa-case-body">{c.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform guide */}
      <section className="wa-platform-guide">
        <h2 className="wa-section-title">How to copy from any platform</h2>
        <div className="wa-guide-grid">
          <div className="wa-guide-item">
            <div className="wa-guide-title">WhatsApp</div>
            <div className="wa-guide-body">Long-press a message → More → select messages → Copy. Or export the chat via Settings → Chat → Export Chat, then paste the text.</div>
          </div>
          <div className="wa-guide-item">
            <div className="wa-guide-title">iMessage</div>
            <div className="wa-guide-body">Long-press a message → Copy. On Mac, select all relevant messages, right-click → Copy. Paste directly into the box above.</div>
          </div>
          <div className="wa-guide-item">
            <div className="wa-guide-title">Telegram</div>
            <div className="wa-guide-body">Long-press a message → Copy Text. Select multiple messages → Forward → Saved Messages, then copy from there.</div>
          </div>
          <div className="wa-guide-item">
            <div className="wa-guide-title">Email</div>
            <div className="wa-guide-body">Select the email thread text, copy, and paste. Include both sides of the exchange for best extraction results.</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="wa-faq">
        <h2 className="wa-section-title">Frequently asked questions</h2>
        <div className="wa-faq-list">
          {FAQS.map((faq, i) => (
            <div key={i} className={`wa-faq-item ${openFaq === i ? 'open' : ''}`}>
              <button className="wa-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                {faq.q}
                <span className="wa-faq-chevron">{openFaq === i ? '−' : '+'}</span>
              </button>
              {openFaq === i && <div className="wa-faq-a">{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="wa-bottom-cta">
        <h2 className="wa-bottom-title">Your agreement is only as strong as the document behind it</h2>
        <p className="wa-bottom-sub">A chat message is not a contract. A signed document is. Generate yours in 2 minutes.</p>
        <button className="wa-bottom-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Paste your conversation →
        </button>
        <p className="wa-bottom-note">Free preview · $4.99 to download · No account needed · Any jurisdiction</p>
      </section>

      {/* Footer */}
      <footer className="wa-footer">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
        <p className="wa-footer-note">
          Signova · Ebenova Solutions · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>
        </p>
      </footer>
    </div>
  )
}
