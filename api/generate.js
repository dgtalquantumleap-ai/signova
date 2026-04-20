// api/generate.js
// PAID ONLY — Uses Anthropic Claude for premium quality documents
// Verifies Stripe payment server-side before generating

import Stripe from 'stripe'
import { parseBody } from '../lib/parse-body.js'
import { logError, logWarn, logInfo } from '../lib/logger.js'
import { buildReceipt, renderProvenanceBlock, appendToAuditLog } from '../lib/doc-hash.js'
import { getRedis } from '../lib/redis.js'
import { buildDpaSystemPrompt } from './v1/documents/clauses.js'

// Redis helpers (Upstash REST API) — gracefully degrade if env vars are missing
async function redisGet(key) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const r = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    return json.result ?? null
  } catch {
    return null
  }
}

async function redisSet(key, ttlSeconds) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  try {
    await fetch(`${url}/set/${encodeURIComponent(key)}/1/ex/${ttlSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    // non-fatal
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = await parseBody(req)
  const { prompt, sessionId, oxapayTrackId, promoToken } = body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  // FIX 3: Prompt length limit
  if (prompt.length > 8000) {
    return res.status(400).json({ error: 'Prompt too long. Maximum 8000 characters.' })
  }

  if (!sessionId && !oxapayTrackId && !promoToken) {
    return res.status(403).json({
      error: 'Payment verification required. Use /api/generate-preview for free previews.',
    })
  }

  // Verify promo token if that's the auth method
  if (promoToken && !sessionId && !oxapayTrackId) {
    try {
      const verifyRes = await fetch(`https://${req.headers.host}/api/promo-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: promoToken }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok || !verifyData.valid) {
        return res.status(403).json({ error: 'Invalid or expired promo token.' })
      }
    } catch (promoErr) {
      logError('/generate', { message: 'Promo token verification failed', error: promoErr.message })
      return res.status(500).json({ error: 'Promo verification failed. Please try again.' })
    }
  }

  // FIX 1: OxaPay server-side verification
  if (oxapayTrackId) {
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY
    if (!merchantKey) {
      return res.status(500).json({ error: 'Server misconfigured — missing OxaPay merchant key' })
    }
    try {
      const oxaRes = await fetch('https://api.oxapay.com/merchants/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchantKey, trackId: oxapayTrackId }),
      })
      const oxaData = await oxaRes.json()
      if (oxaData.result !== 100) {
        logWarn('/generate', {
          message: `OxaPay inquiry failed for trackId ${oxapayTrackId}`,
          result: oxaData.result,
        })
        return res.status(403).json({ error: 'OxaPay payment verification failed.' })
      }
      if (oxaData.status !== 'Paid' && oxaData.status !== 'Confirming') {
        logWarn('/generate', {
          message: `OxaPay payment not complete for trackId ${oxapayTrackId}`,
          status: oxaData.status,
        })
        return res.status(403).json({
          error: `OxaPay payment not completed (status: ${oxaData.status}). Please complete payment first.`,
        })
      }
      logInfo('/generate', { message: `OxaPay payment verified for trackId ${oxapayTrackId}`, status: oxaData.status })
    } catch (oxaErr) {
      logError('/generate', { message: 'OxaPay payment verification failed', error: oxaErr.message })
      return res.status(500).json({ error: 'OxaPay payment verification failed. Please try again.' })
    }

    // FIX 2: Idempotency check for OxaPay
    const oxaRedisKey = `payment:used:oxapay:${oxapayTrackId}`
    const oxaUsed = await redisGet(oxaRedisKey)
    if (oxaUsed) {
      logWarn('/generate', { message: `OxaPay trackId already used: ${oxapayTrackId}` })
      return res.status(409).json({ error: 'This payment has already been used to generate a document.' })
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logWarn('/generate', { message: 'Redis unavailable — skipping idempotency check for OxaPay' })
    }
  }

  if (sessionId) {
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return res.status(500).json({ error: 'Server misconfigured — missing Stripe key' })
    }
    try {
      const stripe = new Stripe(stripeKey)
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.payment_status !== 'paid') {
        logWarn('/generate', { message: `Session ${sessionId} payment_status: ${session.payment_status}` })
        return res.status(403).json({
          error: `Payment not completed (status: ${session.payment_status}). Please complete payment first.`,
        })
      }
    } catch (verifyErr) {
      logError('/generate', { message: 'Stripe payment verification failed', error: verifyErr.message })
      return res.status(500).json({ error: 'Payment verification failed. Please try again.' })
    }

    // FIX 2: Idempotency check for Stripe
    const stripeRedisKey = `payment:used:stripe:${sessionId}`
    const stripeUsed = await redisGet(stripeRedisKey)
    if (stripeUsed) {
      logWarn('/generate', { message: `Stripe sessionId already used: ${sessionId}` })
      return res.status(409).json({ error: 'This payment has already been used to generate a document.' })
    }
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logWarn('/generate', { message: 'Redis unavailable — skipping idempotency check for Stripe' })
    }
  }

  // Payment verified — generate premium document with Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing Anthropic key' })

  const lower = prompt.toLowerCase()
  const isDpa = lower.includes('data processing agreement') || lower.includes('dpa')

  // Equity-instrument detector. Fires for SAFE, term sheet, shareholder,
  // founders', vesting, IP assignment, and advisory-board agreements — i.e.
  // documents where the applicable COMPANY LAW (CAMA, Companies Act, DGCL,
  // CBCA, etc.) materially changes the drafting, not just data-protection
  // statutes. Keeps the equity-law clauses below scoped to relevant docs so
  // e.g. a Nigerian NDA doesn't get spammed with SAFE-specific instructions.
  const isEquityDoc = lower.includes('safe agreement') || lower.includes('simple agreement for future equity')
    || lower.includes('term sheet') || lower.includes('shareholder agreement')
    || lower.includes('shareholders agreement') || lower.includes("shareholders' agreement")
    || lower.includes('vesting agreement') || lower.includes("founders' agreement")
    || lower.includes('founders agreement') || lower.includes('ip assignment')
    || lower.includes('advisory board agreement') || lower.includes('convertible note')

  // Document-type detectors for doc-type-specific jurisdiction clauses
  // (tenancy, deed of assignment, PoA, employment, non-compete, loan, hire
  // purchase, commercial). Each detector uses keywords that the Generator's
  // field summary is virtually guaranteed to include — the doc's display
  // name is sent as part of the prompt, so e.g. a tenancy-agreement prompt
  // always contains the literal string "Tenancy Agreement".
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

  // ── Jurisdiction detection ────────────────────────────────────────────────
  // Note: "USA"/"U.S."/"U.S.A." checked against ORIGINAL case (not lowered) to
  // avoid matching the pronoun "us" (e.g. "send us the draft").
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
    /\b(o\.n\.|bc|b\.c\.|ab|mb|sk|ns|nb|pei|yt|nt|nu)\b/.test(lower) ||
    lower.includes('pipeda') || lower.includes('casl') || lower.includes('cbca'))
  const isCalifornia = lower.includes('california') || lower.includes('ccpa') || lower.includes('cpra') ||
    /\b(san francisco|los angeles|san diego|san jose|sacramento|oakland|santa clara|palo alto|silicon valley)\b/.test(lower)
  const isUSA = !isCalifornia && (
    lower.includes('united states') ||
    /\b(USA|U\.S\.A\.|U\.S\.)\b/.test(prompt) ||  // original case — avoids pronoun "us"
    lower.includes('ucc ') || lower.includes('can-spam') || lower.includes('delaware') || lower.includes('dgcl') ||
    /\b(alabama|alaska|arizona|arkansas|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(lower) ||
    /\b(nyc|new york city|chicago|houston|phoenix|philadelphia|dallas|austin|seattle|boston|miami|atlanta|denver|detroit|minneapolis|las vegas)\b/.test(lower)
  )

  // ── Jurisdiction-specific enhancement clauses (for non-DPA docs) ──────────
  const nigeriaClause = isNigeria && !isDpa
    ? '\n\nIMPORTANT — NIGERIAN JURISDICTION: When the governing law is Nigeria, strictly apply the Nigeria Data Protection Act 2023 (NDPA), NDPC GAID guidelines, and CBN regulations where relevant. Include clauses for: Lawful Basis for data processing (NDPA Section 25), Data Subject Rights (Section 34), DPO designation requirements, 72-hour breach notification to the NDPC (Section 41), and Cross-Border Transfer restrictions (Section 43). Reference the Companies and Allied Matters Act (CAMA) 2020 for corporate governance matters.'
    : ''

  const canadaClause = isCanada && !isDpa
    ? '\n\nIMPORTANT — CANADIAN JURISDICTION: When the governing law is Canada (federal) or a common-law province, strictly apply: (i) the Personal Information Protection and Electronic Documents Act (PIPEDA) for all handling of personal information — Principles 4.1 (Accountability), 4.3 (Consent), 4.7 (Safeguards), 4.8 (Openness), 4.9 (Individual Access), and s.10.1 (Breach of Security Safeguards reporting to the OPC); (ii) Canada\'s Anti-Spam Legislation (CASL) for any commercial electronic messages — requires express or implied consent, clear sender identification, and an unsubscribe mechanism; (iii) the applicable provincial Employment Standards Act (Ontario ESA 2000, BC ESA, Alberta Employment Standards Code, etc.) for employment-related clauses — statutory minimums for notice of termination, vacation pay (4 % ON / 4–6 % BC), overtime, and holidays; (iv) the Competition Act and provincial Consumer Protection Acts for B2C agreements; (v) the Sale of Goods Act and the applicable provincial Business Corporations Act or CBCA for commercial dealings. Use Canadian spelling (cheque, cheque, labour, organisation). Denominate currency in CAD unless otherwise specified. Include a bilingual disclosure clause where the counterparty operates in Quebec. Jurisdiction and governing-law clauses should name the specific province and its courts.'
    : ''

  const quebecClause = isQuebec && !isDpa
    ? '\n\nIMPORTANT — QUEBEC JURISDICTION: Apply (i) Quebec Law 25 (Act respecting the protection of personal information in the private sector, as amended) — strict consent, Privacy by Default (s.9.1), Privacy Impact Assessments for transfers outside Quebec (s.17), right to data portability (s.27), right to de-indexing (s.28.1), automated decision review rights (s.12.1), and confidentiality incident notification to the CAI (s.3.5–3.8); (ii) the Civil Code of Québec (CCQ) for contract formation, obligations, and remedies — note Quebec is a civil-law jurisdiction, so reference articles of the CCQ rather than common-law doctrines; (iii) the Charter of the French Language — contracts of adhesion and standard-form contracts between a business and a consumer must be drawn up in French, and the French version prevails unless the parties expressly choose otherwise in a separate clause; (iv) the Act respecting labour standards for employment matters. Denominate currency in CAD. Include a language-choice clause: "The parties have expressly required that this Agreement and all related documents be drawn up in English. Les parties ont expressément exigé que la présente convention et tous les documents qui s\'y rattachent soient rédigés en anglais."'
    : ''

  const californiaClause = isCalifornia && !isDpa
    ? '\n\nIMPORTANT — CALIFORNIA JURISDICTION: Apply (i) CCPA/CPRA (Cal. Civ. Code §§1798.100–1798.199.100) for all handling of personal information of California residents — Right to Know, Right to Delete, Right to Correct, Right to Opt Out of Sale/Sharing, Right to Limit Use of Sensitive Personal Information, and the "Service Provider/Contractor" restrictions at §1798.140(ag); (ii) California Labor Code for employment (note: California generally prohibits non-compete clauses under Bus. & Prof. Code §16600 — do not include post-employment non-competes; narrow non-solicitation to customer lists that qualify as trade secrets under the CUTSA); (iii) California Consumer Legal Remedies Act (CLRA) for consumer-facing terms; (iv) California Commercial Code (UCC as adopted) for goods. Jurisdiction clauses should name California and specify the county (e.g., San Francisco, Los Angeles, Santa Clara) for venue. Denominate currency in USD.'
    : ''

  const usaClause = isUSA && !isDpa
    ? '\n\nIMPORTANT — UNITED STATES JURISDICTION: Apply (i) the Uniform Commercial Code (UCC) as adopted in the specified state for any sale-of-goods, secured transactions, or negotiable instruments clauses; (ii) the Restatement (Second) of Contracts for common-law contract doctrine; (iii) the applicable state data-breach notification statute (N.Y. Gen. Bus. Law §899-aa for New York, Tex. Bus. & Com. Code §521.053 for Texas, Fla. Stat. §501.171 for Florida, etc.) with typical 30–60 day notification windows; (iv) comprehensive state privacy laws where the counterparty handles resident data (Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA, Texas TDPSA — each has distinct consumer rights and sensitive-data handling requirements); (v) CAN-SPAM Act for commercial electronic messages; (vi) the Federal Arbitration Act (9 U.S.C. §§1–16) for arbitration clauses. Non-compete enforceability varies by state — draft narrowly (limited duration, geography, and legitimate protectable interest) and note states where non-competes are void or restricted (CA, ND, OK; narrowed in WA, IL, OR, CO, MA, etc.). Governing-law and forum-selection clauses should name the specific state and federal judicial district. Denominate currency in USD. Include federal arbitration and class-action waiver language where appropriate and permitted.'
    : ''

  // ── Equity / company-law jurisdiction clauses ──────────────────────────────
  // These fire only for equity instruments (SAFE, term sheet, shareholder,
  // founders', vesting, IP assignment, advisory board, convertible note) and
  // reference the applicable COMPANY LAW for each jurisdiction. Data-protection
  // clauses above handle privacy statutes; these handle share structures,
  // conversion mechanics, registration of allotment, and the right regulator.
  const nigeriaEquityClause = isEquityDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN COMPANY LAW FOR EQUITY INSTRUMENTS: This document concerns issuance of shares / equity rights in a Nigerian-incorporated entity. Strictly apply: (i) the Companies and Allied Matters Act (CAMA) 2020 — use CAMA terminology ("ordinary shares" and "preference shares" — NEVER US-style "common stock" or "preferred stock"). Reference sections 124 (allotment of shares), 125 (return of allotment, filed with the Corporate Affairs Commission (CAC) within 15 days of allotment), 128 (pre-emption rights), 141 (share capital increases), 165 (register of members). For conversion mechanics on the next equity round, require a board resolution, shareholders\' resolution where an increase in share capital is needed, and CAC filing within 15 days. (ii) the Investments and Securities Act (ISA) 2025 for private-placement exemptions — the Agreement should represent that the issuance is a private placement exempt from full SEC registration under ISA 2025, that the investor is a sophisticated or qualified investor, and that no public offering or advertisement has occurred. Reference the relevant SEC Rules on Private Placement. (iii) For governing law default to the Laws of the Federal Republic of Nigeria when Nigeria is the company\'s jurisdiction (NOT Delaware — explicitly reject US defaults). (iv) Dispute resolution: either courts of the Federal Republic of Nigeria (Lagos or Abuja Judicial Division of the Federal High Court / High Court) or arbitration under the Arbitration and Mediation Act 2023, seat in Lagos, administered by LCA / NCIA / ICC as specified. (v) Denominate amounts in Naira (NGN / ₦) or the currency specified, include a clause on CBN foreign-exchange controls if the investment is in USD and conversion or repatriation is contemplated. (vi) Certificate of Incorporation / CAC Registration Number must be stated in the parties block. (vii) Stamping: note that the Agreement is dutiable under the Stamp Duties Act and should be stamped at the FIRS within 30 days of execution.'
    : ''

  const kenyaEquityClause = isEquityDoc && isKenya
    ? '\n\nIMPORTANT — KENYAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 2015 (Cap. 486) — reference sections 327 (allotment of shares), 334 (return of allotment filed with the Registrar of Companies within 1 month), 338 (pre-emption rights), 344 (alteration of share capital), and Part XXIII for disclosure obligations. Use Kenyan terminology: "ordinary shares" and "preference shares" (not US "common/preferred stock"). For securities law, apply the Capital Markets Act (Cap. 485A) and Capital Markets (Securities) (Public Offers, Listing and Disclosures) Regulations — private placements to accredited investors are exempt under Regulation 21 of the 2002 Regulations. Default governing law to the Laws of Kenya, dispute resolution to the High Court of Kenya at Nairobi or arbitration under the Arbitration Act 1995 with NCIA seat. Reference Business Registration Service (BRS) registration number in parties block. Denominate in KES unless specified.'
    : ''

  const ghanaEquityClause = isEquityDoc && isGhana
    ? '\n\nIMPORTANT — GHANAIAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 2019 (Act 992) — reference sections 43 (power to issue shares), 45 (allotment of shares), 46 (return of allotment filed with the Registrar of Companies within 28 days), 50 (pre-emption rights), 75 (alteration of stated capital). Use Ghanaian terminology: Ghana abolished par value — shares are "no par value" and the Agreement references "stated capital" rather than authorised capital. For securities regulation apply the Securities Industry Act 2016 (Act 929) and SEC Ghana rules — private placements to qualified investors are exempt under section 109. Default governing law to the Laws of the Republic of Ghana, dispute resolution to the High Court at Accra (Commercial Division) or arbitration under the Alternative Dispute Resolution Act 2010 (Act 798), seat in Accra (GAAC). Reference Registrar-General\'s Department company registration number in parties block. Denominate in GHS unless specified.'
    : ''

  const ukEquityClause = isEquityDoc && isUK
    ? '\n\nIMPORTANT — UK COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 2006 — reference sections 549–551 (authority to allot), 561 (pre-emption rights), 617 (alteration of share capital), 561–577 (disapplication of pre-emption), and Part 17 generally. Use UK terminology: "ordinary shares" and "preference shares" (not US "common/preferred stock"). For securities regulation apply FSMA 2000 and the Prospectus Regulation — small-scale private placements to qualified / sophisticated / HNW investors are exempt from prospectus requirements under Article 1(4) of the UK Prospectus Regulation. File SH01 (return of allotment) with Companies House within 1 month. Default governing law to the laws of England and Wales (or Scotland / Northern Ireland if specified), dispute resolution to the courts of England and Wales or arbitration under the Arbitration Act 1996 with LCIA or London seat. Reference Companies House number in parties block. Denominate in GBP unless specified. Note HMRC Stamp Duty / SDRT obligations on share transfers.'
    : ''

  const southAfricaEquityClause = isEquityDoc && isSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 71 of 2008 — reference sections 38 (allotment), 39 (subscription for shares), 40 (consideration for shares), 41 (shareholder approval for issue of shares to directors or at a discount), 95 (securities register). Use South African terminology: "ordinary shares" / "preference shares", and note that "par value" shares were abolished for new companies — use "no par value" shares and CTC (contributed tax capital). For securities regulation apply the Financial Markets Act 19 of 2012 and the FSCA requirements — private placements to qualified investors under section 96 of the Companies Act are exempt from prospectus. Default governing law to the laws of the Republic of South Africa, dispute resolution to the High Court of South Africa (Gauteng or Western Cape Division) or arbitration under the Arbitration Act 42 of 1965 / AFSA rules, seat in Johannesburg. Reference CIPC registration number in parties block. Denominate in ZAR unless specified. Note SARB exchange-control considerations for cross-border investments.'
    : ''

  const usEquityClause = isEquityDoc && (isUSA || isCalifornia) && !isNigeria && !isKenya && !isGhana && !isSouthAfrica && !isUK
    ? '\n\nIMPORTANT — US COMPANY LAW FOR EQUITY INSTRUMENTS: Default incorporation state is Delaware for SAFE and startup documents unless the user specifies otherwise. Apply the Delaware General Corporation Law (DGCL) — reference §151 (classes and series of stock), §152 (issuance of capital stock), §153 (consideration for stock), §157 (rights and options), §161 (issuance of additional stock). Use US terminology: "common stock" and "preferred stock" (NOT UK/Commonwealth "ordinary/preference shares"). Use the most current Y Combinator post-money SAFE v1.2 template structure (September 2022) as a baseline unless a pre-money SAFE is explicitly selected. For federal securities law, claim Regulation D Rule 506(b) (or 506(c) if general solicitation is used) exemption from Securities Act registration, with a Form D filed with the SEC within 15 days of first sale. State Blue Sky notice filings may be required in each state where investors reside. Default governing law to Delaware (SAFE), jurisdiction and venue to state and federal courts in Delaware. Denominate in USD. For California companies, note that California may apply its own corporate-governance rules under Cal. Corp. Code §2115 for "quasi-California" corporations.'
    : ''

  const canadaEquityClause = isEquityDoc && isCanada && !isQuebec
    ? '\n\nIMPORTANT — CANADIAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Canada Business Corporations Act (CBCA) or the corresponding provincial Business Corporations Act (OBCA for Ontario, BCBCA for BC, ABCA for Alberta) — reference CBCA §25 (issue of shares), §27 (continuous disclosure of shares), §42 (solvency test for share issuance), §49 (share certificates). Use Canadian terminology: "common shares" and "preferred shares". For securities regulation apply the applicable provincial Securities Act (Ontario Securities Act, BC Securities Act, etc.) and National Instrument 45-106 — claim the "accredited investor" exemption (NI 45-106 §2.3), the "private issuer" exemption (§2.4), or the "offering memorandum" exemption (§2.9) as applicable. File Form 45-106F1 report of exempt distribution within 10 days. Default governing law to the laws of the specified Canadian province and the federal laws of Canada applicable therein, jurisdiction to that province\'s Superior Court of Justice. Use Canadian spelling (cheque, labour, organisation). Denominate in CAD unless specified.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 1 — NIGERIAN PROPERTY / REAL ESTATE clauses
  // ────────────────────────────────────────────────────────────────────────
  // Fires for tenancy-agreement and quit-notice when jurisdiction is Nigeria.
  // Without this clause, the prior nigeriaClause (which is data-protection
  // focused) would be the only Nigeria-specific guidance, producing tenancy
  // agreements that cite NDPA §25 but never mention Lagos State Tenancy Law.
  const nigeriaTenancyClause = (isTenancyDoc || isQuitNoticeDoc || isLandlordAgentDoc) && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN TENANCY LAW: Apply the following statutes and principles for Nigerian residential and commercial tenancies:\n' +
      '(i) LAGOS STATE TENANCY LAW 2011 applies to properties in Lagos State EXCEPT the high-value areas excluded by s.1(3): Apapa, Ikeja GRA (Government Reservation Area), Ikoyi, and Victoria Island — those excluded areas are governed by the Recovery of Premises Act (Cap. R7 LFN 2004) and the High Court rules. If the property is in Lagos but not in those excluded areas, reference the LSTL 2011 by name in the governing-law clause.\n' +
      '(ii) STATUTORY NOTICE PERIODS — Section 13 of the Lagos State Tenancy Law 2011 (and equivalent state Tenancy Laws) sets the MINIMUM notice periods which the parties cannot contract out of to the tenant\'s disadvantage:\n' +
      '     • Weekly tenancy — 1 week\'s notice\n' +
      '     • Monthly tenancy — 1 month\'s notice\n' +
      '     • Quarterly tenancy — 3 months\' notice\n' +
      '     • Half-yearly tenancy — 3 months\' notice\n' +
      '     • Yearly tenancy — 6 months\' notice\n' +
      '     After the quit notice expires and the tenant remains in possession, the landlord must serve a further 7-day STATUTORY OWNER\'S NOTICE OF INTENTION TO RECOVER POSSESSION before commencing court proceedings.\n' +
      '(iii) STAMP DUTY — Under the Stamp Duties Act (Cap. S8 LFN 2004) and Finance Act 2019, tenancy / lease agreements are dutiable at ad valorem rates (0.78% for tenancies up to 7 years, 3% for 7–21 years, 6% for 21+ years). Tenancies above 3 years must additionally be REGISTERED at the state Lands Registry to be enforceable against third parties.\n' +
      '(iv) CAUTION / SECURITY DEPOSIT — Must be refunded to the tenant within a reasonable time after the tenancy ends, minus only itemised deductions for unpaid rent or damage beyond fair wear and tear. Any deduction must be accounted for in writing.\n' +
      '(v) PROHIBITION OF ADVANCE RENT — Lagos State Tenancy Law 2011 s.4 prohibits a landlord from demanding or receiving more than one year\'s rent in advance from a new tenant (or more than 6 months from a sitting tenant). Draft payment-schedule clauses with this in mind.\n' +
      '(vi) LANDLORD\'S OBLIGATIONS (implied by s.7 LSTL): quiet enjoyment, keeping the property in a tenantable state, paying rates/taxes unless otherwise agreed. TENANT\'S OBLIGATIONS (s.8): pay rent, yield up in good repair (fair wear excepted), not to assign / sublet without consent.\n' +
      '(vii) GOVERNING LAW: name "the Laws of [State] of the Federal Republic of Nigeria" and specify the relevant Tenancy Law. Jurisdiction: Magistrate\'s Court for tenancy recovery in Lagos (s.47 LSTL) where the annual rent is below the jurisdictional limit, High Court otherwise.'
    : ''

  const nigeriaDeedClause = isDeedOfAssignmentDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN LAND / DEED OF ASSIGNMENT LAW: This document transfers an interest in land in Nigeria. Strictly apply:\n' +
      '(i) LAND USE ACT 1978 (Cap. L5 LFN 2004) — all land is vested in the Governor of the state in trust. A Statutory Right of Occupancy (evidenced by a Certificate of Occupancy / C of O) or a Customary Right of Occupancy cannot be alienated by assignment, mortgage, transfer or sublease WITHOUT the consent of the Governor under s.22 LUA. The Deed must include a condition subsequent or representation that Governor\'s consent will be procured. Any purported transfer without consent is inchoate (Savannah Bank v Ajilo [1989] 1 NWLR (Pt.97) 305).\n' +
      '(ii) CERTIFICATE OF OCCUPANCY — Reference the C of O number, date, file number, and registered survey plan number in the parties / property block. If no C of O yet issued (and the seller holds a deemed grant), state so and recite the root of title.\n' +
      '(iii) STAMP DUTY — Stamp Duties Act Schedule 1: Deed of Assignment is dutiable at 3% of the consideration, stamped at the Federal Inland Revenue Service (or state equivalent where applicable) within 30 days of execution. Unstamped deeds are inadmissible in evidence (s.22 SDA) until penalty paid.\n' +
      '(iv) REGISTRATION — Registration of Titles Act / State Land Instruments Registration Law: the Deed must be registered at the state Lands Registry, typically within 60 days of execution (varies by state). Unregistered instruments are pleaded only as receipts or memoranda of transaction, not as title.\n' +
      '(v) CAPITAL GAINS TAX — Capital Gains Tax Act s.2(1) imposes CGT at 10% on gains from disposal of chargeable assets (including land). Finance Act 2021 imposes CGT on disposal of shares above the de-minimis threshold. Recite in the consideration / warranties section.\n' +
      '(vi) LAGOS-SPECIFIC: Form 1C is the application for Governor\'s consent. The Lagos State Land Use Charge (2018, as amended) applies to the property post-transfer. Reference the Land Bureau and Office of the Surveyor-General.\n' +
      '(vii) EXECUTION FORMALITIES — Must be executed under seal (company: common seal or s.101 CAMA 2020 individual execution by two authorised signatories; individuals: signed, sealed and delivered before two witnesses). Attestation block with names, addresses, and occupations of witnesses is mandatory.\n' +
      '(viii) GOVERNING LAW — the Laws of [State] of the Federal Republic of Nigeria. Disputes to the High Court of the state where the land is situated (mandatory forum under s.39 Land Use Act and locus in quo).'
    : ''

  const nigeriaQuitNoticeClause = isQuitNoticeDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN QUIT NOTICE DRAFTING: A quit notice in Nigeria must STRICTLY comply with the statutory minimum notice period for the type of tenancy — contracting to a SHORTER period against the tenant is void to the extent of the shortening. Include a clear statement on the face of the notice of:\n' +
      '(a) the landlord\'s name, the tenant\'s name, and the property address;\n' +
      '(b) the TYPE of tenancy (weekly / monthly / quarterly / half-yearly / yearly);\n' +
      '(c) the REQUIRED STATUTORY PERIOD (Lagos State Tenancy Law 2011 s.13 / Recovery of Premises Act): weekly = 1 week; monthly = 1 month; quarterly = 3 months; half-yearly = 3 months; yearly = 6 months;\n' +
      '(d) the DATE the notice expires and the date the tenant must yield up possession;\n' +
      '(e) the ground for determination (expiry of term, breach of covenant, non-payment of rent — each has different downstream procedural consequences);\n' +
      '(f) a cautionary note that if the tenant remains in possession after expiry, a 7-day OWNER\'S NOTICE OF INTENTION TO RECOVER POSSESSION (Form E under LSTL) must be served before court action can be filed;\n' +
      '(g) signature of the landlord or their legal practitioner, with the practitioner\'s enrolment number where signed by a solicitor.\n' +
      'Do NOT abbreviate or compress the statutory period — if the tenancy is yearly and the landlord wants immediate possession, the notice must still run 6 months. The prompt must also warn the user that a defective notice restarts the clock.'
    : ''

  const nigeriaPowerOfAttorneyClause = isPowerOfAttorneyDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN POWER OF ATTORNEY LAW: Apply:\n' +
      '(i) CONVEYANCING ACT 1881 s.8 (still applicable to Lagos and states that have not re-enacted) — a Power of Attorney is irrevocable only where given for valuable consideration AND expressed to be irrevocable, or where coupled with an interest. Otherwise revocable at will by the donor.\n' +
      '(ii) ILLITERATES PROTECTION ACT (Cap. I6 LFN 2004) — where the donor cannot read or write English, an ILLITERATE JURAT must be endorsed by the writer of the deed, stating the deed was read over and explained to the donor in a language the donor understood, and that the donor appeared to understand it before making their mark. Mandatory for validity.\n' +
      '(iii) REGISTRATION — A Power of Attorney affecting land must be registered at the state Lands Registry (or Probate Registry in some states) to be effective against third parties. Time limits vary by state (typically 60 days).\n' +
      '(iv) STAMP DUTY — Stamp Duties Act Schedule 1: Power of Attorney is dutiable (flat rate for general PoA, ad valorem where coupled with consideration). Stamped at FIRS or state revenue.\n' +
      '(v) EXECUTION — Must be signed, sealed and delivered before TWO witnesses who sign and state their names, addresses, and occupations. Where the donor is a company, under CAMA 2020 s.101 (common seal or two authorised signatories).\n' +
      '(vi) SCOPE LIMITATION — A PoA is strictly construed; any authority not expressly or by necessary implication conferred is not granted. The drafted document must enumerate with precision each act the attorney is authorised to perform.\n' +
      '(vii) REVOCATION — Include express language on revocation (notice to the attorney, revocation deed, death / bankruptcy / insanity of donor automatically revokes unless irrevocable).\n' +
      'Governing law: the Laws of [State] of the Federal Republic of Nigeria. Jurisdiction: State High Court.'
    : ''

  const nigeriaLandlordAgentClause = isLandlordAgentDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN LANDLORD / AGENT LAW: Apply:\n' +
      '(i) ESTATE SURVEYORS AND VALUERS (REGISTRATION, ETC.) ACT (Cap. E13 LFN 2004) — only estate surveyors and valuers registered with the Estate Surveyors and Valuers Registration Board of Nigeria (ESVARBON) may professionally value, manage, or let real property for reward. A non-registered person acting as property manager commits an offence. Reference the agent\'s ESVARBON registration number in the parties block.\n' +
      '(ii) COMMISSION / AGENCY FEE — Professional practice and state guidelines typically cap commission at 5–10% of the annual rent for letting, and 5% of gross rental income for ongoing management. Lagos State guidelines (Lagos State Real Estate Regulatory Authority — LASRERA) specify maxima for registered agents. The Agreement should expressly state the commission basis, when it crystallises (on execution of tenancy / on receipt of rent), and VAT treatment (7.5% under Finance Act 2020).\n' +
      '(iii) LAGOS STATE REAL ESTATE TRANSACTION (ANTI-LAND GRABBING) LAW 2016 — criminalises forcible eviction, self-help, and land-grabbing. Where the agent is instructed to recover possession, the Agreement must REQUIRE the agent to use only the lawful recovery-of-premises procedure (quit notice + owner\'s notice + court order). Include an indemnity from landlord-to-agent against claims arising from the agent\'s adherence to this procedure.\n' +
      '(iv) CLIENT ACCOUNT — Rents collected by the agent on behalf of the landlord must be held in a separate designated client account, not mixed with the agent\'s own funds. Reference the ESVARBON Professional Rules of Conduct.\n' +
      '(v) DURATION AND TERMINATION — Typical agency is for one year, renewable. Termination on notice (typically 30 days) or for cause. Handover of rent receipts, tenancy records, and security deposits within a fixed period post-termination.\n' +
      'Governing law: the Laws of [State] of the Federal Republic of Nigeria.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 1 — NIGERIAN EMPLOYMENT clauses
  // ────────────────────────────────────────────────────────────────────────
  const nigeriaEmploymentClause = isEmploymentDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN EMPLOYMENT / LABOUR LAW: Apply:\n' +
      '(i) SCOPE — the Labour Act (Cap. L1 LFN 2004) applies only to "workers" as defined in s.91: manual, clerical, and operational staff. It does NOT apply to persons exercising administrative, executive, technical, or professional functions (i.e. most knowledge workers, managers, and professionals). For those outside the Labour Act, apply common-law contract principles and the specific contract terms. The drafted Agreement should state which regime applies based on the role.\n' +
      '(ii) WRITTEN PARTICULARS — Labour Act s.7: for covered workers, written particulars of employment must be furnished within 3 months of engagement, containing name, date of engagement, nature of employment, termination method, wages, etc.\n' +
      '(iii) MINIMUM NOTICE PERIODS — Labour Act s.11 minimum notice of termination (can be improved but not reduced in worker\'s favour): less than 3 months\' service = 1 day; 3 months to 2 years = 1 week; 2 years to 5 years = 2 weeks; 5+ years = 1 month. For non-Labour-Act staff, the contractual notice period (typically 1–3 months) governs.\n' +
      '(iv) NATIONAL MINIMUM WAGE ACT 2024 — National minimum wage ₦70,000 per month (effective 2024). Applies to all employers with 25+ employees.\n' +
      '(v) PENSION REFORM ACT 2014 (as amended 2019) — Mandatory Contributory Pension Scheme for all employers with 3+ employees: 10% employer + 8% employee of monthly emoluments (basic + housing + transport), remitted to a Pension Fund Administrator (PFA) on a Retirement Savings Account (RSA). Late remittance attracts penalty of 2% per month (PenCom guidelines).\n' +
      '(vi) EMPLOYEE COMPENSATION ACT 2010 — Employer must contribute 1% of total monthly payroll to the Nigeria Social Insurance Trust Fund (NSITF) for work-injury insurance. No deduction from employee.\n' +
      '(vii) NATIONAL HEALTH INSURANCE AUTHORITY ACT 2022 (repealed NHIS Act 1999) — Health insurance is now MANDATORY for all employers. Contribution via approved HMO.\n' +
      '(viii) NATIONAL HOUSING FUND ACT (Cap. N45 LFN 2004) — 2.5% of employee\'s basic monthly salary, deducted and remitted to the Federal Mortgage Bank of Nigeria. Applies where the employee earns above the minimum threshold.\n' +
      '(ix) PAYE — Personal Income Tax Act (as amended by Finance Acts 2019–2023). Graduated rates (7%–24%) on consolidated taxable income after Consolidated Relief Allowance (₦200,000 or 1% of gross income, whichever higher, plus 20% of gross). Employer withholds and remits monthly to the state Internal Revenue Service.\n' +
      '(x) INDUSTRIAL TRAINING FUND (ITF) Act — 1% of annual payroll for employers with 5+ employees OR ₦50m+ turnover.\n' +
      '(xi) GOVERNING LAW — Laws of [State] of the Federal Republic of Nigeria. Jurisdiction: National Industrial Court of Nigeria has exclusive jurisdiction over employment disputes under s.254C of the 1999 Constitution (as amended).\n' +
      '(xii) PROHIBITED CLAUSES — Nigerian public policy voids clauses that (a) contract out of statutory minimums, (b) impose forfeiture of accrued pension / terminal benefits, (c) impose a period of notice shorter than s.11 Labour Act for covered workers.'
    : ''

  const nigeriaNonCompeteClause = isNonCompeteDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN NON-COMPETE / RESTRAINT OF TRADE LAW: Apply the English common-law doctrine of restraint of trade, inherited by Nigeria:\n' +
      '(i) GENERAL PRINCIPLE — All covenants in restraint of trade are prima facie VOID as contrary to public policy (Nordenfelt v Maxim Nordenfelt Guns & Ammunition Co [1894] AC 535). They are enforceable only if the party seeking to enforce proves the restraint is reasonable as between the parties AND reasonable in the public interest.\n' +
      '(ii) ONUS — On the employer / covenantee to justify the restraint by reference to a LEGITIMATE PROTECTABLE INTEREST: (a) trade secrets and confidential information, (b) customer connection / client lists, (c) goodwill. Mere protection from ordinary competition is NOT a legitimate interest.\n' +
      '(iii) REASONABLENESS — assessed as to (a) scope (narrow activity definition beats broad industry ban), (b) duration (6–12 months is typical; 18–24 months faces scepticism; 3+ years rarely upheld), (c) geography (reasonable to the area where the employer has actual trade; a worldwide ban for a Lagos-only business will fail).\n' +
      '(iv) NIGERIAN AUTHORITY — Koumoulis v Leventis Motors Ltd [1973] 9 NSCC 252 (Supreme Court: restraint reasonable only where proportionate to protectable interest); Awolowo-Dosunmu v Ogundipe & Anor [1988] 1 NWLR (Pt.71) 483; Magbagbeola v Sanni [2002] 4 NWLR (Pt.756) 193; BENIB International v Fertinal [1993] 9 NWLR (Pt.319) 617.\n' +
      '(v) GARDEN LEAVE — A paid non-compete period (garden leave) where the employer continues to pay salary while restricting activity is more enforceable than an unpaid post-termination restraint.\n' +
      '(vi) CONSIDERATION — For a post-termination restraint to bind, fresh consideration or inclusion in the original employment contract is needed.\n' +
      '(vii) SEVERANCE CLAUSE — Include a blue-pencil clause permitting the court to sever unreasonable portions without voiding the whole.\n' +
      '(viii) NON-SOLICITATION — Narrower and more readily enforceable than a pure non-compete. Distinguish clearly in the drafted document between non-compete, non-solicitation of customers, and non-solicitation of employees.\n' +
      'Governing law: the Laws of [State] of the Federal Republic of Nigeria. Jurisdiction: National Industrial Court of Nigeria.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 2 — NIGERIAN FINANCIAL / COMMERCIAL clauses
  // ────────────────────────────────────────────────────────────────────────
  const nigeriaLoanClause = isLoanDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN LOAN / CREDIT LAW: Apply:\n' +
      '(i) INTEREST RATES — Not capped by statute for bank lenders, but governed by the Central Bank of Nigeria Monetary Policy Rate (MPR) as a reasonableness benchmark. For non-bank lenders, interest above a rate grossly in excess of market may be declared unconscionable / penal by the courts. Reference "the prevailing CBN Monetary Policy Rate" in the rate-setting clause if using a floating rate.\n' +
      '(ii) MONEYLENDERS LAWS — Each state has a Moneylenders Law (e.g. Lagos State Moneylenders Law, Cap. M8 LLN 2015). A person whose business includes lending at interest who is NOT a bank, microfinance bank, or cooperative MUST obtain a Moneylender\'s Licence. Lending without a licence renders the loan UNENFORCEABLE for the unlicensed lender (sections vary by state).\n' +
      '(iii) STAMP DUTY — Stamp Duties Act Schedule 1: Loan Agreement dutiable at 0.125% (ad valorem) of the principal. Unstamped = inadmissible until penalty paid.\n' +
      '(iv) SECURITY / CHARGES — If secured, CAMA 2020 s.222 requires registration of the charge at the Corporate Affairs Commission within 90 DAYS of creation (for corporate borrowers). Unregistered charges are void against the liquidator and creditors. For movable-property security, register under the Secured Transactions in Movable Assets Act 2017 (the Collateral Registry).\n' +
      '(v) USURY / UNCONSCIONABILITY — Nigerian courts will reopen a transaction where the interest or terms are grossly excessive (see Akinyemi v Odua Investment Co [2012] 17 NWLR (Pt.1329) 209). Include a savings clause disclaiming penal intent.\n' +
      '(vi) DEFAULT INTEREST — Distinguish between compensatory default interest (enforceable) and a penalty (void as in terrorem — Dunlop Pneumatic Tyre v New Garage [1915] AC 79 applied).\n' +
      '(vii) BVN / KYC — CBN Framework for BVN Operations requires collection of lender and borrower Bank Verification Numbers for loans above threshold.\n' +
      '(viii) GOVERNING LAW — Laws of the Federal Republic of Nigeria. Jurisdiction: Federal High Court (where CBN-regulated bank is lender) or State High Court. Dispute resolution: arbitration under the Arbitration and Mediation Act 2023 with Lagos seat is common for commercial loans.'
    : ''

  const nigeriaHirePurchaseClause = isHirePurchaseDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN HIRE PURCHASE LAW: Apply:\n' +
      '(i) HIRE PURCHASE ACT 1965 (Cap. H4 LFN 2004) — Nigeria\'s dedicated hire-purchase statute. Originally covered transactions with total price ≤ ₦2,000; subsequent state guidance and the Federal Competition and Consumer Protection Act 2018 (FCCPA) treat Hire Purchase Act protections as applicable generally for consumer transactions. The Agreement must comply whether or not the cap applies.\n' +
      '(ii) WRITTEN AGREEMENT — s.2 HPA: must be in writing and signed by the hirer (or their agent) and the owner. Copy must be delivered to the hirer within 14 days of signing.\n' +
      '(iii) PRESCRIBED CONTENTS — s.3 HPA: must state (a) hire-purchase price, (b) cash price, (c) amount of each instalment and due date, (d) description of the goods. Failure to include prescribed content makes the agreement UNENFORCEABLE by the owner against the hirer.\n' +
      '(iv) HIRER\'S RIGHT TO TERMINATE — s.7 HPA: hirer may terminate at any time before the final payment by (a) giving written notice and (b) returning the goods. Hirer\'s maximum liability on termination is limited by statute.\n' +
      '(v) OWNER\'S RIGHT TO REPOSSESS — s.9 HPA: after the hirer has paid half or more of the hire-purchase price ("statutory half"), the owner may NOT repossess without a court order. Repossession in breach of s.9 entitles the hirer to recover all sums paid.\n' +
      '(vi) IMPLIED CONDITIONS — ss.4, 5 HPA: implied conditions of owner\'s title, fitness for purpose, merchantable quality, correspondence with description. These cannot be contracted out of to the detriment of the hirer (s.8).\n' +
      '(vii) FCCPA 2018 — additional consumer protection: unfair-contract-terms prohibition (s.127), misleading conduct (s.116), implied warranties of quality and fitness (s.131).\n' +
      '(viii) COOLING-OFF — where the transaction is a "consumer credit" transaction, the FCCPA cooling-off provisions may apply (typically 5 business days).\n' +
      'Governing law: Laws of the Federal Republic of Nigeria. Jurisdiction: State High Court or Federal High Court (FCCPA-related claims to the FCCPT — Federal Competition and Consumer Protection Tribunal).'
    : ''

  const nigeriaCommercialClause = isCommercialDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN COMMERCIAL LAW (Distribution / Supply / Reseller): Apply:\n' +
      '(i) SALE OF GOODS LAW — Each Nigerian state has adopted the English Sale of Goods Act 1893 (e.g. Sale of Goods Law of Lagos State, Cap. S2 LLN 2015). Implied terms: s.14 title, s.15 description, s.16 merchantable quality and fitness for purpose, s.17 sample. For international sales, the United Nations Convention on Contracts for the International Sale of Goods (CISG) — Nigeria is NOT a party, so CISG applies only if expressly chosen as governing law.\n' +
      '(ii) FCCPA 2018 — Federal Competition and Consumer Protection Act: prohibits unfair contract terms (s.127), prohibits anti-competitive agreements including certain exclusive-dealing and resale-price-maintenance provisions (ss.59–60 read with the Merger Review Regulations), requires the FCCPC to review arrangements that lessen competition. Draft exclusivity and territory clauses with these in mind.\n' +
      '(iii) PRODUCT LIABILITY — Consumer Protection Act provisions and common-law duty of care (Donoghue v Stevenson line of authority). Manufacturer and distributor can both be liable for defective goods causing loss; include cross-indemnity and insurance clauses.\n' +
      '(iv) STANDARDS — Standards Organisation of Nigeria (SON) Act mandates Mandatory Conformity Assessment Programme (MANCAP) for specified goods; imported goods must have SONCAP (Standards Organisation of Nigeria Conformity Assessment Programme) certification. NAFDAC registration for regulated products (food, drugs, cosmetics, water).\n' +
      '(v) IMPORT / EXPORT CONTROLS — Nigerian Export Promotion Council Act, Customs & Excise Management Act, Pre-Shipment Inspection of Exports Act. Reference where cross-border trade is contemplated.\n' +
      '(vi) STAMP DUTY — Distribution / supply agreements dutiable at flat rate; ad valorem where a quantifiable value is stated.\n' +
      '(vii) VAT — Finance Act 2020: 7.5% VAT on taxable goods and services.\n' +
      '(viii) DISPUTE RESOLUTION — courts of the Federal Republic of Nigeria (Federal High Court for company / IP / customs disputes, State High Court otherwise) or arbitration under the Arbitration and Mediation Act 2023 with Lagos seat.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 2 — UK GENERAL clause for non-equity, non-DPA docs
  // ────────────────────────────────────────────────────────────────────────
  // Previously no general UK clause existed — UK non-equity docs got zero
  // UK-specific guidance. This fills that gap for NDAs, employment,
  // tenancy, service, commercial, consumer, and ToS.
  const ukGeneralClause = isUK && !isDpa && !isEquityDoc
    ? '\n\nIMPORTANT — UK JURISDICTION (general): Apply:\n' +
      '(i) DATA PROTECTION — UK GDPR (retained from EU GDPR by the European Union (Withdrawal) Act 2018 and amended by the Data Protection, Privacy and Electronic Communications (Amendments etc.) (EU Exit) Regulations 2019) together with the Data Protection Act 2018. ICO is the supervisory authority. 72-hour breach notification to the ICO; Data Subject Rights under Articles 15–22.\n' +
      '(ii) EMPLOYMENT — Employment Rights Act 1996 (unfair dismissal after 2 years\' qualifying service, statutory minimum notice periods (s.86 ERA: 1 week for 1 month–2 years\' service; 1 week per year thereafter, up to 12 weeks), written statement of particulars under s.1 ERA). National Minimum Wage Act 1998 and National Living Wage Regulations. Working Time Regulations 1998 (48-hour week, 28 days paid holiday).\n' +
      '(iii) CONSUMER — Consumer Rights Act 2015 for B2C (implied terms as to satisfactory quality, fitness for purpose, as described, digital content); Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 (14-day cancellation right for distance contracts).\n' +
      '(iv) COMMERCIAL SALES — Sale of Goods Act 1979 (implied terms under ss.12–15); Supply of Goods and Services Act 1982 (services reasonable skill and care under s.13, reasonable time s.14, reasonable charge s.15).\n' +
      '(v) UNFAIR TERMS — Unfair Contract Terms Act 1977 (controls exclusion of liability in B2B and consumer contracts); Misrepresentation Act 1967; common-law doctrines of penalty, mistake, frustration, and force majeure.\n' +
      '(vi) DISPUTES — Arbitration Act 1996 (modernising the English law of arbitration; seat of arbitration normally London with LCIA Rules or ICC Rules); Civil Procedure Rules. Reference the courts of England and Wales (or Scotland / Northern Ireland if specified) for jurisdiction.\n' +
      '(vii) GOVERNING LAW — default to "the laws of England and Wales" unless Scotland or Northern Ireland is specified. Denominate currency in GBP. Use British English spelling (organisation, labour, cheque, colour).'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 3 — KENYA / GHANA / SOUTH AFRICA / CANADA / US general clauses
  // (non-equity, non-DPA)
  // ────────────────────────────────────────────────────────────────────────
  const kenyaGeneralClause = isKenya && !isDpa && !isEquityDoc
    ? '\n\nIMPORTANT — KENYAN JURISDICTION (general): Apply:\n' +
      '(i) CONTRACT — Law of Contract Act (Cap. 23) — governed by English common law as received under the Judicature Act (Cap. 8). Requirement of writing for certain contracts under s.3 Law of Contract Act (guarantees, land, consideration).\n' +
      '(ii) EMPLOYMENT — Employment Act 2007 (Cap. 226A): written contract required for contracts exceeding 3 months (s.10), minimum notice periods under s.35 (28 days for monthly-paid, pro rata otherwise), unfair termination protection (ss.41–49), maternity leave (s.29, 3 months). Labour Institutions Act 2007. Work Injury Benefits Act 2007.\n' +
      '(iii) CONSUMER — Consumer Protection Act 2012 (No. 46 of 2012): protects consumers against unfair practices, misrepresentation, and unconscionable contracts; cooling-off period for direct sales.\n' +
      '(iv) DATA — Data Protection Act 2019 (No. 24 of 2019); Office of the Data Protection Commissioner.\n' +
      '(v) DISPUTES — High Court of Kenya at Nairobi (or relevant station); Commercial and Admiralty Division for commercial claims; Employment and Labour Relations Court for employment disputes. Arbitration Act 1995 (No. 4 of 1995) — NCIA (Nairobi Centre for International Arbitration) is the default institutional seat.\n' +
      '(vi) STAMP DUTY — Stamp Duty Act (Cap. 480): stamping required for specified instruments. Nominal for most commercial contracts.\n' +
      '(vii) GOVERNING LAW — "the Laws of the Republic of Kenya". Denominate in KES.'
    : ''

  const ghanaGeneralClause = isGhana && !isDpa && !isEquityDoc
    ? '\n\nIMPORTANT — GHANAIAN JURISDICTION (general): Apply:\n' +
      '(i) CONTRACT — Contracts Act 1960 (Act 25) — codification of common-law contract doctrine for Ghana; s.10 on capacity, s.25 on unenforceability of certain contracts unless written, s.26 on illegal contracts.\n' +
      '(ii) EMPLOYMENT — Labour Act 2003 (Act 651): written contract required for employment exceeding 6 months (s.12), minimum notice (2 weeks / 1 month based on wage period s.17), overtime (s.35), annual leave minimum 15 working days (s.20), National Labour Commission for dispute resolution.\n' +
      '(iii) HIRE PURCHASE — Hire Purchase Act 1974 (NRCD 292): prescribed contents, right to terminate, protection against repossession after part-payment.\n' +
      '(iv) CONSUMER / COMMERCIAL — Sale of Goods Act 1962 (Act 137) — implied conditions of title, fitness, quality. Protection Against Unfair Competition Act 2000.\n' +
      '(v) DATA — Data Protection Act 2012 (Act 843); Data Protection Commission.\n' +
      '(vi) DISPUTES — High Court (Commercial Division at Accra); Alternative Dispute Resolution Act 2010 (Act 798) — GAAC (Ghana Arbitration Centre) is the default institutional seat. Courts of Ghana.\n' +
      '(vii) GOVERNING LAW — "the Laws of the Republic of Ghana". Denominate in GHS.'
    : ''

  const southAfricaGeneralClause = isSouthAfrica && !isDpa && !isEquityDoc
    ? '\n\nIMPORTANT — SOUTH AFRICAN JURISDICTION (general): Apply:\n' +
      '(i) CONTRACT — Roman-Dutch common law (no codified contract statute). Requirements: consensus, capacity, lawfulness, possibility of performance, formalities where prescribed. General rule that contracts need not be in writing unless prescribed (sale of land under the Alienation of Land Act 68 of 1981 requires writing).\n' +
      '(ii) EMPLOYMENT — Labour Relations Act 66 of 1995 (collective bargaining, unfair dismissal, strikes); Basic Conditions of Employment Act 75 of 1997 (working time, leave, termination); Employment Equity Act 55 of 1998 (anti-discrimination, affirmative action); Occupational Health and Safety Act 85 of 1993. Unemployment Insurance Act 2001 and Unemployment Insurance Contributions Act 2002 (1% employer + 1% employee).\n' +
      '(iii) CONSUMER — Consumer Protection Act 68 of 2008: broad application, imposes implied warranties (s.56), prohibits unfair contract terms (ss.48–52), cooling-off right on direct marketing (s.16, 5 business days). Electronic Communications and Transactions Act 25 of 2002 for online.\n' +
      '(iv) CREDIT — National Credit Act 34 of 2005: applies to all credit agreements; affordability assessment, disclosure, cooling-off rights, interest caps under regulations.\n' +
      '(v) DATA — Protection of Personal Information Act 4 of 2013 (POPIA) — enforceable since 1 July 2021; Information Regulator. 8 conditions for lawful processing.\n' +
      '(vi) DISPUTES — High Court of South Africa (Gauteng, Western Cape, KwaZulu-Natal divisions for most commercial disputes); Magistrates\' Courts for claims below jurisdictional limit; Labour Court for employment; CCMA for conciliation/arbitration of statutory disputes. AFSA (Arbitration Foundation of Southern Africa) for commercial arbitration.\n' +
      '(vii) STAMPING — Stamp Duties Act was repealed in 2009; most transfer duties now governed by the Transfer Duty Act 40 of 1949.\n' +
      '(viii) GOVERNING LAW — "the Laws of the Republic of South Africa". Denominate in ZAR.'
    : ''

  const canadaGeneralClause = isCanada && !isQuebec && !isDpa && !isEquityDoc
    ? '\n\nIMPORTANT — CANADIAN JURISDICTION (general, non-equity): Apply:\n' +
      '(i) PRIVACY — PIPEDA (federal) for commercial activity in federally regulated sectors and inter-provincial; plus provincial privacy laws (Alberta PIPA, BC PIPA, Quebec Law 25). Breach of safeguards reporting to the OPC under PIPEDA s.10.1 (real risk of significant harm).\n' +
      '(ii) EMPLOYMENT — provincial Employment Standards Acts are the primary source (Ontario Employment Standards Act 2000 (ESA), BC Employment Standards Act, Alberta Employment Standards Code, etc.). Name the specific province in the governing-law clause. Statutory minimums: ESA Ontario notice = 1 week for 3 months–1 year, 2 weeks for 1–3 years, +1 week per year thereafter up to 8 weeks; severance pay under ss.64–66 ESA for 5+ years\' service in a ≥$2.5M-payroll employer. Federally regulated employers (banks, telcos, inter-provincial transport) use the Canada Labour Code instead of provincial ESAs.\n' +
      '(iii) CONSUMER — provincial Consumer Protection Acts (Ontario CPA 2002, BC Business Practices and Consumer Protection Act, Alberta Consumer Protection Act 2017). Prohibit unfair practices, mandate cooling-off rights for direct agreements.\n' +
      '(iv) COMMERCIAL — provincial Sale of Goods Acts (substantially similar across common-law provinces, based on the English SGA 1893). Competition Act (federal) for competition-related concerns. CASL for commercial electronic messages.\n' +
      '(v) DISPUTES — provincial Superior Court of Justice (Ontario), Supreme Court (BC / Alberta). Arbitration under provincial Arbitration Acts (Ontario Arbitration Act 1991, BC Arbitration Act 2020) or the Commercial Arbitration Act (federal) for federally regulated disputes.\n' +
      '(vi) SPELLING — Canadian English (labour, organisation, cheque, colour). Currency CAD.'
    : ''

  const usGeneralClause = (isUSA || isCalifornia) && !isDpa && !isEquityDoc
    ? '\n\nIMPORTANT — US JURISDICTION (general, non-equity): Apply:\n' +
      '(i) COMMERCIAL — Uniform Commercial Code (UCC) Article 2 (sale of goods, as adopted by the specified state). Restatement (Second) of Contracts for common-law doctrine. UCC Article 9 for secured transactions if applicable.\n' +
      '(ii) EMPLOYMENT — AT-WILL EMPLOYMENT doctrine applies in every state EXCEPT Montana (Montana Wrongful Discharge from Employment Act 1987). Limits: federal Title VII Civil Rights Act 1964, ADEA, ADA; state anti-discrimination laws; implied-contract and public-policy exceptions. IMMIGRATION: I-9 verification required. WAGE/HOUR: Fair Labor Standards Act (FLSA) federal minimum wage ($7.25 — higher in 30+ states; $16.50 CA 2025 for large employers; $15 NY 2025 metro; confirm rate against specified state).\n' +
      '(iii) CONSUMER / UNFAIR PRACTICES — FTC Act §5 (unfair or deceptive acts or practices) for federal; state consumer-protection statutes (e.g. California Consumers Legal Remedies Act, New York General Business Law §349).\n' +
      '(iv) DATA BREACH — state data-breach notification statutes (all 50 states + DC/territories have them; notification windows typically 30–60 days). Comprehensive state privacy laws applicable where the business meets thresholds: California CCPA/CPRA, Virginia VCDPA, Colorado CPA, Connecticut CTDPA, Utah UCPA, Texas TDPSA, + 10 others as of 2025.\n' +
      '(v) ELECTRONIC MESSAGES — CAN-SPAM Act (15 U.S.C. §7701) for commercial email. TCPA (47 U.S.C. §227) for SMS and autodialed calls.\n' +
      '(vi) NON-COMPETES — enforceability varies dramatically by state: VOID in California (Cal. Bus. & Prof. Code §16600), North Dakota, Oklahoma, Minnesota (2023 ban); narrowly enforceable in most others; FTC Non-Compete Rule (2024) was struck down in 2024 but remains under appeal — current status: enforceable subject to state law. Draft narrowly.\n' +
      '(vii) DISPUTES — Federal Arbitration Act (9 U.S.C. §§1–16) for arbitration (pre-empts most state limits on arbitrability). Federal-question or diversity jurisdiction for federal courts; otherwise state courts. Specify the named state for governing law and exclusive jurisdiction. Include class-action-waiver where enforceable (Epic Systems v Lewis [2018] permits in employment; consumer context less settled).\n' +
      '(viii) SPELLING — US English. Currency USD.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 3 — GRACEFUL FALLBACK for unmapped jurisdictions
  // ────────────────────────────────────────────────────────────────────────
  // Fires when NO jurisdiction-specific detector matched — e.g. user picks
  // Botswana, Senegal, Ethiopia, Rwanda, Uganda, Tanzania, Egypt, Morocco,
  // Côte d'Ivoire, Cameroon, etc. Without this, the system prompt had no
  // jurisdictional guidance at all for those users.
  const hasKnownJurisdiction = isNigeria || isKenya || isGhana || isSouthAfrica || isUK
    || isQuebec || isCanada || isCalifornia || isUSA
  const genericFallbackClause = !hasKnownJurisdiction && !isDpa
    ? '\n\nJURISDICTION FALLBACK: The user has specified a jurisdiction for which this system does not maintain a dedicated statute library. Apply the following general approach:\n' +
      '(i) COMMONWEALTH COMMON-LAW CONTRACT PRINCIPLES — for jurisdictions whose law is based on English common law (most African, Caribbean, South Asian, and Pacific jurisdictions): offer, acceptance, consideration, intention to create legal relations, capacity, legality. Draft the document in line with these universal requirements.\n' +
      '(ii) CISG — for cross-border sale of goods, note the United Nations Convention on Contracts for the International Sale of Goods (Vienna 1980) applies if both parties\' jurisdictions are contracting states, unless expressly excluded.\n' +
      '(iii) LOCAL CURRENCY — denominate amounts in the local currency of the specified jurisdiction (or USD if the user has expressly so specified).\n' +
      '(iv) FORUM SELECTION — name the most senior commercial court in the capital city of the specified jurisdiction (e.g. "the High Court sitting in [capital city]") for exclusive jurisdiction. For arbitration, suggest the most proximate institutional arbitration centre.\n' +
      '(v) CAUTIONARY TONE — because the system does not have a verified statute library for this jurisdiction, reference specific local statutes conservatively or by generic description (e.g. "the applicable labour law of [jurisdiction]"), rather than naming specific statutes that may not exist or have been repealed.\n' +
      '(vi) DATA PROTECTION — where the document touches personal data, reference "the applicable data-protection law of [jurisdiction]" and list the UNIVERSAL baseline rights (notice, consent, access, rectification, erasure, breach notification).\n' +
      '(vii) INVITATION TO VERIFY — the drafted document should include a cover note inviting the user to have a locally qualified legal practitioner review the governing-law and dispute-resolution clauses, since local statutory specifics may displace general principles.'
    : ''

  const systemPrompt = isDpa
    ? buildDpaSystemPrompt(
        isCalifornia ? 'United States — CCPA/CPRA'
        : isQuebec ? 'Canada — Quebec Law 25'
        : isCanada ? 'Canada — PIPEDA'
        : isUSA ? 'United States — CCPA/CPRA'
        : 'Nigeria — NDPA 2023'
      ) + '\n\nThis is a premium paid document — make it exceptional.'
    : 'You are an expert legal document drafter with deep knowledge of international law, including the common-law traditions of Nigeria, Kenya, Ghana, South Africa, Canada, the United States, the United Kingdom, and Commonwealth jurisdictions; the civil-law tradition of Quebec; and the statutory frameworks of each (CAMA 2020 & ISA 2025 for Nigeria; Lagos State Tenancy Law 2011; Labour Act & PRA 2014; Land Use Act 1978; Hire Purchase Act 1965; Companies Act 2015 for Kenya; Companies Act 2019 (Act 992) for Ghana; Companies Act 71 of 2008 for South Africa; Companies Act 2006 and FSMA 2000 for the UK; DGCL for Delaware; CBCA and provincial ESAs for Canada; PIPEDA, Quebec Law 25, CCPA/CPRA, UK GDPR, NDPA 2023, POPIA, Kenya DPA 2019 for data). Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. Use the spelling conventions of the governing jurisdiction (US English for US documents, British / Commonwealth English for UK / African / Commonwealth documents, Canadian English for Canadian documents). This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.'
      + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause
      + nigeriaEquityClause + kenyaEquityClause + ghanaEquityClause + ukEquityClause + southAfricaEquityClause + usEquityClause + canadaEquityClause
      + nigeriaTenancyClause + nigeriaDeedClause + nigeriaQuitNoticeClause + nigeriaPowerOfAttorneyClause + nigeriaLandlordAgentClause
      + nigeriaEmploymentClause + nigeriaNonCompeteClause
      + nigeriaLoanClause + nigeriaHirePurchaseClause + nigeriaCommercialClause
      + ukGeneralClause + kenyaGeneralClause + ghanaGeneralClause + southAfricaGeneralClause + canadaGeneralClause + usGeneralClause
      + genericFallbackClause

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000) // 90s timeout

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'Generation failed' })
    }

    const data = await response.json()
    const rawText = data.content[0]?.text || ''

    // Stamp a content hash + verifiable provenance block onto the document.
    // The hash is deterministic from the body, so anyone holding the doc
    // can verify it byte-for-byte via /trust or POST /api/verify.
    const receipt = buildReceipt(rawText, {
      doc_tier: 'premium',
      word_count: rawText.split(/\s+/).filter(Boolean).length,
    })

    // Append to the tamper-evident audit chain. Non-fatal on failure —
    // the document is still stamped with its hash + signature regardless.
    let auditEntry = null
    try {
      const redis = getRedis()
      auditEntry = await appendToAuditLog(redis, receipt)
    } catch (err) {
      logWarn('/generate', { message: 'Audit log append failed (non-fatal)', error: err.message })
    }

    const text = rawText + renderProvenanceBlock(receipt)
    logInfo('/generate', {
      success: true,
      text_length: text.length,
      hash: receipt.fingerprint,
      audit_sequence: auditEntry?.sequence ?? null,
    })

    // FIX 2: Mark payment credential as used AFTER successful generation
    if (sessionId) {
      await redisSet(`payment:used:stripe:${sessionId}`, 86400)
    }
    if (oxapayTrackId) {
      await redisSet(`payment:used:oxapay:${oxapayTrackId}`, 86400)
    }

    res.status(200).json({
      text,
      isPremium: true,
      receipt,
      audit: auditEntry
        ? { sequence: auditEntry.sequence, entry_hash: auditEntry.entry_hash, prev_hash: auditEntry.prev_hash }
        : null,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      logError('/generate', { message: 'Generate timeout' })
      return res.status(504).json({ error: 'Generation timed out. Please try again.' })
    }
    logError('/generate', { message: err.message, stack: err.stack })
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
}
