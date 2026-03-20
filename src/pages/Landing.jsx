import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo, useRef, startTransition } from 'react'
import { Helmet } from 'react-helmet-async'
import { trackDocSelected } from '../lib/analytics'
import './Landing.css'

// ── Geo-currency detection ──────────────────────────────────────────────────
// Maps country code → { symbol, amount, code, local }
// 'amount' is the $4.99 USD equivalent in local currency (rounded for readability)
// 'local' is a human-friendly display string shown below the USD price
const CURRENCY_MAP = {
  // West Africa
  NG: { symbol: '₦', amount: 7400,   code: 'NGN', local: '≈ ₦7,400'       },
  GH: { symbol: 'GH₵', amount: 75,   code: 'GHS', local: '≈ GH₵75'        },
  SN: { symbol: 'CFA', amount: 3100, code: 'XOF', local: '≈ CFA 3,100'    },
  CI: { symbol: 'CFA', amount: 3100, code: 'XOF', local: '≈ CFA 3,100'    },
  CM: { symbol: 'CFA', amount: 3100, code: 'XAF', local: '≈ CFA 3,100'    },
  // East Africa
  KE: { symbol: 'KSh', amount: 650,  code: 'KES', local: '≈ KSh 650'      },
  TZ: { symbol: 'TSh', amount: 13200,code: 'TZS', local: '≈ TSh 13,200'   },
  UG: { symbol: 'USh', amount: 18500,code: 'UGX', local: '≈ USh 18,500'   },
  ET: { symbol: 'Br',  amount: 290,  code: 'ETB', local: '≈ Br 290'       },
  // Southern Africa
  ZA: { symbol: 'R',   amount: 93,   code: 'ZAR', local: '≈ R93'          },
  ZW: { symbol: 'USD', amount: 4.99, code: 'USD', local: null              },
  // North Africa / Middle East
  EG: { symbol: 'E£',  amount: 248,  code: 'EGP', local: '≈ E£248'        },
  AE: { symbol: 'د.إ', amount: 18,   code: 'AED', local: '≈ AED 18'       },
  SA: { symbol: '﷼',   amount: 19,   code: 'SAR', local: '≈ SAR 19'       },
  // South Asia
  IN: { symbol: '₹',   amount: 418,  code: 'INR', local: '≈ ₹418'         },
  PK: { symbol: '₨',   amount: 1390, code: 'PKR', local: '≈ Rs 1,390'     },
  BD: { symbol: '৳',   amount: 550,  code: 'BDT', local: '≈ ৳550'         },
  // Southeast Asia
  PH: { symbol: '₱',   amount: 288,  code: 'PHP', local: '≈ ₱288'         },
  ID: { symbol: 'Rp',  amount: 80000,code: 'IDR', local: '≈ Rp 80,000'    },
  MY: { symbol: 'RM',  amount: 23,   code: 'MYR', local: '≈ RM 23'        },
  SG: { symbol: 'S$',  amount: 6.70, code: 'SGD', local: '≈ S$6.70'       },
  // Latin America
  BR: { symbol: 'R$',  amount: 29,   code: 'BRL', local: '≈ R$29'         },
  MX: { symbol: '$',   amount: 103,  code: 'MXN', local: '≈ MX$103'       },
  CO: { symbol: '$',   amount: 20000,code: 'COP', local: '≈ COP 20,000'   },
  AR: { symbol: '$',   amount: 5000, code: 'ARS', local: '≈ AR$5,000'     },
  // Europe
  GB: { symbol: '£',   amount: 3.95, code: 'GBP', local: '≈ £3.95'        },
  // EU countries — same EUR entry
  DE: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  FR: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  IT: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  ES: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  NL: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  PT: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  // North America
  CA: { symbol: 'CA$', amount: 6.85, code: 'CAD', local: '≈ CA$6.85'      },
  AU: { symbol: 'A$',  amount: 7.80, code: 'AUD', local: '≈ A$7.80'       },
  NZ: { symbol: 'NZ$', amount: 8.50, code: 'NZD', local: '≈ NZ$8.50'      },
}
const DEFAULT_CURRENCY = { symbol: '$', amount: 4.99, code: 'USD', local: null }

function useGeo() {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [countryCode, setCountryCode] = useState(null)
  useEffect(() => {
    const cached = sessionStorage.getItem('sig_geo')
    if (cached) {
      const parsed = JSON.parse(cached)
      setCurrency(parsed.currency)
      setCountryCode(parsed.countryCode)
      return
    }
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        const c = CURRENCY_MAP[data.country_code] || DEFAULT_CURRENCY
        const cc = data.country_code || null
        sessionStorage.setItem('sig_geo', JSON.stringify({ currency: c, countryCode: cc }))
        setCurrency(c)
        setCountryCode(cc)
      })
      .catch(() => {})
  }, [])
  return { currency, countryCode }
}

// ── Geo-prioritised quick-pick documents ────────────────────────────────────
const QUICKPICK_DEFAULT = [
  { id: 'nda', icon: '🤝', name: 'NDA' },
  { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
  { id: 'privacy-policy', icon: '🔒', name: 'Privacy Policy' },
  { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
  { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
  { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
  { id: 'tenancy-agreement', icon: '🏠', name: 'Tenancy Agreement' },
  { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
]
const QUICKPICK_REGIONS = {
  NG: [
    { id: 'tenancy-agreement', icon: '🏠', name: 'Tenancy Agreement' },
    { id: 'deed-of-assignment', icon: '📜', name: 'Deed of Assignment' },
    { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
    { id: 'quit-notice', icon: '💮', name: 'Quit Notice' },
    { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
    { id: 'hire-purchase', icon: '🚗', name: 'Hire Purchase' },
    { id: 'power-of-attorney', icon: '⚖️', name: 'Power of Attorney' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
  ],
  GH: 'NG', KE: 'NG', ZA: 'NG', TZ: 'NG', UG: 'NG', ET: 'NG',
  SN: 'NG', CI: 'NG', CM: 'NG', EG: 'NG', ZW: 'NG',
  IN: [
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
    { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
    { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
    { id: 'consulting-agreement', icon: '💼', name: 'Consulting Agreement' },
    { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
    { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
    { id: 'mou', icon: '🗒️', name: 'MOU' },
  ],
  PK: 'IN', BD: 'IN', PH: 'IN', ID: 'IN', MY: 'IN', SG: 'IN',
  US: [
    { id: 'privacy-policy', icon: '🔒', name: 'Privacy Policy' },
    { id: 'terms-of-service', icon: '📋', name: 'Terms of Service' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
    { id: 'independent-contractor', icon: '🏢', name: 'Contractor Agreement' },
    { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
    { id: 'consulting-agreement', icon: '💼', name: 'Consulting Agreement' },
    { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
  ],
  CA: 'US', GB: 'US', AU: 'US', NZ: 'US',
  DE: 'US', FR: 'US', IT: 'US', ES: 'US', NL: 'US', PT: 'US',
  AE: [
    { id: 'mou', icon: '🗒️', name: 'MOU' },
    { id: 'business-partnership', icon: '🤝', name: 'Partnership Agreement' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
    { id: 'distribution-agreement', icon: '📦', name: 'Distribution Agreement' },
    { id: 'supply-agreement', icon: '🏭', name: 'Supply Agreement' },
    { id: 'joint-venture', icon: '🏗️', name: 'Joint Venture' },
    { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
  ],
  SA: 'AE',
  BR: [
    { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
    { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
    { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
    { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
    { id: 'business-partnership', icon: '🤝', name: 'Partnership Agreement' },
    { id: 'tenancy-agreement', icon: '🏠', name: 'Tenancy Agreement' },
  ],
  MX: 'BR', CO: 'BR', AR: 'BR',
}
function getQuickPicks(cc) {
  if (!cc) return QUICKPICK_DEFAULT
  let p = QUICKPICK_REGIONS[cc]
  if (!p) return QUICKPICK_DEFAULT
  if (typeof p === 'string') p = QUICKPICK_REGIONS[p]
  return p || QUICKPICK_DEFAULT
}

function LoomFacade({ videoId }) {
  const [clicked, setClicked] = useState(false)
  const [thumbLoaded, setThumbLoaded] = useState(false)
  const [thumbError, setThumbError] = useState(false)
  const [inView, setInView] = useState(false)
  const ref = useRef(null)

  // Only load the GIF when the section scrolls into view — keeps it off LCP path
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect() } },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
    <div ref={ref} className="loom-facade" onClick={() => setClicked(true)} role="button" aria-label="Play demo video">
      {(!inView || (!thumbLoaded && !thumbError)) && (
        <div className="loom-placeholder">
          <div className="loom-play-btn">▶</div>
          <p className="loom-loading-text">{inView ? 'Loading preview…' : 'Click to watch demo'}</p>
        </div>
      )}
      {thumbError && (
        <div className="loom-placeholder loom-placeholder-error">
          <div className="loom-play-btn">▶</div>
          <p className="loom-loading-text">Click to watch demo</p>
        </div>
      )}
      {inView && (
        <img
          src={thumb}
          alt="Watch Signova demo"
          className="loom-thumb"
          style={{ display: thumbLoaded ? 'block' : 'none' }}
          onLoad={() => setThumbLoaded(true)}
          onError={() => setThumbError(true)}
        />
      )}
      {thumbLoaded && <div className="loom-play-btn">▶</div>}
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
    q: 'Are these documents valid in Nigeria?',
    a: 'Yes. Documents generated for Nigerian jurisdiction follow the relevant laws including the Lagos State Tenancy Law 2011, the Labour Act Cap L1 LFN 2004, and standard Nigerian commercial law principles. They are enforceable in Nigerian courts when properly signed by all parties. For property transactions above ₦5 million or complex corporate matters, we recommend having a Nigerian solicitor review the final document.',
  },
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
    a: 'You can preview your complete document for free before paying anything. If after downloading you\'re not satisfied for any reason, email hello@getsignova.com within 30 days for a full refund — no questions asked. We stand behind every document.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { currency, countryCode } = useGeo()
  const quickPicks = getQuickPicks(countryCode)
  const [navOpen, setNavOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [waitlistError, setWaitlistError] = useState('')
  const [showAllDocs, setShowAllDocs] = useState(false)

  // Memoised docs — only recomputes when geo or showAll changes, not on every ticker tick
  const docsToShow = useMemo(() => {
    if (showAllDocs) return DOCS
    const qpIds = quickPicks.map(q => q.id)
    const inQp = DOCS.filter(d => qpIds.includes(d.id))
      .sort((a, b) => qpIds.indexOf(a.id) - qpIds.indexOf(b.id))
    const notInQp = DOCS.filter(d => !qpIds.includes(d.id) && d.popular)
    return [...inQp, ...notInQp].slice(0, 9)
  }, [quickPicks, showAllDocs])

  // docsToday counter removed — was fake/randomised, hurts trust

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
            <a href="#faq" onClick={closeNav}>FAQ</a>
            <a href="/blog" onClick={closeNav}>Blog</a>
            <a href="#documents" onClick={closeNav} className="nav-cta-link">Start free →</a>
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
          <h1 className="hero-title">
            What document do you need?
          </h1>
          <p className="hero-sub">
            Answer a few questions. Get a professional legal document in under 3 minutes. Free preview — no account needed.
          </p>

          {/* Top 3 geo-detected documents — big, bold, tappable */}
          <div className="hero-top3" id="documents">
            {quickPicks.slice(0, 3).map(d => (
              <button
                key={d.id}
                className="top3-card"
                onClick={() => { trackDocSelected(d.id, 'top3'); navigate(`/generate/${d.id}`) }}
              >
                <span className="top3-icon">{d.icon}</span>
                <span className="top3-name">{d.name}</span>
                <span className="top3-go">Generate Free →</span>
              </button>
            ))}
          </div>

          <button
            className="more-docs-link"
            onClick={() => startTransition(() => setShowAllDocs(true))}
          >
            {showAllDocs ? '' : 'More documents ↓'}
          </button>

          {showAllDocs && (
            <div className="all-docs-grid">
              {docsToShow.filter(d => !quickPicks.slice(0, 3).some(qp => qp.id === d.id)).map(doc => (
                <button key={doc.id} className="all-doc-btn" onClick={() => { trackDocSelected(doc.id, 'all_docs'); navigate(`/generate/${doc.id}`) }}>
                  <span>{doc.icon}</span> {doc.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* WhatsApp feature banner */}
      <section className="wa-banner-section">
        <div className="wa-banner-inner">
          <div className="wa-banner-left">
            <div className="wa-banner-badge">💬 New feature</div>
            <h2 className="wa-banner-title">Have a WhatsApp negotiation? Paste it.</h2>
            <p className="wa-banner-body">
              We extract the agreed terms — names, amounts, dates, restrictions — and auto-fill your document in seconds. Works for tenancy agreements, loan agreements, freelance contracts and 24 more document types.
            </p>
            <button className="wa-banner-btn" onClick={() => navigate('/whatsapp')}>
              Try it free → getsignova.com/whatsapp
            </button>
          </div>
          <div className="wa-banner-right">
            <div className="wa-banner-chat">
              <div className="wa-msg wa-msg-them">Rent is ₦1.2m per year. 1 year tenancy.</div>
              <div className="wa-msg wa-msg-me">Agreed. I'm Amaka Nwosu. When do I move in?</div>
              <div className="wa-msg wa-msg-them">1st April. 6 months caution deposit — 600k.</div>
              <div className="wa-msg wa-msg-me">Fine. No pets right?</div>
              <div className="wa-msg wa-msg-them">No pets, no subletting. We sign before you move in.</div>
            </div>
            <div className="wa-banner-arrow">↓</div>
            <div className="wa-banner-result">
              <span className="wa-result-check">✓</span>
              <span className="wa-result-text">9 fields auto-filled — Tenancy Agreement ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="how-section" id="how">        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">The process</p>
            <h2 className="section-title">How the legal document generator works</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', title: 'Choose your document', body: 'Pick from 27 document types — Privacy Policy, NDA, Freelance Contract, Tenancy Agreement, Loan Agreement, Business Proposal, and more.' },
              { n: '02', title: 'Answer a few questions', body: 'Tell us about your business, jurisdiction, and needs. Takes about 2 minutes. No legal knowledge required.' },
              { n: '03', title: 'Preview free, download when ready', body: 'See your complete document instantly. When you\'re happy, download the clean, watermark-free PDF.' },
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

      {/* Pricing removed — price reveals on Preview page after user feels the value */}

      <section className="testimonials-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">What people say</p>
            <h2 className="section-title">Trusted by freelancers & businesses</h2>
          </div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="testimonial-card">
                <p className="testimonial-text">{`"${t.text}"`}</p>
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
            <p className="cta-sub">Preview your document completely free — no credit card, no account. Pay only{' '}
              {currency.code === 'USD' ? '$4.99' : `${currency.symbol}${currency.amount.toLocaleString()}`} when you're ready to download.</p>
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
