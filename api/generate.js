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

  const systemPrompt = isDpa
    ? buildDpaSystemPrompt(
        isCalifornia ? 'United States — CCPA/CPRA'
        : isQuebec ? 'Canada — Quebec Law 25'
        : isCanada ? 'Canada — PIPEDA'
        : isUSA ? 'United States — CCPA/CPRA'
        : 'Nigeria — NDPA 2023'
      ) + '\n\nThis is a premium paid document — make it exceptional.'
    : 'You are an expert legal document drafter with deep knowledge of international law, including the common-law traditions of Canada, the United States, the United Kingdom, and Commonwealth jurisdictions, as well as the civil-law tradition of Quebec and the statutory privacy regimes of North America (PIPEDA, Quebec Law 25, CCPA/CPRA, and aligned US state laws). Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. Use the spelling conventions of the governing jurisdiction (US English for US documents, Canadian English for Canadian documents). This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.' + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause + nigeriaEquityClause + kenyaEquityClause + ghanaEquityClause + ukEquityClause + southAfricaEquityClause + usEquityClause + canadaEquityClause

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
