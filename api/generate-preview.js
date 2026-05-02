// api/generate-preview.js
// Uses Claude Haiku 4.5 for server-gated previews.
// Rate limiting: Upstash Redis, 5 previews per IP per calendar month.
// Content gating: server truncates to first 40% before responding —
// locked body text never reaches the client.

import { createHash } from 'node:crypto'
import { parseBody } from '../lib/parse-body.js'
import { logError, logInfo } from '../lib/logger.js'
import { buildReceipt } from '../lib/doc-hash.js'
import { buildDpaSystemPrompt } from './v1/documents/clauses.js'
import { VALID_CODES } from './promo-redeem.js'
import { EXECUTION_FORMALITIES_CLAUSE } from '../lib/execution-formalities.js'

const MONTHLY_PREVIEW_LIMIT = 5

// Returns { count, limitResetAt } where limitResetAt is ISO string of
// start-of-next-month (UTC). Fails open on Redis error so a Redis outage
// never blocks preview generation.
async function checkRateLimit(ip, redisUrl, redisToken) {
  const now = new Date()
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const key = `preview:ratelimit:${ip}:${yearMonth}`

  let count
  try {
    const incrRes = await fetch(`${redisUrl}/incr/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}` },
    })
    if (!incrRes.ok) return { count: 0, limitResetAt: null }
    const data = await incrRes.json()
    count = data.result
  } catch {
    return { count: 0, limitResetAt: null }
  }

  if (count === 1) {
    // First request this month — set TTL so the key auto-expires at midnight UTC
    // on the first day of next month. Fire-and-forget; a missed EXPIRE just
    // means the key lingers a bit; it cannot over-count because the key name
    // contains the month.
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    const ttl = Math.ceil((endOfMonth - now) / 1000)
    await fetch(`${redisUrl}/expire/${encodeURIComponent(key)}/${ttl}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}` },
    }).catch(() => null)
  }

  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { count, limitResetAt: endOfMonth.toISOString() }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'

  // Parse body early so we can read email + promoCode for bypass checks
  // before touching Redis.
  const body = await parseBody(req)
  const { prompt, promoCode, email } = body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  // ── Bypass checks (cheapest first, no Redis hit) ──────────────────────────
  const founderEmails = (process.env.FOUNDER_BYPASS_EMAILS || '')
    .split(',').map(e => e.toLowerCase().trim()).filter(Boolean)
  const normalizedEmail = (email || '').toLowerCase().trim()
  const isFounder = normalizedEmail && founderEmails.includes(normalizedEmail)

  if (isFounder) {
    const emailHash = createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 8)
    logInfo('/generate-preview', { bypass: 'founder', email_hash: emailHash })
  }

  // Promo bypass: any valid, non-expired promo code skips the IP rate limit.
  // We check validity here without consuming the use count — that happens
  // separately in /api/promo-redeem when the user downloads.
  let isPromoBypass = false
  if (!isFounder && promoCode) {
    const upperCode = (promoCode || '').toUpperCase().trim()
    const promo = VALID_CODES[upperCode]
    if (promo && new Date() <= promo.expiresAt) {
      isPromoBypass = true
      logInfo('/generate-preview', { bypass: 'promo', code: upperCode })
    }
  }

  if (!isFounder && !isPromoBypass && redisUrl && redisToken) {
    const { count, limitResetAt } = await checkRateLimit(ip, redisUrl, redisToken)
    if (count > MONTHLY_PREVIEW_LIMIT) {
      return res.status(429).json({
        error: `You have used your ${MONTHLY_PREVIEW_LIMIT} free previews for this month.`,
        code: 'PREVIEW_CAP_REACHED',
        rateLimited: true,
        requires_payment: true,
        paid_generation_url: '/api/generate',
        promo_code_field_visible: true,
        retry_after_promo: true,
        limitResetAt,
        upgradeUrl: '/',
      })
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing Anthropic key' })

  const lower = prompt.toLowerCase()
  const isDpa = lower.includes('data processing agreement') || /\bdpa\b/.test(lower)

  // Equity-instrument detector — see api/generate.js for the rationale. The
  // preview uses the same triggering logic so the free preview is directionally
  // accurate before the user pays for the Claude Sonnet premium version.
  const isEquityDoc = lower.includes('safe agreement') || lower.includes('simple agreement for future equity')
    || lower.includes('term sheet') || lower.includes('shareholder agreement')
    || lower.includes('shareholders agreement') || lower.includes("shareholders' agreement")
    || lower.includes('vesting agreement') || lower.includes("founders' agreement")
    || lower.includes('founders agreement') || lower.includes('ip assignment')
    || lower.includes('advisory board agreement') || lower.includes('convertible note')

  // Doc-type detectors (parity with generate.js — preview uses the same
  // triggers so jurisdiction routing is consistent with the paid version).
  const isTenancyDoc = lower.includes('tenancy agreement') || lower.includes('rental agreement') || lower.includes('lease agreement')
  const isQuitNoticeDoc = lower.includes('quit notice') || lower.includes('notice to vacate') || lower.includes('notice to quit')
  const isDeedOfAssignmentDoc = lower.includes('deed of assignment')
  const isPowerOfAttorneyDoc = lower.includes('power of attorney')
  const isLandlordAgentDoc = lower.includes('landlord and agent') || lower.includes('landlord & agent') || lower.includes("landlord's agent")
  const isEmploymentDoc = lower.includes('employment offer') || lower.includes('offer letter')
    || lower.includes('independent contractor') || lower.includes('freelance contract')
    || lower.includes('consulting agreement') || lower.includes('contract of employment')
  const isNonCompeteDoc = lower.includes('non-compete') || lower.includes('non compete') || lower.includes('noncompete')
  // FIX 7: broadened (parity with generate.js)
  const isLoanDoc = /\b(loan agreement|credit agreement|personal loan|business loan|loan contract)\b/.test(lower)
  const isHirePurchaseDoc = lower.includes('hire purchase') || lower.includes('hire-purchase')
  const isCommercialDoc = lower.includes('distribution agreement') || lower.includes('distribution / reseller')
    || lower.includes('supply agreement') || lower.includes('reseller agreement')

  // ── Jurisdiction detection (parity with paid generate.js) ─────────────────
  // FIX 3 — scoped detection (mirror of generate.js). Detects every
  // jurisdiction except Nigeria from the labelled jurisdiction lines only.
  const govLawLine = (lower.match(/governing law:\s*([^\n]+)/) || [])[1] || ''
  const countryLine = (lower.match(/country:\s*([^\n]+)/) || [])[1] || ''
  const stateLine = (lower.match(/state:\s*([^\n]+)/) || [])[1] || ''
  const jurisdictionLine = (lower.match(/jurisdiction:\s*([^\n]+)/) || [])[1] || ''
  const incorpLine = (lower.match(/country of incorporation[^:]*:\s*([^\n]+)/) || [])[1] || ''
  const jurisdictionScope = `${govLawLine} ${countryLine} ${stateLine} ${jurisdictionLine} ${incorpLine}`
  const promptScopeRaw = (() => {
    const lines = prompt.split('\n')
    return lines.filter(l =>
      /^(Governing law|Country|State|Jurisdiction|Country of incorporation)/i.test(l)
    ).join(' ')
  })()

  const isNigeria = lower.includes('nigeria') || lower.includes('ndpa') || lower.includes('ndpc')
    || lower.includes('cama 2020') || lower.includes('isa 2025') || /\b(lagos|abuja|kano|ibadan|port harcourt)\b/.test(lower)
  const isExcludedLagosArea = isNigeria && (
    lower.includes('recovery of premises act') ||
    /\bikeja\s+gra\b/.test(lower) ||
    (/\bikoyi\b/.test(lower) && !lower.includes('lstl 2011')) ||
    (/\bvictoria\s+island\b/.test(lower) && !lower.includes('lstl 2011')) ||
    (/\bapapa\b/.test(lower) && !lower.includes('lstl 2011'))
  )
  const isLstlLagos = isNigeria && !isExcludedLagosArea && (
    lower.includes('lstl 2011') ||
    lower.includes('lagos state tenancy law') ||
    /\b(lekki|surulere|yaba|ajah|ikorodu|magodo|gbagada|ogudu|ojodu|ikate|agege|mushin|badagry|epe)\b/.test(lower)
  )
  const isKenya = /\bkenya|kenyan\b/.test(jurisdictionScope) ||
    /\b(nairobi|mombasa|kisumu|nakuru)\b/.test(jurisdictionScope) ||
    /\bcompanies act 2015|kenya data protection act\b/.test(jurisdictionScope)
  const isGhana = /\bghana|ghanaian\b/.test(jurisdictionScope) ||
    /\b(accra|kumasi|tema|takoradi)\b/.test(jurisdictionScope) ||
    /\bcompanies act 2019|act 992\b/.test(jurisdictionScope)
  const isSouthAfrica = /\bsouth africa|south african\b/.test(jurisdictionScope) ||
    /\b(johannesburg|cape town|durban|pretoria|sandton)\b/.test(jurisdictionScope) ||
    /\bpopia|companies act 71 of 2008\b/.test(jurisdictionScope)
  const isUK = /\bunited kingdom|england and wales|england & wales\b/.test(jurisdictionScope)
    || /\b(uk|u\.k\.)\b/.test(jurisdictionScope) || /\bbritish\b/.test(jurisdictionScope)
    || /\b(london|manchester|birmingham|edinburgh|glasgow|cardiff|belfast)\b/.test(jurisdictionScope)
    || /\bcompanies act 2006\b/.test(jurisdictionScope)
  const isQuebec = /\bqu[eé]bec\b/.test(jurisdictionScope) || /\blaw 25|bill 64\b/.test(jurisdictionScope) ||
    /\b(montr[eé]al|quebec city)\b/.test(jurisdictionScope)
  const isCanada = !isQuebec && (/\bcanada|canadian\b/.test(jurisdictionScope) ||
    /\b(ontario|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|northwest territories)\b/.test(jurisdictionScope) ||
    /\b(toronto|vancouver|calgary|edmonton|ottawa|mississauga|winnipeg|halifax|victoria|saskatoon|regina|hamilton)\b/.test(jurisdictionScope) ||
    /\bpipeda|casl|cbca\b/.test(jurisdictionScope))
  const isCalifornia = /\bcalifornia\b/.test(jurisdictionScope) || /\bccpa|cpra\b/.test(jurisdictionScope) ||
    /\b(san francisco|los angeles|san diego|san jose|sacramento|oakland|santa clara|palo alto|silicon valley)\b/.test(jurisdictionScope)
  const isUSA = !isCalifornia && (
    /\bunited states\b/.test(jurisdictionScope) ||
    /\b(USA|U\.S\.A\.|U\.S\.)\b/.test(promptScopeRaw) ||
    /\bdelaware|dgcl\b/.test(jurisdictionScope) ||
    /\b(alabama|alaska|arizona|arkansas|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(jurisdictionScope) ||
    /\b(nyc|new york city|chicago|houston|phoenix|philadelphia|dallas|austin|seattle|boston|miami|atlanta|denver|detroit|minneapolis|las vegas)\b/.test(jurisdictionScope)
  )

  const nigeriaClause = isNigeria && !isDpa
    ? '\n\nNIGERIAN JURISDICTION: Apply the Nigeria Data Protection Act 2023 (NDPA), NDPC GAID guidelines, CBN regulations, and CAMA 2020 where relevant. Include 72-hour breach notification to NDPC (s.41) and Cross-Border Transfer restrictions (s.43).'
    : ''
  const canadaClause = isCanada && !isDpa
    ? '\n\nCANADIAN JURISDICTION: Apply PIPEDA (privacy), CASL (commercial electronic messages), the applicable provincial Employment Standards Act, Competition Act and provincial Consumer Protection Acts. Use Canadian spelling and CAD currency. Name the specific province in governing-law clauses.'
    : ''
  const quebecClause = isQuebec && !isDpa
    ? '\n\nQUEBEC JURISDICTION: Apply Quebec Law 25, the Civil Code of Québec (reference CCQ articles), and the Charter of the French Language. Use CAD currency. Include a language-choice clause.'
    : ''
  const californiaClause = isCalifornia && !isDpa
    ? '\n\nCALIFORNIA JURISDICTION: Apply CCPA/CPRA, California Labor Code (non-competes void under Bus. & Prof. Code §16600 — do not include post-employment non-competes), CLRA for consumer terms. Name a specific California county for venue. Use USD.'
    : ''
  const usaClause = isUSA && !isDpa
    ? '\n\nUS JURISDICTION: Apply the UCC as adopted in the specified state, Restatement (Second) of Contracts, applicable state data-breach notification statute, CAN-SPAM Act for commercial email, and the Federal Arbitration Act. Draft non-competes narrowly; note states where they are void or restricted (CA, ND, OK). Use USD.'
    : ''

  // ── Equity / company-law clauses (scoped to equity docs only) ──────────────
  const nigeriaEquityClause = isEquityDoc && isNigeria
    ? '\n\nNIGERIAN COMPANY LAW: Apply CAMA 2020 — use "ordinary shares" and "preference shares" (NOT US "common/preferred stock"). Reference s.124 allotment, s.125 return of allotment to CAC within 15 days, s.128 pre-emption. Apply ISA 2025 private-placement exemption where applicable. Default governing law to Nigerian law (NOT Delaware). Include a dispute-resolution clause pointing to Nigerian courts or arbitration (seat: Lagos, under the Arbitration and Mediation Act 2023). Reference CAC registration number in parties block. Note Stamp Duties Act stamping obligation.'
    : ''
  const kenyaEquityClause = isEquityDoc && isKenya
    ? '\n\nKENYAN COMPANY LAW: Apply the Companies Act 2015 (Cap. 486) — reference s.327 allotment, s.334 return of allotment to Registrar within 1 month, s.338 pre-emption. Use "ordinary shares"/"preference shares". Apply Capital Markets Act private-placement exemption. Default governing law to Kenyan law, dispute resolution to Nairobi High Court or NCIA arbitration. Reference BRS company number. Denominate in KES.'
    : ''
  const ghanaEquityClause = isEquityDoc && isGhana
    ? '\n\nGHANAIAN COMPANY LAW: Apply the Companies Act 2019 (Act 992) — reference s.43, 45 (allotment), 46 (return within 28 days), 50 (pre-emption). Note Ghana has NO PAR VALUE shares — use "stated capital" terminology. Apply Securities Industry Act 2016 (Act 929) private-placement exemption. Default governing law to Ghanaian law, dispute resolution to Accra Commercial Division or GAAC arbitration. Reference Registrar-General company number. Denominate in GHS.'
    : ''
  const ukEquityClause = isEquityDoc && isUK
    ? '\n\nUK COMPANY LAW: Apply Companies Act 2006 — reference ss.549–551 (authority to allot), s.561 (pre-emption), s.617. Use "ordinary shares"/"preference shares". File SH01 within 1 month at Companies House. Apply UK Prospectus Regulation private-placement exemption (qualified/HNW investors). Default governing law to the laws of England and Wales, dispute resolution to English courts or LCIA arbitration. Reference Companies House number. Denominate in GBP. Note Stamp Duty / SDRT.'
    : ''
  const southAfricaEquityClause = isEquityDoc && isSouthAfrica
    ? '\n\nSOUTH AFRICAN COMPANY LAW: Apply the Companies Act 71 of 2008 — reference s.38 (allotment), s.39, s.40 (consideration), s.41 (director issuance approval), s.95 (securities register). Use no-par-value shares and reference contributed tax capital (CTC). Apply s.96 private-placement exemption. Default governing law to South African law, dispute resolution to Johannesburg/Gauteng High Court or AFSA arbitration. Reference CIPC registration number. Denominate in ZAR. Note SARB exchange-control considerations.'
    : ''
  const usEquityClause = isEquityDoc && (isUSA || isCalifornia) && !isNigeria && !isKenya && !isGhana && !isSouthAfrica && !isUK
    ? '\n\nUS COMPANY LAW: Default incorporation state is Delaware for SAFE — apply DGCL §§151–161. Use "common stock"/"preferred stock" (NOT UK "ordinary/preference shares"). Use the Y Combinator post-money SAFE v1.2 template as baseline unless pre-money is selected. Claim Regulation D Rule 506(b) or 506(c) federal securities exemption with Form D filed within 15 days. Default governing law to Delaware. Denominate in USD.'
    : ''
  const canadaEquityClause = isEquityDoc && isCanada && !isQuebec
    ? '\n\nCANADIAN COMPANY LAW: Apply CBCA (or OBCA / BCBCA depending on province) — reference CBCA s.25, 27, 42 (solvency test). Use "common shares"/"preferred shares". Apply NI 45-106 accredited-investor or private-issuer exemption; file Form 45-106F1 within 10 days. Default governing law to the specified province, dispute resolution to that province\'s Superior Court. Use Canadian spelling. Denominate in CAD.'
    : ''

  // ── Tier 1: Nigerian property / tenancy / land ────────────────────────────
  const nigeriaTenancyClause = (isTenancyDoc || isQuitNoticeDoc || isLandlordAgentDoc) && isNigeria
    ? '\n\nNIGERIAN TENANCY LAW: ' +
      (isExcludedLagosArea
        ? '*** EXCLUDED LAGOS AREA *** — Property is in Apapa / Ikeja GRA / Ikoyi / Victoria Island (LSTL 2011 s.1(3) excluded). MUST cite Recovery of Premises Act (Cap. R7 LFN 2004) as governing statute — NOT LSTL 2011. Jurisdiction: High Court of Lagos State. Common-law periodic-tenancy notice periods apply (one full period).'
        : isLstlLagos
          ? '*** LSTL 2011 APPLIES *** — Property is in Lagos outside the excluded areas. MUST cite "Lagos State Tenancy Law 2011 (Law No. 8 of 2011)" in the governing-law clause. Jurisdiction: Magistrate\'s Court (low rent) / High Court.'
          : 'Apply Lagos State Tenancy Law 2011 (except Apapa, Ikeja GRA, Ikoyi, Victoria Island — those under Recovery of Premises Act). For other states, use the equivalent state Tenancy Law or Recovery of Premises Act.') +
      ' Statutory notice periods (s.13 LSTL): weekly=1 week, monthly=1 month, quarterly=3 months, half-yearly=3 months, yearly=6 months. After expiry, serve 7-day owner\'s notice of intention to recover possession before court. Stamp Duty: 0.78% up to 7 yrs; tenancies over 3 yrs must be registered at state Lands Registry. LSTL s.4 caps advance rent at 1 yr (new tenant) / 6 months (sitting tenant). Caution deposit: held separately with receipt on collection; LSTL s.10 requires written account of deposit application every 6 months; refundable net of itemised deductions. LSTL s.5 rent receipts: landlord must issue receipt for every payment (date, parties, premises, amount, period covered). Rent increases must be reasonable (LSTL s.37, tenant may challenge in court); 6 months\' written notice required before lease expiry; no increases more than once every 2 years. Note Lagos State Tenancy Bill 2025 may tighten these rules.'
    : ''
  const nigeriaDeedClause = isDeedOfAssignmentDoc && isNigeria
    ? '\n\nNIGERIAN DEED OF ASSIGNMENT: Apply Land Use Act 1978 — Governor\'s consent required under s.22 for alienation. Reference C of O number in parties / property block. Stamp Duty 3% of consideration (Stamp Duties Act Sch. 1); register at state Lands Registry within 60 days. CGT Act s.2(1) applies at 10%. Lagos Form 1C for Governor\'s consent. Execute under seal with 2 witnesses (attestation: names, addresses, occupations).'
    : ''
  const nigeriaQuitNoticeClause = isQuitNoticeDoc && isNigeria
    ? '\n\nNIGERIAN QUIT NOTICE: State landlord, tenant, property, tenancy type, statutory period (LSTL s.13: weekly=1 wk, monthly=1 mo, quarterly=3 mo, half-yearly=3 mo, yearly=6 mo), expiry date, ground for determination. Warn user a 7-day owner\'s notice of intention to recover possession (Form E LSTL) is required before court action.'
    : ''
  const nigeriaPowerOfAttorneyClause = isPowerOfAttorneyDoc && isNigeria
    ? '\n\nNIGERIAN POWER OF ATTORNEY: Conveyancing Act 1881 s.8 — irrevocable only if given for valuable consideration AND expressed irrevocable, or coupled with interest. Illiterates Protection Act jurat required for unlettered donors. Register at state Lands/Probate Registry for real property. Stamp Duties Act dutiable. Execute before 2 witnesses. Enumerate authorised acts precisely.'
    : ''
  const nigeriaLandlordAgentClause = isLandlordAgentDoc && isNigeria
    ? '\n\nNIGERIAN LANDLORD/AGENT LAW: Estate Surveyors and Valuers (Registration) Act — only ESVARBON-registered surveyors may professionally manage property for reward. Reference ESVARBON number. Commission typically 5–10% of annual rent. LASRERA rules in Lagos. Lagos State Real Estate Transaction (Anti-Land Grabbing) Law 2016 — no self-help recovery. Rents held in designated client account.'
    : ''

  // ── Tier 1: Nigerian employment / labour ──────────────────────────────────
  const nigeriaEmploymentClause = isEmploymentDoc && isNigeria
    ? '\n\nNIGERIAN EMPLOYMENT LAW: Labour Act applies only to "workers" (manual/clerical/operational) per s.91 — not to managerial / professional staff who are governed by common-law contract. Labour Act s.7: written particulars within 3 months. s.11 minimum notice: <3 mo=1 day; 3 mo–2 yr=1 wk; 2–5 yr=2 wk; 5+ yr=1 mo. National Minimum Wage Act 2024: ₦70,000/month. Pension Reform Act 2014: 10% employer + 8% employee to RSA with PFA. NSITF 1% of payroll (Employee Compensation Act 2010). NHIA Act 2022 mandatory health insurance. NHF 2.5% of basic salary. PAYE graduated 7–24% with CRA. ITF 1% of payroll (5+ employees). Jurisdiction: National Industrial Court of Nigeria (exclusive — Const. s.254C).'
    : ''
  const nigeriaNonCompeteClause = isNonCompeteDoc && isNigeria
    ? '\n\nNIGERIAN NON-COMPETE LAW: Nordenfelt doctrine — restraints prima facie void unless reasonable scope, duration, geography. Legitimate protectable interest required: trade secrets, customer connection, goodwill. Typical enforceable: 6–12 months; 2+ years rarely upheld. Authorities: Koumoulis v Leventis Motors [1973] 9 NSCC 252; Awolowo-Dosunmu v Ogundipe [1988] 1 NWLR (Pt.71) 483. Prefer garden leave (paid). Include blue-pencil severance clause. Distinguish non-compete vs non-solicitation. Jurisdiction: NIC.'
    : ''

  // ── Tier 2: Nigerian financial / commercial ───────────────────────────────
  const nigeriaLoanClause = isLoanDoc && isNigeria
    ? '\n\nNIGERIAN LOAN LAW: Interest benchmark CBN MPR; non-bank lenders need Moneylender\'s Licence under state Moneylenders Laws. Stamp Duty 0.125% ad valorem (Stamp Duties Act Sch. 1). Secured: CAMA 2020 s.222 register charge at CAC within 90 days; movable property register under Secured Transactions in Movable Assets Act 2017. Penal-interest doctrine (Dunlop v New Garage) — distinguish compensatory vs penalty. Arbitration and Mediation Act 2023 (Lagos seat) for commercial.'
    : ''
  const nigeriaHirePurchaseClause = isHirePurchaseDoc && isNigeria
    ? '\n\nNIGERIAN HIRE PURCHASE: Hire Purchase Act 1965 + FCCPA 2018. s.3: written agreement with prescribed contents (cash price, HP price, instalments). s.7: hirer\'s right to terminate. s.9: owner cannot repossess without court order after hirer pays ≥½ HP price. Implied conditions (ss.4–5) cannot be excluded. FCCPA s.127 prohibits unfair contract terms. Jurisdiction: State High Court / FCCPT.'
    : ''
  const nigeriaCommercialClause = isCommercialDoc && isNigeria
    ? '\n\nNIGERIAN COMMERCIAL LAW (Distribution/Supply): State Sale of Goods Laws (implied terms ss.14–17). FCCPA 2018: unfair terms (s.127), anti-competitive agreements (ss.59–60), FCCPC review. Product liability under common law + FCCPA. SON MANCAP / SONCAP for regulated goods; NAFDAC for food/drugs/cosmetics. VAT 7.5% (Finance Act 2020). Nigeria not a CISG party. Jurisdiction: Federal High Court (IP/customs) or State High Court; arbitration under AMA 2023 Lagos seat.'
    : ''

  // ── Tier 2: UK general (non-equity, non-DPA) ──────────────────────────────
  const ukGeneralClause = isUK && !isDpa && !isEquityDoc
    ? '\n\nUK JURISDICTION: UK GDPR + Data Protection Act 2018. Employment Rights Act 1996: unfair dismissal after 2 yrs, s.86 notice (1 wk for 1mo–2yr; +1 wk per yr up to 12 wk), s.1 written particulars. National Minimum Wage Act 1998. Working Time Regulations 1998. Consumer Rights Act 2015 for B2C. Sale of Goods Act 1979 + Supply of Goods and Services Act 1982. Unfair Contract Terms Act 1977. Misrepresentation Act 1967. Arbitration Act 1996 (LCIA / London). Courts of England and Wales. GBP. British spelling.'
    : ''

  // ── Tier 3: Other jurisdictions general ──────────────────────────────────
  const kenyaGeneralClause = isKenya && !isDpa && !isEquityDoc
    ? '\n\nKENYAN JURISDICTION: Law of Contract Act Cap. 23 (English common law via Judicature Act Cap. 8). Employment Act 2007: written contract >3 mo, s.35 notice, unfair termination protection. Consumer Protection Act 2012. Data Protection Act 2019 (ODPC). Arbitration Act 1995 / NCIA. Employment and Labour Relations Court for employment. High Court Nairobi. KES.'
    : ''
  const ghanaGeneralClause = isGhana && !isDpa && !isEquityDoc
    ? '\n\nGHANAIAN JURISDICTION: Contracts Act 1960 (Act 25). Labour Act 2003 (Act 651): written contract >6 mo, s.17 notice (2 wk / 1 mo), s.20 15-day annual leave. Hire Purchase Act 1974 (NRCD 292). Sale of Goods Act 1962 (Act 137). Data Protection Act 2012 (Act 843). ADR Act 2010 (Act 798) / GAAC. High Court Accra Commercial Division. GHS.'
    : ''
  const southAfricaGeneralClause = isSouthAfrica && !isDpa && !isEquityDoc
    ? '\n\nSOUTH AFRICAN JURISDICTION: Roman-Dutch common law (no codified contract statute). Labour Relations Act 66/1995 + Basic Conditions of Employment Act 75/1997 + Employment Equity Act 55/1998. Consumer Protection Act 68/2008 (implied warranties s.56, unfair terms ss.48–52, 5-day cooling-off s.16). National Credit Act 34/2005. POPIA (Act 4/2013) for personal information. High Court divisions; Labour Court; CCMA; AFSA. ZAR.'
    : ''
  const canadaGeneralClause = isCanada && !isQuebec && !isDpa && !isEquityDoc
    ? '\n\nCANADIAN JURISDICTION (general): PIPEDA + provincial privacy (AB/BC/QC). Provincial ESAs (Ontario ESA 2000 / BC ESA / Alberta ESC) — specify province; notice typically 1 wk for 3 mo–1 yr, 2 wk for 1–3 yr, +1 wk/yr up to 8 wk (ON); severance pay ss.64–66 ESA for 5+ yr. Federally regulated: Canada Labour Code. Provincial Consumer Protection Acts. Provincial Sale of Goods Acts. CASL. Competition Act. Canadian spelling. CAD.'
    : ''
  const usGeneralClause = (isUSA || isCalifornia) && !isDpa && !isEquityDoc
    ? '\n\nUS JURISDICTION (general): UCC Article 2 goods; Restatement (Second) of Contracts. At-will employment (except Montana WDEA 1987). FLSA + state minimum wage. FTC Act §5 unfair/deceptive. State data-breach statutes (30–60 day notification). State privacy laws (CA CCPA/CPRA, VA, CO, CT, UT, TX + others). CAN-SPAM + TCPA. Non-competes void in CA/ND/OK/MN; narrow elsewhere. FAA (9 USC §§1–16). Name specific state. USD.'
    : ''

  // ── Tier 4: Kenya doc-type-specific (short) ──────────────────────────────
  const kenyaTenancyClause = (isTenancyDoc || isQuitNoticeDoc) && isKenya
    ? '\n\nKENYAN TENANCY LAW: Landlord and Tenant (Shops, Hotels and Catering Establishments) Act Cap. 301 for controlled business premises (Business Premises Rent Tribunal). Rent Restriction Act Cap. 296 for controlled residential. Land Registration Act 2012 s.38(d) — leases >5 years must be registered. Distress for Rent Act Cap. 293. Stamp Duty Act Cap. 480: 1% ad valorem. Controlled tenancies require 2 months notice (Cap. 301 Form A/B). Jurisdiction: BPRT or Environment and Land Court.'
    : ''
  const kenyaEmploymentClause = isEmploymentDoc && isKenya
    ? '\n\nKENYAN EMPLOYMENT LAW: Employment Act 2007 §9 written contract (illiterate employee: explain in known language). §10 written particulars within 2 months (NOT §35 — that is termination). §35 termination notice: daily=no notice / close of day; weekly=1 wk; bi-weekly=2 wk; monthly=28 days. Probation §42: ≤6 mo extendable once; 7 days probation notice. §36 pay in lieu. §28 annual leave: 21 working days. §30 sick leave: 7 full + 7 half after 2 months. §29 maternity: 3 months full pay. §45 unfair dismissal: valid reason + procedural fairness (s.41); remedies s.49 (up to 12 months gross). WIBA 2007 employer strict liability (96-month earnings basis for permanent disability). NSSF 2013: 6% + 6%. NHIF / SHIF 2023 mandatory health. Min wage via Wages Order (Labour Institutions Act). PAYE bands 10/25/30/32.5/35% + KES 2,400/mo relief. Jurisdiction: ELRC (exclusive).'
    : ''
  const kenyaNonCompeteClause = isNonCompeteDoc && isKenya
    ? '\n\nKENYAN NON-COMPETE: English common-law restraint-of-trade doctrine (Nordenfelt v Maxim Nordenfelt). Employment Act 2007 §5 prohibits post-termination restrictions except reasonable restraints. Must show legitimate protectable interest (trade secrets, customer connection); reasonable scope/duration/geography. Typical enforceable: 6–12 months. Blue-pencil severance clause recommended. Jurisdiction: ELRC.'
    : ''
  const kenyaPropertyClause = (isDeedOfAssignmentDoc || isPowerOfAttorneyDoc) && isKenya
    ? '\n\nKENYAN PROPERTY: Land Registration Act 2012 — all registered-land dispositions registered (LRA Form 3). Land Act 2012 + Land Control Act Cap. 302 consent for agricultural land. Stamp Duty Act Cap. 480: 4% in municipalities, 2% rural (30 days). CGT 15% (Income Tax Cap. 470 Sch. 8). PoA under Registration of Documents Act Cap. 285 — attested and registered. Article 65 Constitution: non-citizen leaseholds capped at 99 years. Jurisdiction: Environment and Land Court.'
    : ''
  const kenyaLoanClause = isLoanDoc && isKenya
    ? '\n\nKENYAN LOAN LAW: Banking Act Cap. 488 (banking business reserved to CBK-licensed); Microfinance Act 2006; Digital Credit Providers register with CBK. CBR benchmark (MPC monthly). IN DUPLUM RULE: Banking Act s.44A — interest + charges in default cannot exceed principal. Movable Property Security Rights Act 2017 + Registry. Land charges under LRA 2012. Interest rate cap (2016) repealed by Finance Act 2019. Stamp Duty nominal on loan; 0.1% on secured. Jurisdiction: High Court Commercial Division.'
    : ''
  const kenyaCommercialClause = isCommercialDoc && isKenya
    ? '\n\nKENYAN COMMERCIAL LAW: Sale of Goods Act Cap. 31 (implied ss.14–17 from SGA 1893). Consumer Protection Act 2012 (unfair practices, 5-day cooling-off s.10). Competition Act 2010 (CAK: restrictive practices, merger control, dominance). KEBS Act: KS standards, PVoC for imports. Kenya NOT a CISG state. VAT 16%. Jurisdiction: High Court Nairobi; arbitration NCIA.'
    : ''

  // ── Tier 4: Ghana doc-type-specific (short) ──────────────────────────────
  const ghanaTenancyClause = (isTenancyDoc || isQuitNoticeDoc) && isGhana
    ? '\n\nGHANAIAN TENANCY LAW: Rent Act 1963 (Act 220) for controlled recoverable premises; Rent Control Department. Land Act 2020 (Act 1036) consolidates land law. Stamp Duty Act 2005 (Act 689): 0.5% of rent. Rent Act §25A advance-rent cap: max 6 months residential. Notice periods §17 Rent Act: weekly=1 wk, monthly=1 mo, yearly=3 mo. Jurisdiction: Rent Control Department / District Court / High Court.'
    : ''
  const ghanaEmploymentClause = isEmploymentDoc && isGhana
    ? '\n\nGHANAIAN EMPLOYMENT LAW: Labour Act 2003 (Act 651) §12 WRITTEN CONTRACT for employment 6+ months. §13 WRITTEN PARTICULARS (Schedule 1) within 2 months. §17 notice: 3+ yrs = 1 month (or 1 mo in lieu); under 3 yrs = 2 weeks; week-to-week = 7 days. §20 annual leave: 15 working days. §24 sick leave (medical cert.). §57 maternity: 12 weeks paid. §68 National Daily Minimum Wage via National Tripartite Committee (current gazette). §63 ordinary termination with notice; summary dismissal for serious misconduct + fair hearing. §65 redundancy: 4 weeks/yr customary minimum. National Pensions Act 2008 (Act 766): Tier 1 13.5% emp + 5.5% ee to SSNIT (inc. 2.5% NHIS); Tier 2 5% emp mandatory; Tier 3 voluntary. NHIA Act 2012 (Act 852). PAYE via GRA. Jurisdiction: National Labour Commission (§§140–142); High Court.'
    : ''
  const ghanaPropertyClause = (isDeedOfAssignmentDoc || isPowerOfAttorneyDoc) && isGhana
    ? '\n\nGHANAIAN PROPERTY: Land Act 2020 (Act 1036) — comprehensive reform replacing Conveyancing Act 1973, Land Registry Act 1962, Land Title Registration Law 1986. Registration at Lands Commission (Lands Commission Act 2008 Act 767). Stamp Duty Act 2005 (Act 689): 0.5% of consideration (30 days). CGT 15% (Income Tax Act 2015 Act 896 Sch. 3; primary-residence exemption). Customary land: stool/skin consent. PoA registered + stamped. Execution under seal + 2 witnesses. Jurisdiction: High Court Land Division Accra / Kumasi.'
    : ''
  const ghanaLoanClause = isLoanDoc && isGhana
    ? '\n\nGHANAIAN LOAN LAW: Borrowers and Lenders Act 2020 (Act 1052) — register at Collateral Registry (BoG) within 28 days; unregistered = unenforceable against 3rd parties (s.18). Banks and SDI Act 2016 (Act 930). Non-Bank FI Act 2008 (Act 774). BoG Policy Rate benchmark. Stamp Duty nominal / ad valorem (secured). Priority under Insolvency Act 2020 (Act 1015). Courts may strike unconscionable rates. Jurisdiction: High Court Commercial Division Accra; GAAC arbitration.'
    : ''

  // ── Tier 4: South Africa doc-type-specific (short) ───────────────────────
  const southAfricaTenancyClause = (isTenancyDoc || isQuitNoticeDoc) && isSouthAfrica
    ? '\n\nSA TENANCY LAW: Rental Housing Act 50/1999 — RHT jurisdiction. Rental Housing Regulations 2001 — deposit in interest-bearing account, refund within 14 days (21 if disputed) with itemised damages. CPA 68/2008 s.14: fixed-term 20-business-day cancellation notice + cancellation penalty; renewal notice 40–80 business days. PIE Act 19/1998: court order required for eviction (self-help criminal). NO stamp duty (abolished 2009). Deeds Registries Act 47/1937 s.77: long leases (>10 yrs) may be registered. Notice: CPA 20 bus days; commercial "reasonable in circumstances"; month-to-month = 1 month. Jurisdiction: RHT / Magistrate / High Court.'
    : ''
  const southAfricaEmploymentClause = isEmploymentDoc && isSouthAfrica
    ? '\n\nSA EMPLOYMENT LAW: BCEA 75/1997 §29 written particulars at commencement. §37 notice: 1 wk (≤6 mo); 2 wk (6 mo–1 yr); 4 wk (1+ yr or farm/domestic 6+ mo); must be same for both parties. Collective agreement may reduce 4 wk to min 2 wk. §38 payment in lieu. §20 annual leave: 21 consecutive days / 1 day per 17 days. §§22–23 sick leave: 30 days paid per 36-month cycle. §25 maternity: 4 months unpaid (UIF paid). §27 family responsibility: 3 days/cycle. LRA 66/1995 unfair dismissal; CCMA referral 30 days. UIF 1%/1% (ceiling R17,712/mo). Skills Development Levies 1%. COIDA workplace-injury. NMWA 9/2018 (current rate R27.58/hr 2024). EEA 55/1998 affirmative action for designated employers. POPIA for employee personal data. Jurisdiction: CCMA / Labour Court / Bargaining Council.'
    : ''
  const southAfricaNonCompeteClause = isNonCompeteDoc && isSouthAfrica
    ? '\n\nSA NON-COMPETE: DIFFERS from Commonwealth — restraint prima facie VALID (Magna Alloys v Ellis [1984] 4 SA 874 (A)); employee bears onus to prove unreasonableness. Basson v Chilwan [1993] 3 SA 742 (A) reasonableness test. Constitutional s.22 (right to trade) considered. Typical enforceable duration 12–24 months (longer than NG/KE because of pro-enforcement presumption). Courts READ DOWN unreasonable portions (Sasfin v Beukes). Jurisdiction: Labour Court / High Court.'
    : ''
  const southAfricaPropertyClause = (isDeedOfAssignmentDoc || isPowerOfAttorneyDoc) && isSouthAfrica
    ? '\n\nSA PROPERTY: Deeds Registries Act 47/1937 — all transfers registered at Deeds Office. Only admitted CONVEYANCERS may lodge. Transfer Duty Act 40/1949 sliding scale (first R1.1m nil, up to 13% above R11m); 6 months. VAT 15% replaces transfer duty where vendor is registered. FICA 38/2001 for accountable institutions. Alienation of Land Act 68/1981 s.2: sale of land must be in writing signed by parties. CGT (Income Tax Act 58/1962 Eighth Schedule; R2m primary-residence exclusion). Jurisdiction: High Court / Deeds Office.'
    : ''
  const southAfricaLoanClause = isLoanDoc && isSouthAfrica
    ? '\n\nSA LOAN LAW: NCA 34/2005 — credit provider registration with NCR; applies to natural persons + small juristic persons. s.81 affordability assessment (reckless credit = void). s.121 cooling-off 5 business days. s.103(5) IN DUPLUM RULE — accrued unpaid interest/fees cannot exceed principal balance. NCR Regulations set max interest rates per category over SARB Repo Rate. Usury Act 73/1968 largely superseded. FSRA 9/2017 twin peaks. Debt review Part D NCA. Mortgage bonds (Deeds Registries Act); notarial bonds (Act 57/1956). Jurisdiction: Magistrate\'s Court (NCA); High Court; NCT.'
    : ''

  // ── Tier 4: Nigeria commercial hygiene (NDA + general commercial) ────────
  // FIX 1: word-boundary regex (parity with generate.js); prevents India/Uganda/etc. false positives
  const isNdaDoc = lower.includes('non-disclosure agreement') || /\bnda\b/.test(lower)
  const isGeneralCommercialDoc = lower.includes('terms of service') || lower.includes('memorandum of understanding')
    || lower.includes(' mou') || lower.includes('letter of intent') || lower.includes(' loi ')
    || lower.includes('business partnership') || lower.includes('joint venture')
    || lower.includes('payment terms') || lower.includes('purchase agreement')

  const nigeriaNDAClause = isNdaDoc && isNigeria
    ? '\n\nNG NDA / CONFIDENTIALITY: NO standalone trade-secret statute in Nigeria. Protection via (a) contract, (b) equitable breach of confidence (Coco v Clark applied by NG courts), (c) implied duty in fiduciary/employment. NDPA 2023 applies where confidential info includes 3rd-party personal data (lawful basis s.25, subject rights s.34, cross-border s.43). NG authorities: Adetoun Oladeji v N.B. Plc [2007] 5 NWLR (Pt.1027) 415. Typical duration: 3–5 yrs general info; indefinite trade secrets. Non-solicitation subject to Nordenfelt reasonableness. Remedies: injunction / damages / account of profits / delivery-up. AMA 2023 (Lagos seat) for commercial NDAs. Stamp Duty nominal. Jurisdiction: Federal High Court (IP) or State High Court.'
    : ''
  const nigeriaCommercialGeneralClause = isGeneralCommercialDoc && isNigeria
    ? '\n\nNG COMMERCIAL/TRANSACTIONAL: CAMA 2020 s.746+ partnerships; business-name registration required (Part B Ch.2); JVs incorporated under CAMA 2020. NIPC Act for foreign JVs; Foreign Exchange (Monitoring and Miscellaneous Provisions) Act. Tax: CITA 30%/20%/0% by size (Finance Act 2020), VAT 7.5%, Withholding Tax 5–10%. FCCPA 2018 s.127 unfair terms + s.116 misleading conduct for consumer-facing. AMA 2023 for ADR (Lagos seat typical). Stamp Duties Act: agreements under hand nominal; ad valorem where consideration quantified. "Subject to contract" carve-out for non-binding LOI/MOU. Bills of Exchange Act for payment instruments. Jurisdiction: FHC (corporate/tax/IP/FX) or State HC; AMA 2023 arbitration.'
    : ''

  // ── Tier 4: US / Canada doc-type-specific (short) ────────────────────────
  const usEmploymentClause = isEmploymentDoc && (isUSA || isCalifornia)
    ? '\n\nUS EMPLOYMENT LAW: AT-WILL doctrine (exc. Montana WDEA 1987). FLSA min wage $7.25 (many states higher); OT 1.5x >40 hrs for non-exempt. Worker classification: IRS 20-factor / ABC test (CA/MA/NJ). W-2 vs 1099-NEC ≥$600/yr. State-specific: CA (Labor Code §2802 reimbursement, WARN, CalWARN, meal/rest, PAGA, SB 1162, §16600 non-compete void); NY (NYLL, NYSHRL, pay-transparency); TX (payday law); IL (BIPA); WA (non-compete restrictions); MA (non-compete garden-leave required §24L). COBRA 18 mo (20+ emp). FMLA 12 wk (50+ emp). ERISA for plans. Workers\' comp state-specific. I-9 within 3 days; E-Verify in some states. Jurisdiction: federal or state; EEOC.'
    : ''
  const canadaEmploymentClause = isEmploymentDoc && isCanada && !isQuebec
    ? '\n\nCANADIAN EMPLOYMENT LAW: Federal vs provincial split — federally regulated (banks/telcos/inter-provincial) under Canada Labour Code; else provincial ESA. ON ESA 2000 s.57 notice (1 wk for 3 mo–1 yr; 2 wk for 1–3 yr; +1 wk/yr to 8 wk); s.64 severance pay ($2.5M+ payroll + 5+ yr = 1 wk/yr to 26 wk). BC ESA s.63. COMMON-LAW REASONABLE NOTICE (Bardal factors: age, service, character of employment, availability of similar work) — typically ~1 mo/yr, capped ~24 mo. Waksdale [2020] ONCA 391: non-compliant for-cause clause voids without-cause clause. CPP 5.95% each to YMPE ($71,300); CPP2 4% to YAMPE ($81,200). EI 1.64% emp + 1.4x employer. Provincial health tax (ON/MB/BC). Stat holidays per province. Min wage per province (ON $17.20, BC $17.40, AB $15, federal $17.30). Human rights codes. Just cause high bar (McKinley v BC Tel). Jurisdiction: province Superior Court.'
    : ''
  const usCanadaPropertyClause = (isTenancyDoc || isQuitNoticeDoc) && (isUSA || isCalifornia || (isCanada && !isQuebec))
    ? '\n\nUS/CANADA TENANCY LAW: ' +
      (isCanada ? 'CANADA: Provincial RTA — ON RTA 2006 (LTB), BC RTA 2002 (RTB), AB RTA 2004. ON N12/N13 forms (60 days). Deposits: ON = last month rent only (no damage deposit); BC ≤ ½ first month + pet; AB ≤ 1 month. Human Rights Codes apply. PIPEDA for tenant data. ' : '') +
      (isUSA || isCalifornia ? 'US: State landlord-tenant law — CA Civ. Code §§1940–1954.05 + AB 1482 (CPI+5% rent cap, just-cause after 12 mo); NY RPL §220+ + NYC Rent Stab; TX Prop. Code Tit. 8; FL Fla. Stat. 83. Security deposits state-specific (CA 1 month unfurnished / 2 furnished post-AB 12 2024; NY 1 month). Implied warranty of habitability (Javins v First National Realty). Fair Housing Act 42 USC §3601+ + Bostock extensions. CA notice: 60 days if 1+ yr, else 30. Eviction via state court (unlawful detainer/FED); self-help illegal. ' : '') +
      'Jurisdiction: state L-T court or provincial RTB/LTB.'
    : ''

  // ── Tier 3: generic fallback for unmapped jurisdictions ──────────────────
  const hasKnownJurisdiction = isNigeria || isKenya || isGhana || isSouthAfrica || isUK
    || isQuebec || isCanada || isCalifornia || isUSA
  const genericFallbackClause = !hasKnownJurisdiction && !isDpa
    ? '\n\nJURISDICTION FALLBACK: No dedicated statute library. *** DO NOT DEFAULT TO CALIFORNIA / DELAWARE / U.S. LAW ***. Apply Commonwealth common-law contract principles (offer, acceptance, consideration, intention, capacity, legality). Use local currency. Name the most senior commercial court in the capital city for forum selection. Reference specific local statutes conservatively (e.g. "applicable labour law of [country]"). Include a cover note recommending local legal review.'
    : ''

  const isUsDocumentExplicit = isUSA || isCalifornia
  const antiUsDefaultClause = !isDpa && !isUsDocumentExplicit
    ? '\n\n*** DO NOT DEFAULT TO US / CALIFORNIA / DELAWARE LAW. *** The user has NOT selected a U.S. jurisdiction. Do not default governing law, venue, arbitration rules, or statute references to California, Delaware, New York, UCC, American Arbitration Association, or any U.S. court. Use only the user\'s selected jurisdiction, or English common-law principles + the user\'s country\'s highest court as a neutral baseline.'
    : ''

  const executionFormalitiesClause = !isDpa ? EXECUTION_FORMALITIES_CLAUSE : ''

  // FIX 2 — DPA jurisdiction routing (parity with generate.js).
  const dpaJurisdiction = isUK ? 'United Kingdom — UK GDPR / DPA 2018'
    : isCalifornia ? 'United States — CCPA/CPRA'
    : isQuebec ? 'Canada — Quebec Law 25'
    : isCanada ? 'Canada — PIPEDA'
    : isUSA ? 'United States — CCPA/CPRA'
    : isSouthAfrica ? 'South Africa — POPIA'
    : isKenya ? 'Kenya — Data Protection Act 2019'
    : isGhana ? 'Ghana — Data Protection Act 2012'
    : isNigeria ? 'Nigeria — NDPA 2023'
    : 'Commonwealth common-law privacy baseline'

  const systemContent = isDpa
    ? buildDpaSystemPrompt(dpaJurisdiction)
    : 'You are a legal document drafting assistant with deep knowledge of common-law (Nigeria, Kenya, Ghana, South Africa, Canada, US, UK), civil-law (Quebec), and the statutory regimes of each. Generate professional, comprehensive legal documents based on the user details provided. Use formal legal language with clear numbered sections. Use the spelling conventions of the governing jurisdiction. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.'
      + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause
      + nigeriaEquityClause + kenyaEquityClause + ghanaEquityClause + ukEquityClause + southAfricaEquityClause + usEquityClause + canadaEquityClause
      + nigeriaTenancyClause + nigeriaDeedClause + nigeriaQuitNoticeClause + nigeriaPowerOfAttorneyClause + nigeriaLandlordAgentClause
      + nigeriaEmploymentClause + nigeriaNonCompeteClause
      + nigeriaLoanClause + nigeriaHirePurchaseClause + nigeriaCommercialClause
      + ukGeneralClause + kenyaGeneralClause + ghanaGeneralClause + southAfricaGeneralClause + canadaGeneralClause + usGeneralClause
      + kenyaTenancyClause + kenyaEmploymentClause + kenyaNonCompeteClause + kenyaPropertyClause + kenyaLoanClause + kenyaCommercialClause
      + ghanaTenancyClause + ghanaEmploymentClause + ghanaPropertyClause + ghanaLoanClause
      + southAfricaTenancyClause + southAfricaEmploymentClause + southAfricaNonCompeteClause + southAfricaPropertyClause + southAfricaLoanClause
      + nigeriaNDAClause + nigeriaCommercialGeneralClause
      + usEmploymentClause + canadaEmploymentClause + usCanadaPropertyClause
      + genericFallbackClause
      + antiUsDefaultClause + executionFormalitiesClause

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6000,
        system: systemContent,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      let errMsg = 'Preview generation failed'
      try {
        const errBody = await response.json()
        errMsg = errBody.error?.message || errMsg
      } catch {
        try { errMsg = await response.text() } catch {}
      }
      logError('/generate-preview', { status: response.status, message: errMsg })
      return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
    }

    const data = await response.json()
    const text = data?.content?.[0]?.text || ''
    if (!text) return res.status(500).json({ error: 'Preview generation failed. Please try again.' })

    // Server-side content gating — truncate at 40% before responding.
    // The locked body text never leaves the server; only section headings
    // from the locked portion are sent so the overlay UI can list them.
    const allLines = text.split('\n')
    const cutoff = Math.floor(allLines.length * 0.4)
    const visibleText = allLines.slice(0, cutoff).join('\n')
    const lockedLines = allLines.slice(cutoff)
    const lockedSectionTitles = lockedLines
      .filter(l => l.startsWith('## ') || l.startsWith('### '))
      .map(l => l.replace(/^#{2,3}\s+/, '').trim())
    const lockedLineCount = lockedLines.length

    // Receipt hashes the full text (pre-truncation) so the paid regeneration
    // can be compared to the same fingerprint for audit purposes.
    const receipt = buildReceipt(text, { doc_tier: 'preview' })
    logInfo('/generate-preview', { success: true, text_length: text.length, locked_count: lockedLineCount, hash: receipt.fingerprint })
    return res.status(200).json({ text: visibleText, lockedSectionTitles, lockedLineCount, isPreview: true, receipt })
  } catch (err) {
    logError('/generate-preview', { message: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
  }
}
