import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { trackDocSelected, trackHeroCtaClick } from '../lib/analytics'
import { fetchUserPricing } from '../lib/pricing'
import SiteFooter from '../components/SiteFooter'
import {
  Rocket, Handshake, PenNib, Lock, FileText, CurrencyDollar,
  House, Briefcase, Article, Car, ShoppingCart, ChartBar,
  ClipboardText, Scales, GraduationCap, TrendUp, ShieldCheck,
  Shield, Robot, Receipt, ChatCircle, Link, Package,
  Broadcast, ArrowsLeftRight, EnvelopeSimple, MapTrifold,
  Note, Warning, Globe, Bank, DeviceMobile, CheckCircle,
  XCircle, Star, Key, User, CreditCard, LightbulbFilament,
} from '@phosphor-icons/react'
import './Landing.css'

// Update this number periodically — shown in hero as social proof
const DOCS_GENERATED = 1200

// ── Custom hook: IntersectionObserver-based lazy loading ────────────────────
function useLazyLoad(options = {}) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        observer.disconnect()
      }
    }, { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin ?? '50px' })

    observer.observe(el)
    return () => observer.disconnect()
  }, [options.threshold, options.rootMargin])

  return [ref, isVisible]
}

// ── Geo-currency detection ──────────────────────────────────────────────────
//
// RETAINED — NOT USED FOR STRIPE FLOWS.
// Stripe pricing is driven entirely by src/lib/pricing.js → fetchUserPricing()
// which reads the server-side tier from /api/v1/pricing/detect-region. This
// table is kept for reference only; do NOT read from it for any price display
// that a Stripe-paying user sees. Maintaining 49 localised rows against three
// USD tiers is a misrepresentation risk (see Landing PR on tiered pricing).
// Paystack (Nigerian rail) shows ₦6,900 directly, not from this map.
//
const _CURRENCY_MAP_RETAINED = {
  NG: { symbol: '₦', amount: 6900,   code: 'NGN', local: '≈ ₦6,900'       },
  GH: { symbol: 'GH₵', amount: 75,   code: 'GHS', local: '≈ GH₵75'        },
  SN: { symbol: 'CFA', amount: 3100, code: 'XOF', local: '≈ CFA 3,100'    },
  CI: { symbol: 'CFA', amount: 3100, code: 'XOF', local: '≈ CFA 3,100'    },
  CM: { symbol: 'CFA', amount: 3100, code: 'XAF', local: '≈ CFA 3,100'    },
  KE: { symbol: 'KSh', amount: 650,  code: 'KES', local: '≈ KSh 650'      },
  TZ: { symbol: 'TSh', amount: 13200,code: 'TZS', local: '≈ TSh 13,200'   },
  UG: { symbol: 'USh', amount: 18500,code: 'UGX', local: '≈ USh 18,500'   },
  ET: { symbol: 'Br',  amount: 290,  code: 'ETB', local: '≈ Br 290'       },
  ZA: { symbol: 'R',   amount: 93,   code: 'ZAR', local: '≈ R93'          },
  ZW: { symbol: 'USD', amount: 4.99, code: 'USD', local: null              },
  EG: { symbol: 'E£',  amount: 248,  code: 'EGP', local: '≈ E£248'        },
  AE: { symbol: 'د.إ', amount: 18,   code: 'AED', local: '≈ AED 18'       },
  SA: { symbol: '﷼',   amount: 19,   code: 'SAR', local: '≈ SAR 19'       },
  IN: { symbol: '₹',   amount: 418,  code: 'INR', local: '≈ ₹418'         },
  PK: { symbol: '₨',   amount: 1390, code: 'PKR', local: '≈ Rs 1,390'     },
  BD: { symbol: '৳',   amount: 550,  code: 'BDT', local: '≈ ৳550'         },
  PH: { symbol: '₱',   amount: 288,  code: 'PHP', local: '≈ ₱288'         },
  ID: { symbol: 'Rp',  amount: 80000,code: 'IDR', local: '≈ Rp 80,000'    },
  MY: { symbol: 'RM',  amount: 23,   code: 'MYR', local: '≈ RM 23'        },
  SG: { symbol: 'S$',  amount: 6.70, code: 'SGD', local: '≈ S$6.70'       },
  BR: { symbol: 'R$',  amount: 29,   code: 'BRL', local: '≈ R$29'         },
  MX: { symbol: '$',   amount: 103,  code: 'MXN', local: '≈ MX$103'       },
  CO: { symbol: '$',   amount: 20000,code: 'COP', local: '≈ COP 20,000'   },
  AR: { symbol: '$',   amount: 5000, code: 'ARS', local: '≈ AR$5,000'     },
  GB: { symbol: '£',   amount: 3.95, code: 'GBP', local: '≈ £3.95'        },
  DE: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  FR: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  IT: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  ES: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  NL: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  PT: { symbol: '€',   amount: 4.60, code: 'EUR', local: '≈ €4.60'        },
  CA: { symbol: 'CA$', amount: 6.85, code: 'CAD', local: '≈ CA$6.85'      },
  AU: { symbol: 'A$',  amount: 7.80, code: 'AUD', local: '≈ A$7.80'       },
  NZ: { symbol: 'NZ$', amount: 8.50, code: 'NZD', local: '≈ NZ$8.50'      },
  CN: { symbol: '¥',   amount: 36,   code: 'CNY', local: '≈ ¥36'          },
  HK: { symbol: 'HK$', amount: 39,   code: 'HKD', local: '≈ HK$39'       },
  TW: { symbol: 'NT$', amount: 160,  code: 'TWD', local: '≈ NT$160'      },
  JP: { symbol: '¥',   amount: 750,  code: 'JPY', local: '≈ ¥750'        },
  KR: { symbol: '₩',   amount: 6900, code: 'KRW', local: '≈ ₩6,900'     },
  TH: { symbol: '฿',   amount: 175,  code: 'THB', local: '≈ ฿175'        },
  VN: { symbol: '₫',   amount: 128000,code: 'VND', local: '≈ ₫128,000'  },
  CL: { symbol: '$',   amount: 4800, code: 'CLP', local: '≈ CLP 4,800'  },
  PE: { symbol: 'S/',   amount: 19,   code: 'PEN', local: '≈ S/19'       },
  RW: { symbol: 'FRw',  amount: 6800, code: 'RWF', local: '≈ FRw 6,800' },
  MA: { symbol: 'MAD',  amount: 50,   code: 'MAD', local: '≈ MAD 50'     },
  TR: { symbol: '₺',   amount: 175,  code: 'TRY', local: '≈ ₺175'       },
  IL: { symbol: '₪',   amount: 18,   code: 'ILS', local: '≈ ₪18'        },
  PL: { symbol: 'zł',  amount: 20,   code: 'PLN', local: '≈ zł20'       },
  SE: { symbol: 'kr',   amount: 52,   code: 'SEK', local: '≈ kr52'       },
  NO: { symbol: 'kr',   amount: 54,   code: 'NOK', local: '≈ kr54'       },
  DK: { symbol: 'kr',   amount: 34,   code: 'DKK', local: '≈ kr34'       },
}
const _DEFAULT_CURRENCY_RETAINED = { symbol: '$', amount: 4.99, code: 'USD', local: null }

// Retained but not used — final CTA no longer quotes a lawyer fee.
const _LAWYER_FEE_MAP_RETAINED = {
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
const _DEFAULT_LAWYER_FEE_RETAINED = '$150–$400'

// useGeo() was removed when landing moved to server-side tiered pricing.
// The old 49-country CURRENCY_MAP drove a local-currency display that
// approximated a flat $4.99 charge. With tiered USD pricing, per-country
// display would drift from the actual Stripe charge and create a bait-and-
// switch risk. See src/lib/pricing.js + /api/v1/pricing/detect-region.js.

// ── Geo-prioritised quick-pick documents ────────────────────────────────────
// Top-3 slots drive the hero's above-the-fold quick picks (.slice(0,3)).
// Ordered to match the "Don't start the work until this is signed"
// positioning — contract primitives first, then supporting docs.
const QUICKPICK_DEFAULT = [
  { id: 'freelance-contract', icon: <PenNib size={20} weight="duotone" color="currentColor" />, name: 'Freelance Contract' },
  { id: 'nda', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'NDA' },
  { id: 'service-agreement', icon: <FileText size={20} weight="duotone" color="currentColor" />, name: 'Service Agreement' },
  { id: 'tenancy-agreement', icon: <House size={20} weight="duotone" color="currentColor" />, name: 'Tenancy Agreement' },
  { id: 'loan-agreement', icon: <CurrencyDollar size={20} weight="duotone" color="currentColor" />, name: 'Loan Agreement' },
  { id: 'employment-offer-letter', icon: <Briefcase size={20} weight="duotone" color="currentColor" />, name: 'Offer Letter' },
  { id: 'business-proposal', icon: <Rocket size={20} weight="duotone" color="currentColor" />, name: 'Business Proposal' },
  { id: 'privacy-policy', icon: <Lock size={20} weight="duotone" color="currentColor" />, name: 'Privacy Policy' },
]
const QUICKPICK_REGIONS = {
  NG: [
    // Reordered for pre-flight-checklist framing. Nigerian freelancer ghosting,
    // informal tenancy disputes, and unwritten loans (the "lent money to a
    // cousin" case from /about) are the three classic "should have signed it"
    // moments. Founders' Agreement / Deed of Assignment / IP Assignment kept
    // in the full grid below the top-3.
    { id: 'freelance-contract', icon: <PenNib size={20} weight="duotone" color="currentColor" />, name: 'Freelance Contract' },
    { id: 'tenancy-agreement', icon: <House size={20} weight="duotone" color="currentColor" />, name: 'Tenancy Agreement' },
    { id: 'loan-agreement', icon: <CurrencyDollar size={20} weight="duotone" color="currentColor" />, name: 'Loan Agreement' },
    { id: 'nda', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'NDA' },
    { id: 'founders-agreement', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: "Founders' Agreement" },
    { id: 'deed-of-assignment', icon: <Article size={20} weight="duotone" color="currentColor" />, name: 'Deed of Assignment' },
    { id: 'quit-notice', icon: <CurrencyDollar size={20} weight="duotone" color="currentColor" />, name: 'Quit Notice' },
    { id: 'ip-assignment-agreement', icon: <LightbulbFilament size={20} weight="duotone" color="currentColor" />, name: 'IP Assignment' },
  ],
  GH: 'NG', KE: 'NG', ZA: 'NG', TZ: 'NG', UG: 'NG', ET: 'NG',
  SN: 'NG', CI: 'NG', CM: 'NG', EG: 'NG', ZW: 'NG',
  IN: [
    { id: 'nda', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'NDA' },
    { id: 'freelance-contract', icon: <PenNib size={20} weight="duotone" color="currentColor" />, name: 'Freelance Contract' },
    { id: 'service-agreement', icon: <FileText size={20} weight="duotone" color="currentColor" />, name: 'Service Agreement' },
    { id: 'employment-offer-letter', icon: <Briefcase size={20} weight="duotone" color="currentColor" />, name: 'Offer Letter' },
    { id: 'consulting-agreement', icon: <CurrencyDollar size={20} weight="duotone" color="currentColor" />, name: 'Consulting Agreement' },
    { id: 'business-proposal', icon: <Rocket size={20} weight="duotone" color="currentColor" />, name: 'Business Proposal' },
    { id: 'loan-agreement', icon: <CurrencyDollar size={20} weight="duotone" color="currentColor" />, name: 'Loan Agreement' },
    { id: 'mou', icon: <Note size={20} weight="duotone" color="currentColor" />, name: 'MOU' },
  ],
  PK: 'IN', BD: 'IN', PH: 'IN', ID: 'IN', MY: 'IN', SG: 'IN',
  US: [
    // Reordered so the hero's top-3 quick picks (.slice(0,3)) match the
    // "Don't start the work until this is signed" positioning. The previous
    // order (Founders' Agreement / Privacy Policy / Terms of Service) was
    // a SaaS-startup trio; western-tier visitors landing on the new hero
    // are reading a pre-flight-checklist message and want the contract
    // primitives first.
    { id: 'freelance-contract', icon: <PenNib size={20} weight="duotone" color="currentColor" />, name: 'Freelance Contract' },
    { id: 'nda', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'NDA' },
    { id: 'service-agreement', icon: <FileText size={20} weight="duotone" color="currentColor" />, name: 'Service Agreement' },
    { id: 'independent-contractor', icon: <User size={20} weight="duotone" color="currentColor" />, name: 'Contractor Agreement' },
    { id: 'employment-offer-letter', icon: <Briefcase size={20} weight="duotone" color="currentColor" />, name: 'Offer Letter' },
    { id: 'founders-agreement', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: "Founders' Agreement" },
    { id: 'privacy-policy', icon: <Lock size={20} weight="duotone" color="currentColor" />, name: 'Privacy Policy' },
    { id: 'terms-of-service', icon: <ClipboardText size={20} weight="duotone" color="currentColor" />, name: 'Terms of Service' },
    { id: 'ip-assignment-agreement', icon: <LightbulbFilament size={20} weight="duotone" color="currentColor" />, name: 'IP Assignment' },
  ],
  CA: 'US', GB: 'US', AU: 'US', NZ: 'US',
  DE: 'US', FR: 'US', IT: 'US', ES: 'US', NL: 'US', PT: 'US',
  AE: [
    // Reordered for pre-flight-checklist framing. Gulf B2B deals map most
    // cleanly to Service Agreement (the primary "don't start the work"
    // doc), then NDA (required before nearly every deal conversation),
    // then MOU (often the formal starting gun for bigger engagements).
    { id: 'service-agreement', icon: <FileText size={20} weight="duotone" color="currentColor" />, name: 'Service Agreement' },
    { id: 'nda', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'NDA' },
    { id: 'mou', icon: <Note size={20} weight="duotone" color="currentColor" />, name: 'MOU' },
    { id: 'business-partnership', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'Partnership Agreement' },
    { id: 'distribution-agreement', icon: <FileText size={20} weight="duotone" color="currentColor" />, name: 'Distribution Agreement' },
    { id: 'supply-agreement', icon: <Package size={20} weight="duotone" color="currentColor" />, name: 'Supply Agreement' },
    { id: 'joint-venture', icon: <MapTrifold size={20} weight="duotone" color="currentColor" />, name: 'Joint Venture' },
    { id: 'business-proposal', icon: <Rocket size={20} weight="duotone" color="currentColor" />, name: 'Business Proposal' },
  ],
  SA: 'AE',
  BR: [
    { id: 'freelance-contract', icon: <PenNib size={20} weight="duotone" color="currentColor" />, name: 'Freelance Contract' },
    { id: 'service-agreement', icon: <FileText size={20} weight="duotone" color="currentColor" />, name: 'Service Agreement' },
    { id: 'nda', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'NDA' },
    { id: 'employment-offer-letter', icon: <Briefcase size={20} weight="duotone" color="currentColor" />, name: 'Offer Letter' },
    { id: 'business-proposal', icon: <Rocket size={20} weight="duotone" color="currentColor" />, name: 'Business Proposal' },
    { id: 'loan-agreement', icon: <CurrencyDollar size={20} weight="duotone" color="currentColor" />, name: 'Loan Agreement' },
    { id: 'business-partnership', icon: <Handshake size={20} weight="duotone" color="currentColor" />, name: 'Partnership Agreement' },
    { id: 'tenancy-agreement', icon: <House size={20} weight="duotone" color="currentColor" />, name: 'Tenancy Agreement' },
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

// ── Document categories for mobile accordion ────────────────────────────────
const DOC_CATEGORIES = [
  {
    name: 'Business & Commercial',
    docs: ['privacy-policy', 'terms-of-service', 'nda', 'business-proposal', 'mou', 'letter-of-intent', 'business-partnership', 'joint-venture', 'distribution-agreement', 'supply-agreement', 'consulting-agreement', 'service-agreement', 'independent-contractor', 'payment-terms-agreement', 'purchase-agreement', 'non-compete-agreement'],
  },
  {
    name: 'Employment & Contracts',
    docs: ['freelance-contract', 'employment-offer-letter', 'founders-agreement', 'advisory-board-agreement', 'vesting-agreement', 'term-sheet', 'safe-agreement', 'ip-assignment-agreement'],
  },
  {
    name: 'Property & Real Estate',
    docs: ['tenancy-agreement', 'quit-notice', 'deed-of-assignment', 'power-of-attorney', 'landlord-agent-agreement', 'facility-manager-agreement'],
  },
  {
    name: 'Finance & Investment',
    docs: ['loan-agreement', 'hire-purchase', 'shareholder-agreement'],
  },
  {
    name: 'Data Protection & Compliance',
    docs: ['data-processing-agreement', 'privacy-policy', 'terms-of-service'],
  },
]

const DOCS = [
  { id: 'privacy-policy', icon: <Lock size={18} weight="duotone" color="currentColor" />, name: 'Privacy Policy', desc: 'Required for any app, website or service that collects user data.', time: '2 min', popular: true },
  { id: 'terms-of-service', icon: <ClipboardText size={18} weight="duotone" color="currentColor" />, name: 'Terms of Service', desc: 'Define the rules users must agree to when using your product.', time: '2 min', popular: true },
  { id: 'nda', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Non-Disclosure Agreement', desc: 'Protect confidential information shared with employees or partners.', time: '3 min', popular: false },
  { id: 'freelance-contract', icon: <PenNib size={18} weight="duotone" color="currentColor" />, name: 'Freelance Contract', desc: 'Set expectations, deliverables, and payment terms for client work.', time: '3 min', popular: false },
  { id: 'independent-contractor', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Independent Contractor Agreement', desc: 'Formally define the relationship between your business and contractors.', time: '3 min', popular: false },
  { id: 'hire-purchase', icon: <Car size={18} weight="duotone" color="currentColor" />, name: 'Hire Purchase Agreement', desc: 'Finance any asset — vehicle, equipment, machinery, with structured instalment payments.', time: '3 min', popular: true },
  { id: 'purchase-agreement', icon: <ShoppingCart size={18} weight="duotone" color="currentColor" />, name: 'Basic Purchase Agreement', desc: 'Document the one-time sale of goods, assets, or property between a buyer and seller.', time: '2 min', popular: false },
  { id: 'service-agreement', icon: <FileText size={18} weight="duotone" color="currentColor" />, name: 'Service Agreement', desc: 'Define scope, fees, and terms between a service provider and client — for any industry.', time: '3 min', popular: true },
  { id: 'consulting-agreement', icon: <CurrencyDollar size={18} weight="duotone" color="currentColor" />, name: 'Consulting Agreement', desc: 'Formalise advisory or consulting engagements with clear deliverables, rates and IP terms.', time: '3 min', popular: false },
  { id: 'employment-offer-letter', icon: <Briefcase size={18} weight="duotone" color="currentColor" />, name: 'Employment Offer Letter', desc: 'Professionally extend a job offer with salary, benefits, start date and terms clearly documented.', time: '3 min', popular: true },
  { id: 'non-compete-agreement', icon: <Shield size={18} weight="duotone" color="currentColor" />, name: 'Non-Compete Agreement', desc: 'Protect your business by restricting employees or contractors from working with competitors.', time: '2 min', popular: false },
  { id: 'payment-terms-agreement', icon: <CurrencyDollar size={18} weight="duotone" color="currentColor" />, name: 'Payment Terms Agreement', desc: 'Document agreed repayment schedules, due dates, and late penalty terms between buyer and seller.', time: '2 min', popular: false },
  { id: 'business-partnership', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Business Partnership Agreement', desc: 'Formally structure a business partnership — capital, profit sharing, roles and exit terms.', time: '4 min', popular: true },
  { id: 'joint-venture', icon: <MapTrifold size={18} weight="duotone" color="currentColor" />, name: 'Joint Venture Agreement', desc: 'Two companies joining forces for a specific project — ownership, management, and profit sharing.', time: '4 min', popular: false },
  { id: 'loan-agreement', icon: <CurrencyDollar size={18} weight="duotone" color="currentColor" />, name: 'Loan Agreement', desc: 'Document personal or business loans — amount, interest, repayment schedule, and collateral.', time: '3 min', popular: true },
  { id: 'shareholder-agreement', icon: <ChartBar size={18} weight="duotone" color="currentColor" />, name: 'Shareholder Agreement', desc: 'Define rights between company shareholders — voting, dividends, transfers, and protections.', time: '4 min', popular: false },
  { id: 'mou', icon: <Note size={18} weight="duotone" color="currentColor" />, name: 'Memorandum of Understanding (MOU)', desc: 'Document a formal understanding between two organisations before a full contract is signed.', time: '3 min', popular: true },
  { id: 'letter-of-intent', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Letter of Intent (LOI)', desc: 'Signal serious intent to acquire, invest, partner, or lease — before formal negotiations begin.', time: '3 min', popular: false },
  { id: 'distribution-agreement', icon: <FileText size={18} weight="duotone" color="currentColor" />, name: 'Distribution / Reseller Agreement', desc: 'Appoint distributors or resellers for your products — territory, exclusivity, margin and terms.', time: '3 min', popular: false },
  { id: 'supply-agreement', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Supply Agreement', desc: 'Contract between supplier and buyer for regular goods — pricing, delivery, quality and volume.', time: '3 min', popular: false },
  { id: 'business-proposal', icon: <Rocket size={18} weight="duotone" color="currentColor" />, name: 'Business Proposal', desc: 'Win clients with a professional proposal — problem, solution, deliverables, timeline and pricing.', time: '5 min', popular: true },
  { id: 'tenancy-agreement', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Tenancy Agreement', desc: 'Legally binding rental contract between landlord and tenant for any residential or commercial property.', time: '3 min', popular: true },
  { id: 'quit-notice', icon: <CurrencyDollar size={18} weight="duotone" color="currentColor" />, name: 'Quit Notice', desc: 'Formal notice to vacate a property — for expired tenancy, non-payment, or breach of terms.', time: '2 min', popular: false },
  { id: 'deed-of-assignment', icon: <Article size={18} weight="duotone" color="currentColor" />, name: 'Deed of Assignment', desc: 'Transfer property ownership from seller to buyer with full legal documentation.', time: '3 min', popular: true },
  { id: 'power-of-attorney', icon: <Scales size={18} weight="duotone" color="currentColor" />, name: 'Power of Attorney', desc: 'Legally authorise another person to act on your behalf for property, financial, or business matters.', time: '3 min', popular: false },
  { id: 'landlord-agent-agreement', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: 'Landlord & Agent Agreement', desc: 'Define terms between a property owner and their estate agent — commissions, duties, and authority.', time: '3 min', popular: false },
  { id: 'facility-manager-agreement', icon: <MapTrifold size={18} weight="duotone" color="currentColor" />, name: 'Facility Manager Agreement', desc: 'Formal contract between property owner and facility management company covering all services and fees.', time: '3 min', popular: false },
  { id: 'founders-agreement', icon: <Handshake size={18} weight="duotone" color="currentColor" />, name: "Founders' Agreement", desc: 'Define equity, roles, vesting, IP ownership and exit terms between co-founders before conflict arises.', time: '5 min', popular: true },
  { id: 'ip-assignment-agreement', icon: <LightbulbFilament size={18} weight="duotone" color="currentColor" />, name: 'IP Assignment Agreement', desc: 'Transfer intellectual property rights from a freelancer, employee or agency to your company.', time: '3 min', popular: false },
  { id: 'advisory-board-agreement', icon: <GraduationCap size={18} weight="duotone" color="currentColor" />, name: 'Advisory Board Agreement', desc: 'Onboard advisors and mentors with equity, vesting schedule, time commitment and confidentiality terms.', time: '4 min', popular: false },
  { id: 'vesting-agreement', icon: <TrendUp size={18} weight="duotone" color="currentColor" />, name: 'Vesting Agreement', desc: 'Document equity vesting schedules for founders and employees with cliff, acceleration and leaver terms.', time: '4 min', popular: false },
  { id: 'term-sheet', icon: <ClipboardText size={18} weight="duotone" color="currentColor" />, name: 'Investment Term Sheet', desc: 'Non-binding term sheet covering valuation, equity %, investor rights and conditions for angel/seed funding.', time: '5 min', popular: false },
  { id: 'safe-agreement', icon: <ShieldCheck size={18} weight="duotone" color="currentColor" />, name: 'SAFE Agreement', desc: 'Simple Agreement for Future Equity — the standard early-stage fundraising instrument. Valuation cap, discount, pro-rata.', time: '4 min', popular: false },
  { id: 'data-processing-agreement', icon: <Shield size={18} weight="duotone" color="currentColor" />, name: 'Data Processing Agreement (DPA)', desc: 'NDPA/GAID-compliant DPA — controller-processor roles, breach notification, cross-border transfers, data subject rights.', time: '5 min', popular: true },
]

// Build a lookup map for docs
const DOCS_MAP = {}
DOCS.forEach(d => { DOCS_MAP[d.id] = d })

const SOCIAL_PROOF = {
  advisor: {
    name: 'Riley-Ghiles',
    handle: '@Riley_Ikni',
    role: 'Startup Advisor · 10k+ weekly readers',
    text: 'Freelancers, tired of wasting hours drafting contracts — or scared of making a costly mistake? Fear no more.',
    url: 'https://x.com/Riley_Ikni',
    date: 'April 2026',
  },
  // stats array removed — unused (never rendered) and contained a hardcoded
  // price that conflicted with tiered pricing. Re-add with dynamic values
  // (pricing.display) when you next render it.
}

const FAQS = [
  {
    q: 'Is this document legally binding?',
    a: 'Yes — documents generated by Signova are based on real legal frameworks and established templates used by attorneys. They are enforceable in most jurisdictions. For high-stakes matters (litigation, complex IP, employment disputes), we recommend having an attorney review the final document.',
  },
  {
    q: 'What countries are supported?',
    a: 'Signova generates documents suitable for use globally — including the US, UK, Canada, Australia, EU, Nigeria, South Africa, Kenya, Ghana, India, Singapore, UAE, Brazil, Mexico, and more. During generation you specify your jurisdiction so the document is tailored accordingly. Documents follow local legal conventions and terminology.',
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

  // Regional pricing — server-detected, no client FX math.
  // Fallback to western-tier display ($14.99) while the edge function round-trips.
  // paystackAvailable is NG-only, not tier-wide — Kenya/Ghana/SA buyers do not
  // see a Paystack button even though they share the Africa USD tier.
  const [pricing, setPricing] = useState({
    tier: 'western',
    country: 'unknown',
    priceUsd: 14.99,
    unitAmount: 1499,
    display: '$14.99',
    label: 'Standard',
    paystackAvailable: false,
  })
  useEffect(() => {
    let alive = true
    fetchUserPricing().then(p => { if (alive) setPricing(p) })
    return () => { alive = false }
  }, [])

  const quickPicks = getQuickPicks(pricing.country)

  // Nav state
  const [navOpen, setNavOpen] = useState(false)
  const closeNav = useCallback(() => setNavOpen(false), [])

  // FAQ state — pre-open #0 ("Is this legally binding?")
  const [openFaq, setOpenFaq] = useState(null)

  // Video lazy loading
  const [videoRef, videoVisible] = useLazyLoad({ threshold: 0.15 })
  const [videoPlaying, setVideoPlaying] = useState(false)

  // Currency-switcher UI retired — pricing is region-driven, server-side.
  // Document search & filter
  const [docSearch, setDocSearch] = useState('')
  const [showAllDocs, setShowAllDocs] = useState(false)
  const [productsOpen, setProductsOpen] = useState(false)
  const [openDocCategories, setOpenDocCategories] = useState([true, false, false, false]) // First category open by default on mobile

  // Scope Guard mini-demo
  const [scopeInput, setScopeInput] = useState('')

  // Lock body scroll when mobile nav is open
  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [navOpen])

  // Close nav on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && navOpen) setNavOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [navOpen])

  // Filter docs based on search
  const filteredDocs = docSearch.trim()
    ? DOCS.filter(d =>
        d.name.toLowerCase().includes(docSearch.toLowerCase()) ||
        d.desc.toLowerCase().includes(docSearch.toLowerCase()) ||
        d.id.toLowerCase().includes(docSearch.toLowerCase())
      )
    : DOCS

  // Nigerian-visitor compound price: show both Stripe USD and Paystack NGN
  // so Nigerian buyers see both rails and what each will charge.
  const navPriceLabel = pricing.paystackAvailable
    ? `${pricing.display} · ₦6,900`
    : pricing.display

  return (
    <div className="landing">
      <Helmet>
        <title>Signova — Professional Legal Documents for Freelancers, Landlords & Businesses | Free Preview</title>
        <meta name="description" content="Generate professional legal document templates in 3 minutes. 34 document types across global contexts. Free preview, tiered regional pricing, 30-day refund." />
        <meta name="keywords" content="legal document generator Nigeria, tenancy agreement Nigeria, NDA template, freelance contract, deed of assignment Nigeria, loan agreement template, business proposal template, MOU template, hire purchase agreement Nigeria, power of attorney Nigeria, employment offer letter, shareholder agreement, joint venture agreement, service agreement, distribution agreement, quit notice Nigeria, privacy policy generator, terms of service generator" />
        <link rel="canonical" href="https://www.getsignova.com/" />
        <link rel="alternate" hreflang="en" href="https://www.getsignova.com/" />
        <link rel="alternate" hreflang="x-default" href="https://www.getsignova.com/" />
        <link rel="preconnect" href="https://ipapi.co" />
        <link rel="dns-prefetch" href="https://ipapi.co" />
      </Helmet>

      {/* Skip to content link */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="nav" role="navigation" aria-label="Main navigation">
        <div className="nav-inner">
          <a href="/" className="logo" aria-label="Signova home">
            <span className="logo-mark" aria-hidden="true">S</span>
            <span className="logo-text">Signova</span>
          </a>

          {/* Region-based price indicator. Static display, driven by the
              server-detected tier from /api/v1/pricing/detect-region. No
              currency switcher — Stripe charges USD regardless of the
              visitor's currency, and showing a switchable non-USD amount
              would drift from what the user actually pays. Nigerian
              visitors additionally see ₦6,900 because Paystack charges
              that amount directly. */}
          <div className="currency-toggle" aria-label="Pricing for your region">
            <span
              className="currency-toggle-btn"
              title="Price shown for your region"
              aria-live="polite"
            >
              {navPriceLabel}
            </span>
          </div>

          {/* Nav links — simplified */}
          <div className={`nav-links ${navOpen ? 'open' : ''}`} role="menubar">
            <a href="/" onClick={closeNav} role="menuitem" aria-label="Home">Home</a>
            <a href="#how" onClick={closeNav} role="menuitem" aria-label="How Signova works">How it Works</a>
            <div
              className={`nav-dropdown ${productsOpen ? 'open' : ''}`}
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button
                type="button"
                className="nav-dropdown-trigger"
                onClick={() => setProductsOpen(o => !o)}
                aria-expanded={productsOpen}
                aria-haspopup="true"
              >
                Products <span aria-hidden="true">▾</span>
              </button>
              <div className="nav-dropdown-menu" role="menu">
                <a href="/scope-guard" onClick={closeNav} role="menuitem">Scope Guard <span className="nav-dropdown-sub">Detect scope creep</span></a>
                <a href="/whatsapp" onClick={closeNav} role="menuitem">Chat → Contract <span className="nav-dropdown-sub">Extract terms from WhatsApp</span></a>
              </div>
            </div>
            <a href="#pricing" onClick={closeNav} role="menuitem" aria-label="Pricing">Pricing</a>
            <a href="/trust" onClick={closeNav} role="menuitem" aria-label="Document trust and provenance">Trust</a>
            <a href="#faq" onClick={closeNav} role="menuitem" aria-label="Frequently asked questions">FAQ</a>
            <a href="/whatsapp" onClick={closeNav} className="nav-cta-link" role="menuitem" aria-label="Preview a document for free">Preview Free →</a>
          </div>

          <button
            className="hamburger"
            onClick={() => setNavOpen(o => !o)}
            aria-label={navOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={navOpen}
          >
            <span className={`ham-line ${navOpen ? 'open' : ''}`} aria-hidden="true" />
            <span className={`ham-line ${navOpen ? 'open' : ''}`} aria-hidden="true" />
            <span className={`ham-line ${navOpen ? 'open' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* ── Hero Section ───────────────────────────────────────────────── */}
      <section className="hero" id="main-content">
        <div className="hero-doc-pattern" aria-hidden="true">
          {['NDA','LEASE','CONTRACT','MOU','NDA','INVOICE','CONTRACT','DEED','NDA','LEASE'].map((t,i) => (
            <span key={i} className="hero-pattern-word">{t}</span>
          ))}
        </div>

        <div className="hero-two-col">
          {/* LEFT: headline + CTA */}
          <div className="hero-left">
            <h1 className="hero-title" fetchpriority="high">
              Don't start the work<br />
              <span className="hero-title-gold">until this is signed.</span>
            </h1>
            <p className="hero-sub">
              Paste the WhatsApp chat. Get a contract both sides can sign in 2 minutes. Built for Nigerian, UK, Kenyan, Ghanaian, South African, US, Canadian, Indian, and Commonwealth law. Full refund if it doesn't hold up.
            </p>

            <p className="hero-support-line">
              The average freelancer has lost $3,000 to deals that never got signed. Some have lost $47,000. Sign before you start.
            </p>

            <button
              className="btn-primary btn-large"
              onClick={() => { trackHeroCtaClick(); navigate('/whatsapp') }}
              aria-label="See your contract free"
            >
              See my contract (free) <span className="btn-arrow" aria-hidden="true">→</span>
            </button>

            {/* Guarantee strip — above the fold, below primary CTA */}
            <p className="hero-guarantee-strip">
              30-day refund · No account required · Full preview before paying · Works in 8 jurisdictions
            </p>

            {/* Social-proof / coverage strip — replaces the old emoji flag
                row + overclaim with an honest named list matching the 8
                jurisdictions we actually have statute coverage for (see
                lib/jurisdiction-context.js). */}
            <div className="hero-trust-below-cta">
              <div className="hero-proof-badge">
                <FileText size={14} weight="duotone" color="currentColor" style={{ verticalAlign: 'middle', marginRight: 4 }} /> {DOCS_GENERATED.toLocaleString()}+ documents signed · Nigerian, UK, Kenyan, Ghanaian, South African, US, Canadian, Indian law coverage · 30-day refund
              </div>
            </div>

            {/* Top 3 quick picks */}
            <div className="hero-top3">
              {quickPicks.slice(0, 3).map(d => (
                <button
                  key={d.id}
                  className="top3-card"
                  onClick={() => { trackDocSelected(d.id, 'top3'); navigate(`/generate/${d.id}`) }}
                  aria-label={`Generate ${d.name} for free`}
                >
                  <span className="top3-icon" aria-hidden="true">{d.icon}</span>
                  <span className="top3-name">{d.name}</span>
                  <span className="top3-go">Preview Free →</span>
                </button>
              ))}
            </div>

            <p className="hero-trust-line">
              Free preview · No account required · 30-day refund
            </p>
          </div>

          {/* RIGHT: animated proof — visual-only demo (not a primary CTA) */}
          <div
            className="hero-right"
            data-lazy-load
            aria-label="Live example: a WhatsApp chat becoming a contract"
          >
            <div className="hero-demo-label" aria-hidden="true">Live example</div>
            <div className="hero-demo-phone">
              <div className="hero-demo-bar">
                <span className="hero-demo-dot" aria-hidden="true" />
                <span className="hero-demo-dot" aria-hidden="true" />
                <span className="hero-demo-dot" aria-hidden="true" />
                <span className="hero-demo-app"><ChatCircle size={14} weight="duotone" color="currentColor" style={{ verticalAlign: 'middle', marginRight: 4 }} /> WhatsApp</span>
              </div>
              <div className="hero-demo-chat">
                <div className="hero-chat-them">We need a full website — 5 pages, blog, contact form. Budget $2,500.</div>
                <div className="hero-chat-me">Got it. Timeline and revisions?</div>
                <div className="hero-chat-them">3 weeks. 2 rounds included, extra revisions billed.</div>
                <div className="hero-chat-me">50% upfront, rest on delivery?</div>
              </div>
            </div>
            <div className="hero-demo-arrow" aria-hidden="true">↓ Signova extracts 9 terms</div>
            <div className="hero-demo-result">
              <span className="hero-result-icon" aria-hidden="true">✓</span>
              <div>
                <div className="hero-result-title">Freelance Contract ready</div>
                <div className="hero-result-sub">Client · Scope · Deliverables · Timeline · Payment · Revisions…</div>
              </div>
            </div>
            <button
              type="button"
              className="hero-demo-cta-link"
              onClick={() => navigate('/whatsapp')}
              aria-label="Try with your own chat"
            >
              Try with your own chat →
            </button>
          </div>
        </div>

        {/* All documents — searchable grid */}
        <div className="hero-picks-row" id="documents">
          <p className="all-docs-label">All 34 document types</p>

          {/* Search input */}
          <div className="doc-search-wrapper">
            <input
              type="search"
              className="doc-search-input"
              placeholder="Search documents..."
              value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              aria-label="Search documents"
            />
            {docSearch && (
              <button
                className="doc-search-clear"
                onClick={() => setDocSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Desktop: progressive disclosure — show 8 by default, expand to full list on demand */}
          {(() => {
            const visibleDocs = (docSearch.trim() || showAllDocs) ? filteredDocs : filteredDocs.slice(0, 8)
            const hiddenCount = filteredDocs.length - visibleDocs.length
            return (
              <>
                <div className="all-docs-grid">
                  {visibleDocs.map(doc => (
                    <button
                      key={doc.id}
                      className="all-doc-btn"
                      onClick={() => { trackDocSelected(doc.id, 'all_docs'); navigate(`/generate/${doc.id}`) }}
                      aria-label={`Generate ${doc.name}`}
                    >
                      <span aria-hidden="true">{doc.icon}</span> {doc.name}
                    </button>
                  ))}
                </div>
                {!docSearch && hiddenCount > 0 && (
                  <button
                    className="docs-show-all"
                    onClick={() => setShowAllDocs(true)}
                    aria-label={`Show all ${filteredDocs.length} document types`}
                  >
                    Show all {filteredDocs.length} document types →
                  </button>
                )}
                {!docSearch && showAllDocs && (
                  <button
                    className="docs-show-all"
                    onClick={() => setShowAllDocs(false)}
                    aria-label="Show fewer documents"
                  >
                    ↑ Show fewer
                  </button>
                )}
              </>
            )
          })()}
          {docSearch && filteredDocs.length === 0 && (
            <p className="doc-search-empty">No documents match "{docSearch}"</p>
          )}

          {/* Mobile: category accordion */}
          <div className="mobile-doc-accordion">
            {DOC_CATEGORIES.map((cat, idx) => {
              const catDocs = cat.docs
                .map(id => DOCS.find(d => d.id === id))
                .filter(Boolean)
                .filter(d => !docSearch || d.name.toLowerCase().includes(docSearch.toLowerCase()) || d.desc.toLowerCase().includes(docSearch.toLowerCase()))
              
              if (catDocs.length === 0) return null

              return (
                <div key={cat.name} className={`doc-category-accordion ${openDocCategories[idx] ? 'open' : ''}`}>
                  <button
                    className="doc-category-header"
                    onClick={() => {
                      const newState = [...openDocCategories]
                      newState[idx] = !newState[idx]
                      setOpenDocCategories(newState)
                    }}
                    aria-expanded={openDocCategories[idx]}
                  >
                    <span>{cat.name} ({catDocs.length})</span>
                    <span className="doc-category-chevron">{openDocCategories[idx] ? '▾' : '▸'}</span>
                  </button>
                  <div className="doc-category-body">
                    {catDocs.map(doc => (
                      <button
                        key={doc.id}
                        className="mobile-doc-btn"
                        onClick={() => { trackDocSelected(doc.id, 'mobile_cat'); navigate(`/generate/${doc.id}`) }}
                      >
                        <span aria-hidden="true">{doc.icon}</span>
                        <span className="mobile-doc-name">{doc.name}</span>
                        {doc.popular && <span className="mobile-doc-badge">Popular</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Stories section (loss-aversion proof) ─────────────────────── */}
      <section className="stories-section">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">Every freelancer has a story like this.</h2>
          </div>
          <div className="stories-grid">
            <div className="story-card">
              <div className="story-number">$47,000</div>
              <p className="story-body">Lagos developer. 3 months of work. Client ghosted. No contract.</p>
            </div>
            <div className="story-card">
              <div className="story-number">47 revisions</div>
              <p className="story-body">Nairobi designer. Logo project. No scope document. Agreed on a phone call.</p>
            </div>
            <div className="story-card">
              <div className="story-number">8 months</div>
              <p className="story-body">Accra consultant. Waited for $2,800. Nothing in writing said when payment was due.</p>
            </div>
          </div>
          <p className="stories-closing">It's not laziness. It's friction. Signova removes the friction.</p>
        </div>
      </section>

      {/* ── Video walkthrough (lazy loaded) ────────────────────────────── */}
      <section className="video-section" ref={videoRef}>
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">See it in action</p>
            <h2 className="section-title">From chat to signed contract — watch it happen</h2>
          </div>
          <div className="video-wrapper">
            {videoVisible ? (
              videoPlaying ? (
                <iframe
                  src="https://www.loom.com/embed/9a41b8a6f1654deab554c80a7d1ba891?autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true"
                  style={{ border: 'none' }}
                  allowFullScreen
                  allow="autoplay; fullscreen"
                  className="video-iframe"
                  title="Signova walkthrough video"
                  loading="lazy"
                />
              ) : (
                <button
                  className="video-poster"
                  onClick={() => setVideoPlaying(true)}
                  aria-label="Play Signova walkthrough video"
                >
                  <img
                    src="https://cdn.loom.com/sessions/thumbnails/9a41b8a6f1654deab554c80a7d1ba891-with-play.gif"
                    alt="Signova walkthrough video thumbnail"
                    className="video-thumbnail"
                    loading="lazy"
                  />
                  <div className="video-play-overlay" aria-hidden="true">
                    <span className="video-play-btn">▶</span>
                  </div>
                  <div className="video-caption">Watch the 60-second walkthrough — no sign-up required</div>
                </button>
              )
            ) : (
              <div className="video-placeholder-loading" aria-label="Video loading">
                <div className="video-skeleton" aria-hidden="true" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── WhatsApp feature banner ────────────────────────────────────── */}
      <section className="wa-banner-section">
        <div className="wa-banner-inner">
          <div className="wa-banner-left">
            <div className="wa-banner-badge">✉️ WhatsApp, iMessage, Telegram, email — paste any negotiation</div>
            <h2 className="wa-banner-title">Agreed terms in a chat or email? Paste it.</h2>
            <p className="wa-banner-body">
              We extract the agreed terms — names, amounts, dates, restrictions — and auto-fill your document in seconds. Works for tenancy agreements, loan agreements, freelance contracts and 31 more document types (34 total).
            </p>
            <button className="wa-banner-btn" onClick={() => navigate('/whatsapp')}>
              Turn your chat into a contract →
            </button>
          </div>
          <div className="wa-banner-right">
            <div className="wa-banner-chat" onClick={() => navigate('/whatsapp')} role="button" tabIndex={0} aria-label="Try WhatsApp extraction with this example" onKeyDown={e => e.key === 'Enter' && navigate('/whatsapp')}>
              <div className="wa-msg wa-msg-them">We need a full website — 5 pages, blog, contact form. Budget is $2,500.</div>
              <div className="wa-msg wa-msg-me">Got it. Timeline and revisions?</div>
              <div className="wa-msg wa-msg-them">3 weeks. 2 rounds included, extra revisions billed.</div>
              <div className="wa-msg wa-msg-me">50% upfront, rest on delivery?</div>
              <div className="wa-msg wa-msg-them">Agreed. I'll send the details now.</div>
              <div className="wa-msg wa-msg-me">Perfect — I'll send over the agreement before we start.</div>
            </div>
            <div className="wa-banner-arrow" aria-hidden="true">↓</div>
            <div className="wa-banner-result">
              <span className="wa-result-check" aria-hidden="true">✓</span>
              <span className="wa-result-text">9 fields auto-filled — Freelance Contract ready</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="how-section" id="how">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">The process</p>
            <h2 className="section-title">How Signova works — from chat to signed contract in 2 minutes</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', title: 'Paste the conversation', body: 'WhatsApp, iMessage, email — whatever channel the deal happened in. Paste it as-is.' },
              { n: '02', title: 'We extract what a court needs', body: 'Names, amounts, dates, scope, deliverables, timeline, payment terms, revisions, governing law. The 9 things a judge asks for when a deal goes sideways.' },
              { n: '03', title: 'Both sides sign before work starts', body: `Your pre-flight checklist for every freelance deal. ${pricing.paystackAvailable ? `${pricing.display} via card or ₦6,900 via Paystack` : pricing.display} when you're ready to download. Refund if it doesn't hold up.` },
            ].map(s => (
              <div key={s.n} className="step">
                <span className="step-num" aria-hidden="true">{s.n}</span>
                <div>
                  <h3 className="step-title">{s.title}</h3>
                  <p className="step-body">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scope Guard Section ────────────────────────────────────────── */}
      <section className="scope-guard-section" id="scope-guard">
        <div className="section-inner">
          <div className="scope-guard-card">
            <div className="scope-guard-left">
              <div className="scope-guard-badge"><Shield size={16} weight="duotone" color="currentColor" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Scope Guard — Free Tool</div>
              <h2 className="scope-guard-title">Client adding extras after you signed?</h2>
              <p className="scope-guard-body">
                Paste their message + your contract — detect scope creep instantly.
              </p>
              <a href="/scope-guard" className="scope-guard-btn">Try Scope Guard free →</a>
            </div>
            <div className="scope-guard-right">
              <label htmlFor="scope-guard-input" className="scope-guard-demo-label">Paste a client message to see Scope Guard in action</label>
              <textarea
                id="scope-guard-input"
                className="scope-guard-demo-input"
                placeholder={'"Can you also add a blog section? Should be quick."'}
                value={scopeInput}
                onChange={e => setScopeInput(e.target.value)}
                rows={3}
                aria-label="Paste a client message here"
              />
              <div className="scope-guard-demo-result">
                <div className="scope-example-msg" aria-hidden="true">"Can you also add a blog section? Should be quick."</div>
                <div className="scope-example-arrow" aria-hidden="true">↓ Scope Guard detects: <strong>scope creep</strong></div>
                <div className="scope-example-response" aria-hidden="true">Auto-drafts a change order with estimated hours and cost.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      <section className="testimonials-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">What people are saying</p>
            <h2 className="section-title">Built for the 2 a.m. WhatsApp deal.</h2>
          </div>

          <div className="testimonial-intro">
            <p>For the logo job agreed on a phone call.</p>
            <p>For the freelance gig that starts Monday without paperwork.</p>
            <p>For the tenancy agreement nobody wrote down.</p>
            <p className="testimonial-intro-emph">Lawyers charge $500 to do what Signova does in 2 minutes.</p>
          </div>

          <div className="advisor-quote-card">
            <div className="advisor-quote-mark" aria-hidden="true">"</div>
            <blockquote className="advisor-quote-text">{SOCIAL_PROOF.advisor.text}</blockquote>
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
                aria-label="View original post by Riley-Ghiles on X"
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
            <a href="https://x.com/Riley_Ikni" target="_blank" rel="noopener noreferrer" className="seen-on-link">X / Twitter</a>
            <span className="seen-on-divider" aria-hidden="true">·</span>
            <a href="/blog" className="seen-on-link">Signova Blog</a>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section className="pricing-section" id="pricing">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-label">Pricing</p>
            <h2 className="section-title">Simple, honest pricing</h2>
            <p className="section-subtitle">Start free. Pay only when you download.</p>
          </div>
          <div className="pricing-grid">

            {/* Free tier */}
            <div className="price-card">
              <div className="price-tier">Free Preview</div>
              <div className="price-amount">$0</div>
              <p className="price-desc">Try before you pay. No account, no card required.</p>
              <ul className="price-list">
                <li className="price-yes">5 free previews per month</li>
                <li className="price-yes">First 40% of document visible</li>
                <li className="price-yes">34 document types</li>
                <li className="price-yes">WhatsApp extraction</li>
                <li className="price-yes">Jurisdiction-aware documents across 18 jurisdictions</li>
                <li className="price-no">Download PDF</li>
                <li className="price-no">Full document visible</li>
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
                {pricing.display}
                <span className="price-per">/ doc</span>
              </div>
              <p className="price-region-caption">
                {pricing.paystackAvailable
                  ? 'Price shown for your region. Pay in NGN via Paystack (₦6,900) or USD via card.'
                  : 'Price shown for your region. Payment processed in USD.'}
              </p>
              <p className="price-desc">Pay once per document. No subscription. Yours to keep forever.</p>
              <ul className="price-list">
                <li className="price-yes">Clean PDF — no watermark</li>
                <li className="price-yes">Instant download</li>
                <li className="price-yes">34 document types</li>
                <li className="price-yes">Jurisdiction-aware content</li>
                <li className="price-yes">Pay by card or USDT crypto</li>
                <li className="price-yes">30-day money-back guarantee</li>
              </ul>
              <button className="btn-primary" onClick={() => navigate('/whatsapp')}>
                Generate now →
              </button>
              <p className="price-guarantee">30-day refund if not satisfied</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
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
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                >
                  <span>{item.q}</span>
                  <span className="faq-icon" aria-hidden="true">{openFaq === i ? '−' : '+'}</span>
                </button>
                <div
                  className="faq-answer"
                  id={`faq-answer-${i}`}
                  role="region"
                  hidden={openFaq !== i}
                >
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ──────────────────────────────────────────────────────── */}
      <section className="trust-section">
        <div className="section-inner">
          <div className="trust-grid">
            {[
              { icon: <Warning size={32} weight="duotone" color="currentColor" />, title: 'Ready in 3 minutes', body: 'From question to signed-ready PDF faster than a WhatsApp voice note.' },
              { icon: <Key size={32} weight="duotone" color="currentColor" />, title: 'Your data stays yours', body: "Nothing is saved to a database. Close the tab and it's gone." },
              { icon: <Globe size={32} weight="duotone" color="currentColor" />, title: 'Works in 8 jurisdictions', body: "Jurisdiction-aware documents for Nigeria, UK, US, Kenya, Ghana, South Africa, Canada, and India — not generic templates. Tailored to your country's laws." },
              { icon: <CreditCard size={32} weight="duotone" color="currentColor" />, title: 'Pay with card or crypto', body: 'Accepts all major cards and USDT. No restrictions — pay the way you already pay.' },
            ].map(t => (
              <div key={t.title} className="trust-item">
                <span className="trust-icon" aria-hidden="true">{t.icon}</span>
                <h3 className="trust-title">{t.title}</h3>
                <p className="trust-body">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="section-inner">
          <div className="cta-box">
            <h2 className="cta-title">Sign before you start. Every deal. Every time.</h2>
            <p className="cta-sub">
              Preview completely free. No account. No credit card. Pay only when you download the signed-ready PDF —{' '}
              {pricing.paystackAvailable
                ? `${pricing.display} via card or ₦6,900 via Paystack`
                : pricing.display}
              .
            </p>
            <p className="cta-sub">
              Built on Nigerian, UK, Kenyan, Ghanaian, South African, US, Canadian, and Indian legal frameworks. 30-day refund if it doesn't hold up.
            </p>
            <div className="cta-trust-strip">
              <span>Built on real legal frameworks</span>
              <span className="cta-trust-dot" aria-hidden="true">·</span>
              <span>Preview the full document before paying</span>
              <span className="cta-trust-dot" aria-hidden="true">·</span>
              <span>30-day refund, no questions</span>
            </div>
            <button
              className="btn-primary btn-large"
              onClick={() => navigate('/generate/nda')}
              aria-label="Preview a document for free"
            >
              Preview Free <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
            <div className="cta-payment-badges">
              <span className="cta-payment-badge">Visa</span>
              <span className="cta-payment-badge">Mastercard</span>
              <span className="cta-payment-badge">USDT</span>
              <span className="cta-payment-badge">Secure checkout</span>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter variant="signova" />

      {/* ── Mobile sticky CTA ──────────────────────────────────────────── */}
      <div className="mobile-sticky-cta" aria-label="Quick actions">
        <button
          className="btn-primary btn-sticky"
          onClick={() => navigate('/whatsapp')}
          aria-label="Paste chat to generate a contract"
        >
          Paste Chat to Start →
        </button>
      </div>
    </div>
  )
}
