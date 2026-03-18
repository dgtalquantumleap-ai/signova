import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import './WhatsApp.css'

const DOC_OPTIONS = [
  { id: 'tenancy-agreement',    label: 'Tenancy Agreement',       icon: '🏠', popular: true },
  { id: 'loan-agreement',       label: 'Loan Agreement',           icon: '💰', popular: true },
  { id: 'freelance-contract',   label: 'Freelance Contract',       icon: '✍️', popular: true },
  { id: 'nda',                  label: 'NDA',                      icon: '🤝', popular: true },
  { id: 'service-agreement',    label: 'Service Agreement',        icon: '📝', popular: false },
  { id: 'business-partnership', label: 'Business Partnership',     icon: '🤝', popular: false },
  { id: 'payment-terms-agreement', label: 'Payment Agreement',     icon: '💳', popular: false },
  { id: 'deed-of-assignment',   label: 'Deed of Assignment',       icon: '📜', popular: false },
  { id: 'mou',                  label: 'MOU',                      icon: '🗒️', popular: false },
  { id: 'independent-contractor', label: 'Contractor Agreement',   icon: '📋', popular: false },
  { id: 'consulting-agreement', label: 'Consulting Agreement',     icon: '💼', popular: false },
  { id: 'hire-purchase',        label: 'Hire Purchase',            icon: '🚗', popular: false },
  { id: 'joint-venture',        label: 'Joint Venture',            icon: '🏗️', popular: false },
  { id: 'employment-offer-letter', label: 'Employment Offer',      icon: '👔', popular: false },
  { id: 'quit-notice',          label: 'Quit Notice',              icon: '📮', popular: false },
  { id: 'supply-agreement',     label: 'Supply Agreement',         icon: '🏭', popular: false },
  { id: 'distribution-agreement', label: 'Distribution Agreement', icon: '📦', popular: false },
  { id: 'business-proposal',    label: 'Business Proposal',        icon: '🚀', popular: false },
  { id: 'shareholder-agreement', label: 'Shareholder Agreement',   icon: '📊', popular: false },
  { id: 'power-of-attorney',    label: 'Power of Attorney',        icon: '⚖️', popular: false },
  { id: 'letter-of-intent',     label: 'Letter of Intent',         icon: '✉️', popular: false },
  { id: 'landlord-agent-agreement', label: 'Landlord & Agent',     icon: '🤝', popular: false },
  { id: 'non-compete-agreement', label: 'Non-Compete',             icon: '🚫', popular: false },
  { id: 'purchase-agreement',   label: 'Purchase Agreement',       icon: '🛒', popular: false },
  { id: 'privacy-policy',       label: 'Privacy Policy',           icon: '🔒', popular: false },
  { id: 'terms-of-service',     label: 'Terms of Service',         icon: '📋', popular: false },
  { id: 'facility-manager-agreement', label: 'Facility Manager',   icon: '🏢', popular: false },
]

const SAMPLE_CONVOS = {
  'tenancy-agreement': `Chief Emeka: The flat at 14 Admiralty Way Lekki Phase 1 is available. 2 bedroom. Rent is 1.2m naira per year.

Amaka: Okay I'm interested. My name is Amaka Nwosu. Can we do 1.1m?

Chief Emeka: Final price is 1.2m. I'm Chief Emeka Okafor. Take it or leave it.

Amaka: Okay fine. I'll take it. When can I move in?

Chief Emeka: 1st April. I need 6 months caution deposit — 600k. Rent paid annually.

Amaka: Agreed. No pets right?

Chief Emeka: Correct. No pets, no subletting. 1 year tenancy. We sign agreement before you move in.`,

  'loan-agreement': `Tunde: Bro I need 500k urgently. Business matter. I go pay back in 3 months.

Emeka: 500k? That's a lot. What's the interest?

Tunde: No interest, just the principal. I'm Tunde Adeyemi. You know me now.

Emeka: Okay fine. I'm Emeka Osei. But we need to put it in writing this time. No go be like last time.

Tunde: Agreed. 500k, 3 months, no interest. I'll sign whatever you bring.

Emeka: Good. I'll send the money to your GTBank account once we sign. No collateral but I trust you.

Tunde: Thank you bro. God bless you.`,

  'freelance-contract': `Sarah: Hi, I'm Sarah Mitchell from Apex Digital. We need a logo and brand kit designed for our startup.

Jide: Great! I'm Jide Okafor, freelance designer. My rate for a full brand identity is $1,500 flat fee.

Sarah: Works for us. What's included?

Jide: Logo (3 concepts, 2 revision rounds), color palette, typography, and brand guidelines PDF.

Sarah: Perfect. When can you deliver?

Jide: 3 weeks from kickoff. 50% upfront, 50% on final delivery. All files handed over after final payment.

Sarah: Agreed. You retain no rights after payment right?

Jide: Correct — full IP transfer to Apex Digital once paid. Shall I send the contract?`,

  'nda': `David: Hey, I want to share our new fintech idea with you before we bring you on as an advisor.

Priya: Of course. I'm Priya Sharma, happy to sign an NDA first.

David: I'm David Mensah. We're not ready to disclose yet — just need you to keep it confidential while we discuss.

Priya: Understood. Mutual or one-way?

David: One-way — you're the receiving party. Information stays confidential for 2 years.

Priya: Fine. Governing law?

David: Nigeria. We're incorporated in Lagos.

Priya: Send it over and I'll sign today.`,
}

const FAQS = [
  {
    q: 'What kind of conversations can I paste?',
    a: 'WhatsApp chats, SMS threads, email exchanges, Telegram messages — anything where terms were agreed in writing. You can copy-paste directly from your phone or computer.',
  },
  {
    q: 'How accurate is the extraction?',
    a: 'Very accurate for clearly stated terms like names, amounts, dates, and restrictions. We only extract what is clearly stated — we never guess or invent terms.',
  },
  {
    q: 'Is my conversation stored?',
    a: 'No. Your conversation is sent to our AI only to extract the terms, then immediately discarded. We do not store, log, or read your private messages.',
  },
  {
    q: 'Are these documents legally valid in Nigeria?',
    a: 'Yes. Signova documents are drafted to comply with Nigerian law — including the Lagos State Tenancy Law 2011, Labour Act Cap L1 LFN 2004, and general contract law. For property transactions, you still need to stamp the document at the Stamp Duties Office.',
  },
  {
    q: 'What if the extraction misses something?',
    a: 'You review every extracted field before generating. Any field you want to change, you just edit directly. The form is fully editable — the extraction just saves you time filling it.',
  },
  {
    q: 'How much does it cost?',
    a: 'Extracting terms and previewing your document is completely free. You pay $4.99 (or ₦7,400) only when you want to download the clean, watermark-free PDF.',
  },
]

export default function WhatsApp() {
  const navigate = useNavigate()
  const [conversation, setConversation] = useState('')
  const [docType, setDocType] = useState('tenancy-agreement')
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [error, setError] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)

  const visibleDocs = showAll ? DOC_OPTIONS : DOC_OPTIONS.filter(d => d.popular)

  const handleExtract = async () => {
    if (!conversation.trim()) { setError('Please paste your conversation first.'); return }
    setExtracting(true)
    setError('')
    setExtracted(null)
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
      setExtracted(data)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setExtracting(false)
    }
  }

  const handleGenerate = () => {
    if (!extracted?.fields) return
    const config = DOC_OPTIONS.find(d => d.id === docType)
    sessionStorage.setItem('signova_prefill', JSON.stringify({
      docType,
      fields: extracted.fields,
      fromWhatsApp: true,
    }))
    navigate(`/generate/${docType}`)
  }

  const loadSample = () => {
    const sample = SAMPLE_CONVOS[docType] || SAMPLE_CONVOS['tenancy-agreement']
    setConversation(sample)
    setExtracted(null)
    setError('')
  }

  return (
    <div className="wa-page">
      <Helmet>
        <title>WhatsApp to Legal Document — Turn Your Chat Into a Contract | Signova</title>
        <meta name="description" content="Paste your WhatsApp negotiation and Signova extracts the agreed terms — names, amounts, dates — and generates a ready-to-sign legal document in 2 minutes. Free preview. Works for Nigeria, Africa and globally." />
        <meta name="keywords" content="whatsapp to contract nigeria, whatsapp agreement generator, convert whatsapp chat to legal document, tenancy agreement from whatsapp nigeria, loan agreement whatsapp nigeria, whatsapp negotiation legal document" />
        <link rel="canonical" href="https://www.getsignova.com/whatsapp" />
        <meta property="og:title" content="Turn Your WhatsApp Negotiation Into a Legal Document | Signova" />
        <meta property="og:description" content="Paste your WhatsApp chat. We extract the agreed terms and generate a ready-to-sign legal document in 2 minutes." />
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
        <div className="wa-hero-badge">💬 WhatsApp → Legal Document</div>
        <h1 className="wa-hero-title">
          Turn your WhatsApp negotiation<br />
          into a legal document
        </h1>
        <p className="wa-hero-sub">
          Paste your chat. We extract the agreed terms — names, amounts, dates, restrictions — and generate
          a ready-to-sign document in 2 minutes. Free preview. $4.99 to download.
        </p>
        <div className="wa-stats">
          <div className="wa-stat"><span className="wa-stat-num">27</span><span className="wa-stat-label">document types</span></div>
          <div className="wa-stat-div" />
          <div className="wa-stat"><span className="wa-stat-num">180+</span><span className="wa-stat-label">countries supported</span></div>
          <div className="wa-stat-div" />
          <div className="wa-stat"><span className="wa-stat-num">2 min</span><span className="wa-stat-label">average time</span></div>
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
            {visibleDocs.map(d => (
              <button
                key={d.id}
                className={`wa-doc-btn ${docType === d.id ? 'selected' : ''}`}
                onClick={() => { setDocType(d.id); setExtracted(null); setError('') }}
              >
                <span className="wa-doc-icon">{d.icon}</span>
                <span className="wa-doc-label">{d.label}</span>
                {d.popular && <span className="wa-popular">Popular</span>}
              </button>
            ))}
          </div>
          <button className="wa-show-all" onClick={() => setShowAll(v => !v)}>
            {showAll ? '↑ Show fewer document types' : `+ Show all 27 document types`}
          </button>
        </div>

        {/* Step 2 — paste conversation */}
        <div className="wa-step">
          <div className="wa-step-label">
            <span className="wa-step-num">2</span>
            Paste your conversation
          </div>
          <div className="wa-textarea-wrap">
            <textarea
              className="wa-textarea"
              placeholder="Paste your WhatsApp chat, email thread, or SMS exchange here…&#10;&#10;Example:&#10;Landlord: Rent is ₦1.2m per year, 1 year tenancy.&#10;Tenant: Agreed. I'm Amaka Nwosu. When do I move in?&#10;Landlord: 1st April. 6 months caution deposit."
              value={conversation}
              onChange={e => { setConversation(e.target.value); setExtracted(null); setError('') }}
              rows={10}
            />
            <button className="wa-sample-btn" onClick={loadSample}>
              Load sample conversation →
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
              : <>⚡ Extract terms & auto-fill document →</>
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
              Review the extracted terms above. Click Generate to continue — you can edit any field in the next step before generating your document.
            </p>
            <div className="wa-extracted-actions">
              <button className="wa-generate-btn" onClick={handleGenerate}>
                Generate {DOC_OPTIONS.find(d => d.id === docType)?.label} →
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
            <div className="wa-how-title">Copy your chat</div>
            <div className="wa-how-body">Select your WhatsApp, SMS, or email conversation where you agreed the terms. Copy and paste it into the box above.</div>
          </div>
          <div className="wa-how-arrow">→</div>
          <div className="wa-how-step">
            <div className="wa-how-num">02</div>
            <div className="wa-how-title">AI extracts the terms</div>
            <div className="wa-how-body">Our AI reads your conversation and pulls out the key details — names, amounts, dates, restrictions — and fills the document form automatically.</div>
          </div>
          <div className="wa-how-arrow">→</div>
          <div className="wa-how-step">
            <div className="wa-how-num">03</div>
            <div className="wa-how-title">Review and generate</div>
            <div className="wa-how-body">Check the extracted fields, make any adjustments, then generate your complete legal document. Free preview. $4.99 to download the clean PDF.</div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="wa-usecases">
        <h2 className="wa-section-title">Built for how Nigerians actually negotiate</h2>
        <div className="wa-cases-grid">
          <div className="wa-case">
            <div className="wa-case-icon">🏠</div>
            <div className="wa-case-title">Landlords & tenants</div>
            <div className="wa-case-body">Rent amount, duration, caution deposit, move-in date, restrictions — agreed on WhatsApp, turned into a proper tenancy agreement in 2 minutes.</div>
          </div>
          <div className="wa-case">
            <div className="wa-case-icon">💰</div>
            <div className="wa-case-title">Friends lending money</div>
            <div className="wa-case-body">"I'll pay back in 3 months" — agreed on WhatsApp but never written down. Turn that chat into a loan agreement both parties sign before the money moves.</div>
          </div>
          <div className="wa-case">
            <div className="wa-case-icon">✍️</div>
            <div className="wa-case-title">Freelancers & clients</div>
            <div className="wa-case-body">Project scope, payment terms, delivery date, IP ownership — negotiated over email, extracted into a professional freelance contract in minutes.</div>
          </div>
          <div className="wa-case">
            <div className="wa-case-icon">🤝</div>
            <div className="wa-case-title">Business partners</div>
            <div className="wa-case-body">Profit split, capital contribution, decision-making — discussed in a WhatsApp group, turned into a business partnership agreement before you start.</div>
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
        <h2 className="wa-bottom-title">Stop relying on "we agreed on WhatsApp"</h2>
        <p className="wa-bottom-sub">That argument never wins in court. A signed document does. Generate yours in 2 minutes.</p>
        <button className="wa-bottom-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          Paste your conversation now →
        </button>
        <p className="wa-bottom-note">Free preview · $4.99 to download · No account needed</p>
      </section>

      {/* Footer */}
      <footer className="wa-footer">
        <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
        <p className="wa-footer-note">
          Signova is a product of Ebenova Solutions · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </p>
      </footer>
    </div>
  )
}
