// api/generate-preview.js
// Uses Groq (fast + near free) for watermarked previews
// Rate limiting: simple token bucket per IP, resets on cold start
// At current scale this is sufficient — add Redis when abuse is detected

import { parseBody } from '../lib/parse-body.js'
import { logError, logInfo } from '../lib/logger.js'
import { buildReceipt } from '../lib/doc-hash.js'
import { buildDpaSystemPrompt } from './v1/documents/clauses.js'

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_PER_WINDOW = 3

const ipStore = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = ipStore.get(ip)
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_PER_WINDOW) return true
  entry.count++
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    'unknown'

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'You have used your 3 free previews for this hour. Pay $4.99 to generate and download your document.',
      rateLimited: true,
    })
  }

  const body = await parseBody(req)
  const { prompt } = body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing GROQ key' })

  const lower = prompt.toLowerCase()
  const isDpa = lower.includes('data processing agreement') || lower.includes('dpa')

  // Equity-instrument detector — see api/generate.js for the rationale. The
  // preview uses shorter versions of the equity clauses but keeps the same
  // triggering logic so the free preview is directionally accurate before
  // the user pays for the Claude Sonnet premium version.
  const isEquityDoc = lower.includes('safe agreement') || lower.includes('simple agreement for future equity')
    || lower.includes('term sheet') || lower.includes('shareholder agreement')
    || lower.includes('shareholders agreement') || lower.includes("shareholders' agreement")
    || lower.includes('vesting agreement') || lower.includes("founders' agreement")
    || lower.includes('founders agreement') || lower.includes('ip assignment')
    || lower.includes('advisory board agreement') || lower.includes('convertible note')

  // Doc-type detectors (parity with generate.js — short preview uses the
  // same triggers but emits shorter clauses since Groq/Llama cap is tighter).
  const isTenancyDoc = lower.includes('tenancy agreement') || lower.includes('rental agreement') || lower.includes('lease agreement')
  const isQuitNoticeDoc = lower.includes('quit notice') || lower.includes('notice to vacate') || lower.includes('notice to quit')
  const isDeedOfAssignmentDoc = lower.includes('deed of assignment')
  const isPowerOfAttorneyDoc = lower.includes('power of attorney')
  const isLandlordAgentDoc = lower.includes('landlord and agent') || lower.includes('landlord & agent') || lower.includes("landlord's agent")
  const isEmploymentDoc = lower.includes('employment offer') || lower.includes('offer letter')
    || lower.includes('independent contractor') || lower.includes('freelance contract')
    || lower.includes('consulting agreement') || lower.includes('contract of employment')
  const isNonCompeteDoc = lower.includes('non-compete') || lower.includes('non compete') || lower.includes('noncompete')
  const isLoanDoc = lower.includes('loan agreement')
  const isHirePurchaseDoc = lower.includes('hire purchase') || lower.includes('hire-purchase')
  const isCommercialDoc = lower.includes('distribution agreement') || lower.includes('distribution / reseller')
    || lower.includes('supply agreement') || lower.includes('reseller agreement')

  // ── Jurisdiction detection (parity with paid generate.js) ─────────────────
  const isNigeria = lower.includes('nigeria') || lower.includes('ndpa') || lower.includes('ndpc')
    || lower.includes('cama 2020') || lower.includes('isa 2025') || /\b(lagos|abuja|kano|ibadan|port harcourt)\b/.test(lower)
  const isKenya = lower.includes('kenya') || lower.includes('kenyan') ||
    /\b(nairobi|mombasa|kisumu|nakuru)\b/.test(lower) ||
    lower.includes('companies act 2015') || lower.includes('kenya data protection act')
  const isGhana = lower.includes('ghana') || lower.includes('ghanaian') ||
    /\b(accra|kumasi|tema|takoradi)\b/.test(lower) ||
    lower.includes('companies act 2019') || lower.includes('act 992')
  const isSouthAfrica = lower.includes('south africa') || lower.includes('south african') ||
    /\b(johannesburg|cape town|durban|pretoria|sandton)\b/.test(lower) ||
    lower.includes('popia') || lower.includes('companies act 71 of 2008')
  const isUK = lower.includes('united kingdom') || lower.includes('england and wales') || lower.includes('england & wales')
    || /\b(uk|u\.k\.)\b/.test(lower) || lower.includes('british')
    || /\b(london|manchester|birmingham|edinburgh|glasgow|cardiff|belfast)\b/.test(lower)
    || lower.includes('companies act 2006')
  const isQuebec = /\bqu[eé]bec\b/.test(lower) || lower.includes('law 25') || lower.includes('bill 64') ||
    /\b(montr[eé]al|quebec city)\b/.test(lower)
  const isCanada = !isQuebec && (lower.includes('canada') || lower.includes('canadian') ||
    /\b(ontario|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|northwest territories)\b/.test(lower) ||
    /\b(toronto|vancouver|calgary|edmonton|ottawa|mississauga|winnipeg|halifax|victoria|saskatoon|regina|hamilton)\b/.test(lower) ||
    lower.includes('pipeda') || lower.includes('casl') || lower.includes('cbca'))
  const isCalifornia = lower.includes('california') || lower.includes('ccpa') || lower.includes('cpra') ||
    /\b(san francisco|los angeles|san diego|san jose|sacramento|oakland|santa clara|palo alto|silicon valley)\b/.test(lower)
  const isUSA = !isCalifornia && (
    lower.includes('united states') ||
    /\b(USA|U\.S\.A\.|U\.S\.)\b/.test(prompt) ||
    lower.includes('delaware') || lower.includes('dgcl') ||
    /\b(alabama|alaska|arizona|arkansas|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(lower) ||
    /\b(nyc|new york city|chicago|houston|phoenix|philadelphia|dallas|austin|seattle|boston|miami|atlanta|denver|detroit|minneapolis|las vegas)\b/.test(lower)
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
    ? '\n\nNIGERIAN TENANCY LAW: Apply Lagos State Tenancy Law 2011 (except Apapa, Ikeja GRA, Ikoyi, Victoria Island — those under Recovery of Premises Act). Statutory notice periods (§13 LSTL): weekly=1 week, monthly=1 month, quarterly=3 months, half-yearly=3 months, yearly=6 months. After expiry, serve 7-day owner\'s notice of intention to recover possession before court. Stamp Duty on tenancies: 0.78% up to 7 yrs; tenancies over 3 yrs must be registered at state Lands Registry. LSTL s.4 caps advance rent at 1 yr (new tenant) / 6 months (sitting tenant). Caution deposit refundable net of itemised deductions. Jurisdiction: Magistrate\'s Court (small claims) / State High Court.'
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

  // ── Tier 3: generic fallback for unmapped jurisdictions ──────────────────
  const hasKnownJurisdiction = isNigeria || isKenya || isGhana || isSouthAfrica || isUK
    || isQuebec || isCanada || isCalifornia || isUSA
  const genericFallbackClause = !hasKnownJurisdiction && !isDpa
    ? '\n\nJURISDICTION FALLBACK: No dedicated statute library for this jurisdiction — apply Commonwealth common-law contract principles (offer, acceptance, consideration, intention, capacity, legality). Use local currency. Reference the most senior commercial court in the capital for forum selection. Reference specific local statutes conservatively or generically (e.g. "applicable labour law of [country]"). Include a cover note recommending local legal review.'
    : ''

  const dpaJurisdiction = isCalifornia ? 'United States — CCPA/CPRA'
    : isQuebec ? 'Canada — Quebec Law 25'
    : isCanada ? 'Canada — PIPEDA'
    : isUSA ? 'United States — CCPA/CPRA'
    : 'Nigeria — NDPA 2023'

  const systemContent = isDpa
    ? buildDpaSystemPrompt(dpaJurisdiction)
    : 'You are a legal document drafting assistant with deep knowledge of common-law (Nigeria, Kenya, Ghana, South Africa, Canada, US, UK), civil-law (Quebec), and the statutory regimes of each. Generate professional, comprehensive legal documents based on the user details provided. Use formal legal language with clear numbered sections. Use the spelling conventions of the governing jurisdiction. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.'
      + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause
      + nigeriaEquityClause + kenyaEquityClause + ghanaEquityClause + ukEquityClause + southAfricaEquityClause + usEquityClause + canadaEquityClause
      + nigeriaTenancyClause + nigeriaDeedClause + nigeriaQuitNoticeClause + nigeriaPowerOfAttorneyClause + nigeriaLandlordAgentClause
      + nigeriaEmploymentClause + nigeriaNonCompeteClause
      + nigeriaLoanClause + nigeriaHirePurchaseClause + nigeriaCommercialClause
      + ukGeneralClause + kenyaGeneralClause + ghanaGeneralClause + southAfricaGeneralClause + canadaGeneralClause + usGeneralClause
      + genericFallbackClause

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 6000,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
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
    const text = data.choices?.[0]?.message?.content || ''
    if (!text) return res.status(500).json({ error: 'Preview generation failed. Please try again.' })

    // Advisory receipt for previews — the preview itself is not the final
    // document (that comes from /api/generate after payment), but returning
    // a hash lets clients show "fingerprint so far" in the UI and proves the
    // preview isn't mutated in transit.
    const receipt = buildReceipt(text, { doc_tier: 'preview' })
    logInfo('/generate-preview', { success: true, text_length: text.length, hash: receipt.fingerprint })
    return res.status(200).json({ text, isPreview: true, receipt })
  } catch (err) {
    logError('/generate-preview', { message: err.message, stack: err.stack })
    return res.status(500).json({ error: 'Preview generation failed. Please try again.' })
  }
}
