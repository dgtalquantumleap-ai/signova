import { useNavigate } from 'react-router-dom'
import { useState, useEffect, startTransition } from 'react'
import { Helmet } from 'react-helmet-async'
import { trackDocSelected, trackHeroCtaClick } from '../lib/analytics'
import './Landing.css'

// Update this number periodically — shown in hero as social proof
// Verify actual count: Supabase → documents table → SELECT COUNT(*) FROM documents
const DOCS_GENERATED = 1200

// ── Geo-currency detection ──────────────────────────────────────────────────
// Maps country code → { symbol, amount, code, local }
// 'amount' is the $4.99 USD equivalent in local currency (rounded for readability)
// 'local' is a human-friendly display string shown below the USD price
const CURRENCY_MAP = {
  // West Africa
  NG: { symbol: '₦', amount: 6900,   code: 'NGN', local: '≈ ₦6,900'       },
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

// Geo-aware lawyer fee comparison — shown in CTA section
const LAWYER_FEE_MAP = {
  NG: '₦50,000–₦150,000', GH: 'GH₵500–GH₵2,000', KE: 'KSh 5,000–KSh 20,000',
  ZA: 'R800–R3,000', ET: 'ETB 2,000–ETB 8,000', TZ: 'TSh 50,000–TSh 200,000',
  UG: 'USh 150,000–USh 600,000',
  IN: '₹5,000–₹20,000', PK: 'Rs 5,000–Rs 20,000', BD: '৳5,000–৳20,000',
  PH: '₱2,000–₱8,000', ID: 'Rp 500,000–Rp 2,000,000', MY: 'RM 300–RM 1,200', SG: 'S$200–S$600',
  GB: '£150–£400', DE: '€150–€400', FR: '€150–€400', IT: '€150–€400',
  ES: '€150–€400', NL: '€150–€400', PT: '€150–€400',
  CA: 'CA$200–CA$600', AU: 'A$200–A$500', NZ: 'NZ$200–NZ$500',
  US: '$150–$400', BR: 'R$200–R$800', MX: 'MX$1,500–MX$6,000',
  CO: 'COP 200,000–COP 800,000', AR: 'AR$5,000–AR$20,000',
  AE: 'AED 500–AED 2,000', SA: 'SAR 500–SAR 2,000', EG: 'E£500–E£2,000',
}
const DEFAULT_LAWYER_FEE = '$150–$400'

function useGeo() {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [countryCode, setCountryCode] = useState(null)

  useEffect(() => {
    // Check cache first — synchronous, no network, safe to run immediately
    const cached = sessionStorage.getItem('sig_geo')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setCurrency(parsed.currency)
        setCountryCode(parsed.countryCode)
      } catch {}
      return
    }

    // LCP FIX: Defer geo-detection until AFTER LCP fires (idle + 2s delay)
    // This ensures the fetch never competes with LCP element rendering
    const doFetch = () => {
      // Use our own API endpoint which leverages Vercel geo headers (free, unlimited)
      // Falls back to ipapi.co if not on Vercel
      fetch('/api/geo')
        .then(r => r.json())
        .then(data => {
          if (data.country_code) {
            const c = CURRENCY_MAP[data.country_code] || DEFAULT_CURRENCY
            const cc = data.country_code || null
            sessionStorage.setItem('sig_geo', JSON.stringify({ currency: c, countryCode: cc }))
            // Use startTransition to mark this as low-priority update
            startTransition(() => {
              setCurrency(c)
              setCountryCode(cc)
            })
          }
        })
        .catch(() => {})
    }

    // LCP FIX: Wait for idle + 2 seconds after page load
    // This ensures LCP element paints before any geo-related updates
    const timeoutId = setTimeout(() => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(doFetch, { timeout: 5000 })
      } else {
        doFetch()
      }
    }, 2000) // Increased from 1000ms to 2000ms for better LCP

    return () => clearTimeout(timeoutId)
  }, [])

  return { currency, countryCode }
}

// ── Geo-prioritised quick-pick documents ────────────────────────────────────
const QUICKPICK_DEFAULT = [
  { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
  { id: 'nda', icon: '🤝', name: 'NDA' },
  { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
  { id: 'privacy-policy', icon: '🔒', name: 'Privacy Policy' },
  { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
  { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
  { id: 'tenancy-agreement', icon: '🏠', name: 'Tenancy Agreement' },
  { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
]
const QUICKPICK_REGIONS = {
  NG: [
    { id: 'founders-agreement', icon: '🤝', name: "Founders' Agreement" },
    { id: 'tenancy-agreement', icon: '🏠', name: 'Tenancy Agreement' },
    { id: 'deed-of-assignment', icon: '📜', name: 'Deed of Assignment' },
    { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
    { id: 'quit-notice', icon: '💰', name: 'Quit Notice' },
    { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'ip-assignment-agreement', icon: '💡', name: 'IP Assignment' },
  ],
  GH: 'NG', KE: 'NG', ZA: 'NG', TZ: 'NG', UG: 'NG', ET: 'NG',
  SN: 'NG', CI: 'NG', CM: 'NG', EG: 'NG', ZW: 'NG',
  IN: [
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
    { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
    { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
    { id: 'consulting-agreement', icon: '💰', name: 'Consulting Agreement' },
    { id: 'business-proposal', icon: '🚀', name: 'Business Proposal' },
    { id: 'loan-agreement', icon: '💰', name: 'Loan Agreement' },
    { id: 'mou', icon: '🗒️', name: 'MOU' },
  ],
  PK: 'IN', BD: 'IN', PH: 'IN', ID: 'IN', MY: 'IN', SG: 'IN',
  US: [
    { id: 'founders-agreement', icon: '🤝', name: "Founders' Agreement" },
    { id: 'privacy-policy', icon: '🔒', name: 'Privacy Policy' },
    { id: 'terms-of-service', icon: '📋', name: 'Terms of Service' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'freelance-contract', icon: '✍️', name: 'Freelance Contract' },
    { id: 'independent-contractor', icon: '👤', name: 'Contractor Agreement' },
    { id: 'employment-offer-letter', icon: '👔', name: 'Offer Letter' },
    { id: 'ip-assignment-agreement', icon: '💡', name: 'IP Assignment' },
  ],
  CA: 'US', GB: 'US', AU: 'US', NZ: 'US',
  DE: 'US', FR: 'US', IT: 'US', ES: 'US', NL: 'US', PT: 'US',
  AE: [
    { id: 'mou', icon: '🗒️', name: 'MOU' },
    { id: 'business-partnership', icon: '🤝', name: 'Partnership Agreement' },
    { id: 'nda', icon: '🤝', name: 'NDA' },
    { id: 'service-agreement', icon: '📝', name: 'Service Agreement' },
    { id: 'distribution-agreement', icon: '📝', name: 'Distribution Agreement' },
    { id: 'supply-agreement', icon: '📦', name: 'Supply Agreement' },
    { id: 'joint-venture', icon: '🗺️', name: 'Joint Venture' },
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
    icon: '🤝',
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
    icon: '💰',
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
    icon: '🚚',
    name: 'Non-Compete Agreement',
    desc: 'Protect your business by restricting employees or contractors from working with competitors.',
    time: '2 min',
    popular: false,
  },
  {
    id: 'payment-terms-agreement',
    icon: '💰',
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
    icon: '🗺️',
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
    icon: '🤝',
    name: 'Letter of Intent (LOI)',
    desc: 'Signal serious intent to acquire, invest, partner, or lease — before formal negotiations begin.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'distribution-agreement',
    icon: '📝',
    name: 'Distribution / Reseller Agreement',
    desc: 'Appoint distributors or resellers for your products — territory, exclusivity, margin and terms.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'supply-agreement',
    icon: '🤝',
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
    icon: '🤝',
    name: 'Tenancy Agreement',
    desc: 'Legally binding rental contract between landlord and tenant for any residential or commercial property.',
    time: '3 min',
    popular: true,
  },
  {
    id: 'quit-notice',
    icon: '💰',
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
    icon: '🗺️',
    name: 'Facility Manager Agreement',
    desc: 'Formal contract between property owner and facility management company covering all services and fees.',
    time: '3 min',
    popular: false,
  },

  // ── Startup Documents ─────────────────────────────────────────────────────
  {
    id: 'founders-agreement',
    icon: '🤝',
    name: "Founders' Agreement",
    desc: 'Define equity, roles, vesting, IP ownership and exit terms between co-founders before conflict arises.',
    time: '5 min',
    popular: true,
  },
  {
    id: 'ip-assignment-agreement',
    icon: '💡',
    name: 'IP Assignment Agreement',
    desc: 'Transfer intellectual property rights from a freelancer, employee or agency to your company.',
    time: '3 min',
    popular: false,
  },
  {
    id: 'advisory-board-agreement',
    icon: '🎓',
    name: 'Advisory Board Agreement',
    desc: 'Onboard advisors and mentors with equity, vesting schedule, time commitment and confidentiality terms.',
    time: '4 min',
    popular: false,
  },
  {
    id: 'vesting-agreement',
    icon: '📈',
    name: 'Vesting Agreement',
    desc: 'Document equity vesting schedules for founders and employees with cliff, acceleration and leaver terms.',
    time: '4 min',
    popular: false,
  },
  {
    id: 'term-sheet',
    icon: '📋',
    name: 'Investment Term Sheet',
    desc: 'Non-binding term sheet covering valuation, equity %, investor rights and conditions for angel/seed funding.',
    time: '5 min',
    popular: false,
  },
  {
    id: 'safe-agreement',
    icon: '🔐',
    name: 'SAFE Agreement',
    desc: 'Simple Agreement for Future Equity — the standard early-stage fundraising instrument. Valuation cap, discount, pro-rata.',
    time: '4 min',
    popular: false,
  },
]

// Real signal — no fabricated quotes
const SOCIAL_PROOF = {
  advisor: {
    name: 'Riley-Ghiles',
    handle: '@Riley_Ikni',
    role: 'Startup Advisor · 10k+ weekly readers',
    text: 'Freelancers, tired of wasting hours drafting contracts — or scared of making a costly mistake? Fear no more.',
    url: 'https://x.com/Riley_Ikni',
    date: 'April 2026',
  },
  stats: [
    { n: '83', label: 'visitors/week', sub: 'organic, no ads' },
    { n: '$4.99', label: 'price point', sub: 'cheaper than losing one invoice' },
    { n: '180+', label: 'countries', sub: 'jurisdiction-aware' },
    { n: 'Mar \'26', label: 'first paying customer', sub: 'week 3 after launch' },
  ],
}

const FAQS = [
  {
    q: 'Is this document legally binding?',
    a: 'Yes — documents generated by Signova are based on real legal frameworks and established templates used by attorneys. They are enforceable in most jurisdictions. For high-stakes matters (litigation, complex IP, employment disputes), we recommend having an attorney review the final document.',
  },
  {
    q: 'What countries are supported?',
    a: 'Signova generates documents suitable for use globally — including the US, UK, Canada, Australia, EU, Nigeria, South Africa, Kenya, Ghana, India, Singapore, UAE, Brazil, Mexico, and 180+ more countries. During generation you specify your jurisdiction so the document is tailored accordingly. Documents follow local legal conventions and terminology.',
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
    q: 'Can I pay with crypto (USDT)?',
    a: 'Yes. We accept USDT payments for users who prefer cryptocurrency or don\'t have access to international card payments. Simply select the crypto option at checkout. Payment is instant and you get your document immediately.',
  },
  {
    q: 'Is my information stored or shared?',
    a: 'No. Your answers are used only to generate your document in real time — they are never saved to a database, logged, or shared with third parties. Once you close the tab, the data is gone.',
  },
  {
    q: 'What if I\'m not happy with the result?',
    a: 'You can preview your complete document for free before paying anything. If after downloading you\'re not satisfied for any reason, email info@ebenova.net within 30 days for a full refund — no questions asked. We stand behind every document.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { currency: geoCurrency, countryCode } = useGeo()
  const quickPicks = getQuickPicks(countryCode)
  const [navOpen, setNavOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(0)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [currency, setCurrency] = useState(null) // null = use geo-detected
  const [currencyOpen, setCurrencyOpen] = useState(false)

  const closeNav = () => setNavOpen(false)

  // Effective currency: user override > geo-detected
  const activeCurrency = currency || geoCurrency

  // Build list of top currencies for the dropdown
  const CURRENCY_OPTIONS = [
    { code: 'USD', symbol: '$', label: 'USD — $4.99' },
    { code: 'NGN', symbol: '₦', amount: 6900, label: 'NGN — ₦6,900' },
    { code: 'GBP', symbol: '£', amount: 3.95, label: 'GBP — £3.95' },
    { code: 'EUR', symbol: '€', amount: 4.60, label: 'EUR — €4.60' },
    { code: 'GHS', symbol: 'GH₵', amount: 75, label: 'GHS — GH₵75' },
    { code: 'KES', symbol: 'KSh', amount: 650, label: 'KES — KSh 650' },
    { code: 'INR', symbol: '₹', amount: 418, label: 'INR — ₹418' },
    { code: 'ZAR', symbol: 'R', amount: 93, label: 'ZAR — R93' },
  ]

  return (
    <div className="landing">
      <Helmet>
        <title>Signova — Professional Legal Documents for Freelancers, Landlords & Businesses | Free Preview</title>
        <meta name="description" content="Generate legal contracts in 3 minutes. NDAs, freelance contracts, tenancy agreements and 24 more. Free preview, $4.99 to download. No lawyer needed." />
        <meta name="keywords" content="legal document generator Nigeria, tenancy agreement Nigeria, NDA template, freelance contract, deed of assignment Nigeria, loan agreement template, business proposal template, MOU template, hire purchase agreement Nigeria, power of attorney Nigeria, employment offer letter, shareholder agreement, joint venture agreement, service agreement, distribution agreement, quit notice Nigeria, privacy policy generator, terms of service generator" />
        <link rel="canonical" href="https://www.getsignova.com/" />
        <link rel="alternate" hreflang="en" href="https://www.getsignova.com/" />
        <link rel="alternate" hreflang="x-default" href="https://www.getsignova.com/" />
        {/* LCP FIX: Preconnect to geo API */}
        <link rel="preconnect" href="https://ipapi.co" />
        <link rel="dns-prefetch" href="https://ipapi.co" />
      </Helmet>
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">
            <span className="logo-mark">S</span>
            <span className="logo-text">Signova</span>
          </div>

          {/* Currency toggle */}
          <div className="currency-toggle" style={{ position: 'relative' }}>
            <button
              className="currency-toggle-btn"
              onClick={() => setCurrencyOpen(o => !o)}
              aria-label="Change currency"
              title="Change currency"
            >
              {activeCurrency.symbol}{activeCurrency.code === 'USD' ? '4.99' : activeCurrency.amount?.toLocaleString()}
            </button>
            {currencyOpen && (
              <div className="currency-dropdown">
                {CURRENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.code}
                    className={`currency-option ${activeCurrency.code === opt.code ? 'active' : ''}`}
                    onClick={() => {
                      if (opt.code === geoCurrency.code) {
                        setCurrency(null) // revert to auto
                      } else {
                        setCurrency({ code: opt.code, symbol: opt.symbol, amount: opt.amount || 4.99 })
                      }
                      setCurrencyOpen(false)
                    }}
                  >
                    {opt.label}
                    {opt.code === geoCurrency.code && !currency && <span className="currency-auto-badge">Auto</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`nav-links ${navOpen ? 'open' : ''}`}>
            <a href="#documents" onClick={closeNav} aria-label="Browse documents">Documents</a>
            <a href="#how" onClick={closeNav} aria-label="How Signova works">How it works</a>
            <a href="/scope-guard" onClick={closeNav} aria-label="Protect against scope creep" title="Paste a client message + your contract — Scope Guard flags violations and drafts your pushback">Scope Guard</a>
            <a href="#faq" onClick={closeNav} aria-label="Frequently asked questions">FAQ</a>
            <a href="/blog" onClick={closeNav} aria-label="Read our blog">Blog</a>
            <a href="#documents" onClick={closeNav} className="nav-cta-link" aria-label="Preview a document for free">Preview Free →</a>
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

      <section className="hero" id="main-content">
        {/* Subtle document grid pattern instead of generic glow */}
        <div className="hero-doc-pattern" aria-hidden="true">
          {['NDA','LEASE','CONTRACT','MOU','NDA','INVOICE','CONTRACT','DEED','NDA','LEASE'].map((t,i) => (
            <span key={i} className="hero-pattern-word">{t}</span>
          ))}
        </div>
        <div className="hero-two-col">
          {/* ── LEFT: headline + CTA ── */}
          <div className="hero-left">
            <div className="hero-eyebrow">💬 Paste chat → Get a contract</div>
            <p className="hero-consequence">Every month, freelancers lose thousands because they had no contract.</p>
            <h1 className="hero-title" fetchpriority="high">
              Paste your chat.<br />
              <span className="hero-title-gold">Get a signed contract</span><br />
              in 2 minutes.
            </h1>
            <p className="hero-sub">
              Get a signed contract in 2 minutes — just paste your WhatsApp, email, or iMessage negotiation — Signova extracts the agreed terms and builds a lawyer-quality document before the moment passes. 27 document types. Works at midnight. Works anywhere.
            </p>
            <p className="hero-value-line">Cheaper than losing one invoice. Built by a founder who lost a major deal to a handshake — and built this so you don't have to.</p>

            <div className="hero-jurisdictions">
              <span>🇳🇬 Nigeria</span>
              <span className="jurisdiction-divider">·</span>
              <span>🇨🇦 Canada</span>
              <span className="jurisdiction-divider">·</span>
              <span>🇺🇸 US</span>
              <span className="jurisdiction-divider">·</span>
              <span>🇬🇧 UK</span>
              <span className="jurisdiction-divider">·</span>
              <span className="jurisdiction-more">180+ countries worldwide</span>
            </div>

            <div className="hero-proof-badge">
              📄 {DOCS_GENERATED.toLocaleString()}+ documents generated
            </div>

            <div className="hero-top3" id="documents">
              {quickPicks.slice(0, 3).map(d => (
                <button
                  key={d.id}
                  className="top3-card"
                  onClick={() => { trackDocSelected(d.id, 'top3'); navigate(`/generate/${d.id}`) }}
                  aria-label={`Generate ${d.name} for free`}
                >
                  <span className="top3-icon">{d.icon}</span>
                  <span className="top3-name">{d.name}</span>
                  <span className="top3-go">Preview Free →</span>
                </button>
              ))}
            </div>

            <div className="hero-cta-row">
              <button
                className="btn-primary btn-large"
                onClick={() => { trackHeroCtaClick(); navigate('/whatsapp') }}
                aria-label="Turn your chat into a contract"
              >
                Turn this chat into a contract <span className="btn-arrow">→</span>
              </button>
            </div>
            <p className="hero-trust-line">Free preview · No account required · $4.99 {activeCurrency.local ? `(${activeCurrency.local})` : ''} to download · Enforceable in 180+ countries · 30-day refund</p>
          </div>

          {/* ── RIGHT: live WhatsApp demo ── */}
          <div className="hero-right" data-lazy-load onClick={() => navigate('/whatsapp')} role="button" tabIndex={0} aria-label="Try WhatsApp extraction" onKeyDown={e => e.key === 'Enter' && navigate('/whatsapp')}>
            <div className="hero-demo-label">Free demo — tap to try with your own chat</div>
            <div className="hero-demo-phone">
              <div className="hero-demo-bar">
                <span className="hero-demo-dot" /><span className="hero-demo-dot" /><span className="hero-demo-dot" />
                <span className="hero-demo-app">💬 WhatsApp</span>
              </div>
              <div className="hero-demo-chat">
                <div className="hero-chat-them">We need a full website — 5 pages, blog, contact form. Budget $2,500.</div>
                <div className="hero-chat-me">Got it. Timeline and revisions?</div>
                <div className="hero-chat-them">3 weeks. 2 rounds included, extra revisions billed.</div>
                <div className="hero-chat-me">50% upfront, rest on delivery?</div>
              </div>
            </div>
            <div className="hero-demo-arrow">↓ Signova extracts 9 terms</div>
            <div className="hero-demo-result">
              <span className="hero-result-icon">✓</span>
              <div>
                <div className="hero-result-title">Freelance Contract ready</div>
                <div className="hero-result-sub">Client · Scope · Deliverables · Timeline · Payment · Revisions…</div>
              </div>
            </div>
            <div className="hero-demo-cta">Try free → getsignova.com/whatsapp</div>
          </div>
        </div>

        {/* All 27 documents — always visible chip grid */}
        <div className="hero-picks-row">
          <p className="all-docs-label">All 27 document types</p>
          <div className="all-docs-grid">
            {DOCS.map(doc => (
              <button
                key={doc.id}
                className="all-doc-btn"
                onClick={() => { trackDocSelected(doc.id, 'all_docs'); navigate(`/generate/${doc.id}`) }}
                aria-label={`Generate ${doc.name}`}
              >
                <span>{doc.icon}</span> {doc.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Video walkthrough */}
      <section className="video-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">See it in action</p>
            <h2 className="section-title">From chat to signed contract — watch it happen</h2>
          </div>
          <div className="video-wrapper">
            {videoPlaying ? (
              <iframe
                src="https://www.loom.com/embed/9a41b8a6f1654deab554c80a7d1ba891?autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
                style={{ border: 'none' }}
                allowFullScreen
                allow="autoplay; fullscreen"
                className="video-iframe"
                title="Signova walkthrough"
              />
            ) : (
              <button
                className="video-poster"
                onClick={() => setVideoPlaying(true)}
                aria-label="Play Signova walkthrough"
              >
                <img
                  src={`https://cdn.loom.com/sessions/thumbnails/9a41b8a6f1654deab554c80a7d1ba891-with-play.gif`}
                  alt="Signova walkthrough preview"
                  className="video-thumbnail"
                  loading="lazy"
                />
                <div className="video-play-overlay" aria-hidden="true">
                  <span className="video-play-btn">▶</span>
                </div>
                <div className="video-caption">▶ Watch the 60-second walkthrough — no sign-up required</div>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* WhatsApp feature banner */}
      <section className="wa-banner-section">
        <div className="wa-banner-inner">
          <div className="wa-banner-left">
            <div className="wa-banner-badge">✉️ WhatsApp, iMessage, Telegram, email — paste any negotiation</div>
            <h2 className="wa-banner-title">Agreed terms in a chat or email? Paste it.</h2>
            <p className="wa-banner-body">
              We extract the agreed terms — names, amounts, dates, restrictions — and auto-fill your document in seconds. Works for tenancy agreements, loan agreements, freelance contracts and 24 more document types.
            </p>
            <button className="wa-banner-btn" onClick={() => navigate('/whatsapp')}>
              Turn your chat into a contract →
            </button>
          </div>
          <div className="wa-banner-right">
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', textAlign: 'right' }}>Example conversation</div>
            <div className="wa-banner-chat" style={{ cursor: 'pointer' }} onClick={() => navigate('/whatsapp')}>
              <div className="wa-msg wa-msg-them">We need a full website — 5 pages, blog, contact form. Budget is $2,500.</div>
              <div className="wa-msg wa-msg-me">Got it. Timeline and revisions?</div>
              <div className="wa-msg wa-msg-them">3 weeks. 2 rounds included, extra revisions billed.</div>
              <div className="wa-msg wa-msg-me">50% upfront, rest on delivery?</div>
              <div className="wa-msg wa-msg-them">Agreed. I'll send the details now.</div>
              <div className="wa-msg wa-msg-me">Perfect — I'll send over the agreement before we start.</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>Tap to try with your own conversation →</div>
            </div>
            <div className="wa-banner-arrow">↓</div>
            <div className="wa-banner-result">
              <span className="wa-result-check">✓</span>
              <span className="wa-result-text">9 fields auto-filled — Freelance Contract ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="how-section" id="how">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">The process</p>
            <h2 className="section-title">How Signova works — from question to signed document in 3 minutes</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', title: 'Choose your document', body: 'Pick from 27 document types built for global use — Tenancy Agreement, NDA, Freelance Contract, Deed of Assignment, Loan Agreement, Business Proposal, and more. Works in any jurisdiction.' },
              { n: '02', title: 'Answer a few questions', body: 'Tell us your names, jurisdiction, and deal terms. Takes 2 minutes. No legal knowledge required — the questions are plain language. An old template won\'t know this client\'s name, this amount, or these terms. Signova does.' },
              { n: '03', title: 'Preview free, download when ready', body: 'See your complete, properly structured document instantly — built on real legal frameworks used by attorneys, not generic AI output. When you\'re happy, download the clean PDF for the price of a phone call — not a lawyer.' },
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



      {/* Scope Guard teaser */}
      <section className="scope-teaser-section">
        <div className="section-inner">
          <div className="scope-teaser-card">
            <div className="scope-teaser-left">
              <div className="scope-teaser-badge">🛡️ Scope Guard — Free Tool</div>
              <h2 className="scope-teaser-title">Client adding extras after you signed?</h2>
              <p className="scope-teaser-body">
                Paste their message + your contract. Scope Guard detects scope creep, deadline compression, and unpaid extras — then drafts a professional pushback in seconds.
              </p>
              <a href="/scope-guard" className="scope-teaser-btn">Try Scope Guard free →</a>
            </div>
            <div className="scope-teaser-right" aria-hidden="true">
              <div className="scope-example-msg">"Can you also add a blog section? Should be quick."</div>
              <div className="scope-example-arrow">↓ Scope Guard detects: scope creep</div>
              <div className="scope-example-response">Auto-drafts a change order with estimated hours and cost.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonials-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">What people are saying</p>
            <h2 className="section-title">Built for the people lawyers ignore</h2>
          </div>

          {/* Riley quote */}
          <div className="advisor-quote-card">
            <div className="advisor-quote-mark">"</div>
            <p className="advisor-quote-text">{SOCIAL_PROOF.advisor.text}</p>
            <div className="advisor-quote-footer">
              <div className="advisor-avatar" aria-hidden="true">R</div>
              <div className="advisor-info">
                <span className="advisor-name">{SOCIAL_PROOF.advisor.name}</span>
                <span className="advisor-handle">{SOCIAL_PROOF.advisor.handle}</span>
                <span className="advisor-role">{SOCIAL_PROOF.advisor.role}</span>
              </div>
              <a
                href={SOCIAL_PROOF.advisor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="advisor-link"
                aria-label="View original post on X"
              >
                View on X ↗
              </a>
            </div>
            <div className="advisor-context">
              Riley roasted 100+ startups in one thread. This is what he drafted for Signova — unprompted.
            </div>
          </div>

          <div className="seen-on-strip">
            <span className="seen-on-label">As seen on</span>
            <a href="https://x.com/Riley_Ikni" target="_blank" rel="noopener noreferrer" className="seen-on-link">𝕏 / Twitter</a>
            <span className="seen-on-divider">·</span>
            <a href="/blog" className="seen-on-link">Signova Blog</a>
          </div>
        </div>
      </section>

      {/* Pricing section — 2 clear tiers */}
      <section className="pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Pricing</p>
            <h2 className="section-title">Simple, honest pricing</h2>
            <p className="section-subtitle">Start free. Pay only when you download.</p>
          </div>
          <div className="pricing-grid">

            {/* Free */}
            <div className="price-card">
              <div className="price-tier">Free Preview</div>
              <div className="price-amount">$0</div>
              <p className="price-desc">See your full document before paying anything. No account, no card required.</p>
              <ul className="price-list">
                <li className="price-yes">✓ Preview any document in full</li>
                <li className="price-yes">✓ 27 document types</li>
                <li className="price-yes">✓ WhatsApp extraction</li>
                <li className="price-yes">✓ 180+ jurisdictions</li>
                <li className="price-no">✗ Download PDF</li>
                <li className="price-no">✗ Watermark-free version</li>
              </ul>
              <button className="btn-outline" onClick={() => navigate('/generate/freelance-contract')}>
                Try free →
              </button>
            </div>

            {/* Per document */}
            <div className="price-card price-featured">
              <div className="price-top-badge">Most Popular</div>
              <div className="price-tier">Pay Per Document</div>
              <div className="price-amount">
                {activeCurrency.code === 'USD' ? '$4.99' : `${activeCurrency.symbol}${activeCurrency.amount.toLocaleString()}`}
                <span className="price-per">/ doc</span>
              </div>
              {activeCurrency.local && (
                <p className="price-local-equiv">≈ $4.99 USD</p>
              )}
              <p className="price-desc">Pay once per document. No subscription. Yours to keep forever.</p>
              <ul className="price-list">
                <li className="price-yes">✓ Clean PDF — no watermark</li>
                <li className="price-yes">✓ Instant download</li>
                <li className="price-yes">✓ 27 document types</li>
                <li className="price-yes">✓ Jurisdiction-aware content</li>
                <li className="price-yes">✓ Pay by card or USDT crypto</li>
                <li className="price-yes">✓ 30-day money-back guarantee</li>
              </ul>
              <button className="btn-primary" onClick={() => navigate('/whatsapp')}>
                Generate now →
              </button>
              <p className="price-guarantee">✓ 30-day refund if not satisfied</p>
            </div>

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
              { icon: '⚡', title: 'Ready in 3 minutes', body: 'From question to signed-ready PDF faster than a WhatsApp voice note.' },
              { icon: '🔑', title: 'Your data stays yours', body: 'Nothing is saved to a database. Close the tab and it\'s gone.' },
              { icon: '🌍', title: 'Works in any jurisdiction', body: 'Jurisdiction-aware documents for Nigeria, UK, US, India, and more. Not generic templates — tailored to your country\'s laws.' },
              { icon: '💳', title: 'Pay with card or crypto', body: 'Accepts all major cards and USDT. No restrictions — pay the way you already pay.' },
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
            <h2 className="cta-title">Stop paying {LAWYER_FEE_MAP[countryCode] || DEFAULT_LAWYER_FEE} for a document you can generate in 3 minutes.</h2>
            <p className="cta-sub">Preview completely free — no account, no credit card. Pay only{' '}
              {activeCurrency.code === 'USD' ? '$4.99' : `${activeCurrency.symbol}${activeCurrency.amount.toLocaleString()}`} when you're ready to download. Works in Nigeria, Ghana, Kenya, the UK, Canada, and any jurisdiction worldwide.</p>
            <div className="cta-trust-strip">
              <span>⚖️ Built on real legal frameworks</span>
              <span className="cta-trust-dot">·</span>
              <span>🔍 Preview the full document before paying</span>
              <span className="cta-trust-dot">·</span>
              <span>↩️ 30-day refund, no questions</span>
            </div>
            <button
              className="btn-primary btn-large"
              onClick={() => navigate('/generate/nda')}
            >
              Preview Free <span className="btn-arrow">→</span>
            </button>
            <div className="cta-payment-badges">
              <span className="cta-payment-badge">Visa</span>
              <span className="cta-payment-badge">Mastercard</span>
              <span className="cta-payment-badge">USDT</span>
              <span className="cta-payment-badge">🔒 Secure checkout</span>
            </div>
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
            <a href="/scope-guard">Scope Guard</a>
            <a href="/contact">Contact</a>
          </div>
          <p className="footer-disc">
            Signova is a document generation tool, not a law firm. Documents are AI-generated starting points — not legal advice. No attorney-client relationship is created by using this service. For complex or high-stakes matters, consult a qualified attorney before signing or relying on any document.
          </p>
          <p className="footer-copy">© 2026 Signova · Ebenova Solutions</p>
        </div>
      </footer>
    </div>
  )
}
