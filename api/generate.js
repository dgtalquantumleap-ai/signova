// api/generate.js
// PAID ONLY — Uses Anthropic Claude for premium quality documents
// Verifies Stripe payment server-side before generating

import Stripe from 'stripe'
import { parseBody } from '../lib/parse-body.js'
import { logError, logWarn, logInfo } from '../lib/logger.js'
import { buildReceipt, renderProvenanceBlock, appendToAuditLog } from '../lib/doc-hash.js'
import { getRedis } from '../lib/redis.js'
import { buildDpaSystemPrompt } from './v1/documents/clauses.js'
import { buildJurisdictionContext } from '../lib/jurisdiction-context.js'
import { normalizeJurisdictionKey } from '../lib/jurisdiction-key-normalize.js'
import {
  generateWithCompletenessCheck,
  DOC_INCOMPLETE_AFTER_RETRY,
  DOC_TITLE_BODY_MISMATCH,
  DOC_FORBIDDEN_COMBINATION,
} from '../lib/doc-completeness.js'
import {
  hasDocType,
  isWorkerClassificationRequired,
  getWorkerClassificationModes,
} from '../lib/doc-registry.js'
import {
  inferWorkerClassification,
  buildClassificationInstruction,
  WORKER_CLASSIFICATION_AMBIGUOUS,
} from '../lib/doc-classification.js'
import { randomBytes } from 'node:crypto'

// Phase 4 — consumer doc_type resolution.
//
// PREFERRED: the Generator UI sends `doc_type_id` alongside `prompt`. We
// validate it against the registry and use it.
//
// FALLBACK (amended Phase 4): older cached UIs may POST without doc_type_id.
// We regex-extract from the prompt's stable opening line
//   "Generate a professional, comprehensive <Doc Name> document for..."
// and slugify. We do NOT remove the fallback in this phase — but every
// fallback emits a structured `doc_type_resolution_fallback` log event so
// the fallback rate is observable in production.
//
// Returns { docType, resolvedVia: 'body' | 'regex' | null }
function resolveDocTypeFromPromptRegex(prompt) {
  if (typeof prompt !== 'string') return null
  const m = prompt.match(/comprehensive\s+([^\n]+?)\s+document\b/i)
  if (!m) return null
  return m[1]
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function resolveDocType({ bodyDocTypeId, prompt }) {
  // 1. Explicit doc_type_id from the request body — only accept if it
  //    matches a registered doc_type. An unregistered id means the UI is
  //    out of date OR the caller is fuzzing; fall through to regex.
  if (typeof bodyDocTypeId === 'string' && bodyDocTypeId.trim().length > 0) {
    const id = bodyDocTypeId.trim()
    if (hasDocType(id)) return { docType: id, resolvedVia: 'body' }
    // fall through to regex fallback — but log the rejection below.
  }
  // 2. Regex fallback.
  const fromRegex = resolveDocTypeFromPromptRegex(prompt)
  if (fromRegex && hasDocType(fromRegex)) return { docType: fromRegex, resolvedVia: 'regex' }
  if (fromRegex) return { docType: fromRegex, resolvedVia: 'regex-unregistered' }
  return { docType: null, resolvedVia: null }
}

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
  const { prompt, sessionId, oxapayTrackId, promoToken, doc_type_id: bodyDocTypeId } = body
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

  // Doc-type-specific detectors for the 6 new equity doc types. Used to
  // build type-specific Nigeria prompt blocks (Guardrail 4 — exclusive with
  // the shared nigeriaEquityClause so no doc gets both).
  const isFoundersAgreementDoc = lower.includes("founders' agreement") || lower.includes('founders agreement') || lower.includes("founders agreement")
  const isIpAssignmentDoc = lower.includes('ip assignment agreement') || lower.includes('intellectual property assignment')
  const isAdvisoryBoardDoc = lower.includes('advisory board agreement')
  const isVestingAgreementDoc = lower.includes('vesting agreement')
  const isTermSheetDoc = lower.includes('term sheet')
  const isSafeAgreementDoc = lower.includes('safe agreement') || lower.includes('simple agreement for future equity')

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
  // FIX 7: broadened to catch credit/personal/business/contract phrasings,
  // word-boundary scoped so partial matches don't false-positive (e.g. "loan
  // application" still doesn't match because we require the noun phrase).
  const isLoanDoc = /\b(loan agreement|credit agreement|personal loan|business loan|loan contract)\b/.test(lower)
  const isHirePurchaseDoc = lower.includes('hire purchase') || lower.includes('hire-purchase')
  const isCommercialDoc = lower.includes('distribution agreement') || lower.includes('distribution / reseller')
    || lower.includes('supply agreement') || lower.includes('reseller agreement')

  // ── Jurisdiction detection ────────────────────────────────────────────────
  // FIX 3 — scoped jurisdiction detection.
  //
  // Previous version checked the ENTIRE prompt for jurisdiction keywords like
  // "California" / "London" / "Toronto". Result: a Nigerian NDA where one
  // party was headquartered in Los Angeles triggered isCalifornia=true and
  // injected California CCPA language into a Nigerian document.
  //
  // Fix: extract the labelled jurisdiction lines from the fieldSummary
  // ("Governing law:" / "Country:" / "State:" / "Jurisdiction:" /
  // "Country of incorporation:") and run the keyword detection ONLY against
  // those scoped lines. Non-jurisdiction labels in the form (Property /
  // Address / Company HQ / Workplace / etc.) no longer pollute detection.
  //
  // Exception per spec: isNigeria stays in full-prompt scope because Nigerian
  // state-name addresses ("12 Adeyemi Street, Ikeja GRA, Lagos") are the
  // primary way Nigerian users indicate their jurisdiction — they often skip
  // the explicit dropdown.
  const govLawLine = (lower.match(/governing law:\s*([^\n]+)/) || [])[1] || ''
  const countryLine = (lower.match(/country:\s*([^\n]+)/) || [])[1] || ''
  const stateLine = (lower.match(/state:\s*([^\n]+)/) || [])[1] || ''
  const jurisdictionLine = (lower.match(/jurisdiction:\s*([^\n]+)/) || [])[1] || ''
  const incorpLine = (lower.match(/country of incorporation[^:]*:\s*([^\n]+)/) || [])[1] || ''
  const jurisdictionScope = `${govLawLine} ${countryLine} ${stateLine} ${jurisdictionLine} ${incorpLine}`
  // Same scoping applied to the original-case prompt for the "USA"/"U.S."/
  // "U.S.A." check (case-sensitive to avoid the pronoun "us"). Pull the
  // labelled lines out of the original-case prompt with a flagless regex.
  const promptScopeRaw = (() => {
    const lines = prompt.split('\n')
    return lines.filter(l =>
      /^(Governing law|Country|State|Jurisdiction|Country of incorporation)/i.test(l)
    ).join(' ')
  })()

  // isNigeria — kept in full-prompt scope per spec.
  const isNigeria = lower.includes('nigeria') || lower.includes('ndpa') || lower.includes('ndpc')
    || lower.includes('cama 2020') || lower.includes('isa 2025') || /\b(lagos|abuja|kano|ibadan|port harcourt)\b/.test(lower)

  // Lagos State Tenancy Law 2011 s.1(3) excludes four high-value areas from
  // its coverage — those fall back to the Recovery of Premises Act (Cap. R7
  // LFN 2004). Detection here checks the property address line and the state
  // dropdown selection. Nigerian property routing stays full-prompt because
  // the address contains the routing signal.
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

  // FIX 6 — Other Nigerian state detection. Each Nigerian state has its own
  // tenancy / recovery-of-premises statute (or relies on the federal Recovery
  // of Premises Act in the FCT). Naming the correct state statute in the
  // governing-law clause is what a litigation lawyer will check first.
  // Detects from address / state field. Only one fires at a time (most
  // common state wins by listing order). isLagos* (above) takes precedence.
  const ngStateRivers = isNigeria && /\b(rivers state|port harcourt|obio[\s-]akpor|eleme|okrika|onne|bonny)\b/.test(lower)
  const ngStateAnambra = isNigeria && /\b(anambra|awka|onitsha|nnewi|ekwulobia)\b/.test(lower)
  const ngStateOyo = isNigeria && !isExcludedLagosArea && !isLstlLagos && /\b(oyo state|ibadan|ogbomoso|oyo town|saki)\b/.test(lower)
  const ngStateKano = isNigeria && /\b(kano state|kano municipal|fagge|nasarawa gwo)\b/.test(lower)
  const ngStateEnugu = isNigeria && /\b(enugu|nsukka|udi)\b/.test(lower)
  const ngStateAbia = isNigeria && /\b(abia|umuahia|aba)\b/.test(lower)
  const ngStateImo = isNigeria && /\b(imo state|owerri|orlu|okigwe)\b/.test(lower)
  const ngStateFCT = isNigeria && !isExcludedLagosArea && !isLstlLagos && /\b(fct|abuja|federal capital territory|garki|wuse|maitama|asokoro|gwarinpa|kuje)\b/.test(lower)

  // FIX 3 — every other jurisdiction is detected ONLY against the scoped
  // jurisdiction lines, not the full prompt. Statute keywords (e.g. "POPIA",
  // "Companies Act 2006") that appear in jurisdiction lines still match.
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
    /\b(o\.n\.|bc|b\.c\.|ab|mb|sk|ns|nb|pei|yt|nt|nu)\b/.test(jurisdictionScope) ||
    /\bpipeda|casl|cbca\b/.test(jurisdictionScope))
  const isCalifornia = /\bcalifornia\b/.test(jurisdictionScope) || /\bccpa|cpra\b/.test(jurisdictionScope) ||
    /\b(san francisco|los angeles|san diego|san jose|sacramento|oakland|santa clara|palo alto|silicon valley)\b/.test(jurisdictionScope)
  // FIX 8 — US state detectors. Top-6 states get dedicated sub-clauses below
  // (CA already has californiaClause). Detection scoped to jurisdiction lines
  // so a Florida-based party in a Nigerian doc doesn't flip Florida law on.
  const isUsStateNY = /\b(new york|nyc|new york city|nyll|nyshrl)\b/.test(jurisdictionScope) && !isCalifornia
  const isUsStateTX = /\b(texas|houston|dallas|austin|san antonio|tex\.\s*lab\.\s*code)\b/.test(jurisdictionScope) && !isCalifornia
  const isUsStateFL = /\b(florida|miami|orlando|tampa|jacksonville|fla\.\s*stat\.)\b/.test(jurisdictionScope) && !isCalifornia
  const isUsStateIL = /\b(illinois|chicago|bipa|freedom to work act)\b/.test(jurisdictionScope) && !isCalifornia
  const isUsStateWA = /\b(washington state|seattle|spokane|tacoma|rcw 49\.62|rcw\s*49\.62)\b/.test(jurisdictionScope) && !isCalifornia

  const isUSA = !isCalifornia && (
    /\bunited states\b/.test(jurisdictionScope) ||
    /\b(USA|U\.S\.A\.|U\.S\.)\b/.test(promptScopeRaw) ||  // original case — avoids pronoun "us"
    /\bdelaware|dgcl\b/.test(jurisdictionScope) ||
    isUsStateNY || isUsStateTX || isUsStateFL || isUsStateIL || isUsStateWA ||
    /\b(alabama|alaska|arizona|arkansas|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(jurisdictionScope) ||
    /\b(nyc|new york city|chicago|houston|phoenix|philadelphia|dallas|austin|seattle|boston|miami|atlanta|denver|detroit|minneapolis|las vegas)\b/.test(jurisdictionScope)
  )

  // ── Library-based jurisdiction framework block ────────────────────────────
  // Derives the canonical key from the already-scoped boolean detectors so the
  // scoping logic is not duplicated. Falls back to normalizeJurisdictionKey on
  // the scoped text to catch gap jurisdictions (India, UAE, Singapore, EU) that
  // have no dedicated boolean. Skipped entirely for DPA docs (buildDpaSystemPrompt
  // handles those with dedicated jurisdiction routing).
  const normalizedJurKey = isDpa ? null
    : isNigeria ? 'nigeria'
    : isKenya ? 'kenya'
    : isGhana ? 'ghana'
    : isSouthAfrica ? 'south_africa'
    : isUK ? 'uk'
    : isQuebec ? 'canada_quebec'
    : isCanada ? 'canada_federal'
    : isCalifornia ? 'usa_california'
    : isUsStateNY ? 'usa_new_york'
    : isUsStateTX ? 'usa_texas'
    : isUsStateFL ? 'usa_florida'
    : isUSA ? 'usa_federal'
    : normalizeJurisdictionKey(jurisdictionScope)

  const libraryJurContext = normalizedJurKey
    ? buildJurisdictionContext(normalizedJurKey)
      + '\n\nWhen drafting this document, apply the jurisdiction framework above: cite the statutes listed where they bear on the document type; use the governing-law clause structure from the framework; use the forum/venue from the framework; use the currency from the framework for monetary references; do not invoke statutes from other jurisdictions.'
    : ''

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
  // FIX 5 — Two-field model for cross-border equity transactions.
  //
  // The COMPANY LAW (CAMA / Companies Act 2006 / DGCL / etc.) is determined
  // by the ENTITY'S INCORPORATION JURISDICTION, not by the contract's
  // governing-law clause. A common pattern: a Nigerian-incorporated company
  // raises a SAFE under New York governing law — the SAFE must use CAMA's
  // "ordinary shares / preference shares" (not US "common/preferred stock"),
  // even though disputes go to NY courts. Previously usEquityClause blocked
  // when any non-US jurisdiction was detected, dropping the NY governing-law
  // signal entirely.
  //
  // Resolution: derive separate incorporation-jurisdiction detectors. If the
  // user provided a "Country of incorporation:" field, use it. Otherwise
  // fall back to the governing-law-based detectors above (single-jurisdiction
  // case — most common).
  const incorpScope = incorpLine
  const hasExplicitIncorp = incorpScope.trim().length > 0
  const isIncorpNigeria = hasExplicitIncorp
    ? /\bnigeria|nigerian|cama 2020\b/.test(incorpScope)
    : isNigeria
  const isIncorpKenya = hasExplicitIncorp
    ? /\bkenya|kenyan|companies act 2015\b/.test(incorpScope)
    : isKenya
  const isIncorpGhana = hasExplicitIncorp
    ? /\bghana|ghanaian|act 992|companies act 2019\b/.test(incorpScope)
    : isGhana
  const isIncorpSouthAfrica = hasExplicitIncorp
    ? /\bsouth africa|south african|companies act 71 of 2008\b/.test(incorpScope)
    : isSouthAfrica
  const isIncorpUK = hasExplicitIncorp
    ? /\bunited kingdom|england|companies act 2006|british\b/.test(incorpScope)
    : isUK
  const isIncorpCanada = hasExplicitIncorp
    ? /\bcanada|canadian|cbca|obca|bcbca\b/.test(incorpScope)
    : isCanada
  const isIncorpUS = hasExplicitIncorp
    ? /\bunited states|delaware|dgcl|usa|u\.s\./i.test(incorpScope) ||
      /\b(alabama|alaska|arizona|arkansas|colorado|connecticut|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|california)\b/i.test(incorpScope)
    : (isUSA || isCalifornia)

  // Cross-border note appended when incorporation jurisdiction differs from
  // the contract's governing law (e.g. NG-incorporated company under English
  // governing law). Tells Claude to apply incorporation-jurisdiction company
  // law for share-structure language but governing-law jurisdiction for
  // dispute resolution / forum selection.
  const equityCrossBorderNote = isEquityDoc && hasExplicitIncorp ? (() => {
    const govLawJurisdiction =
      isCalifornia ? 'California' : isUSA ? 'United States' :
      isUK ? 'England and Wales' : isCanada ? 'Canada' :
      isQuebec ? 'Quebec' : isNigeria ? 'Nigeria' :
      isKenya ? 'Kenya' : isGhana ? 'Ghana' :
      isSouthAfrica ? 'South Africa' : ''
    const incorpJurisdiction =
      isIncorpUS ? 'United States' :
      isIncorpUK ? 'United Kingdom' :
      isIncorpCanada ? 'Canada' :
      isIncorpNigeria ? 'Nigeria' :
      isIncorpKenya ? 'Kenya' :
      isIncorpGhana ? 'Ghana' :
      isIncorpSouthAfrica ? 'South Africa' : ''
    if (!govLawJurisdiction || !incorpJurisdiction || govLawJurisdiction === incorpJurisdiction) return ''
    return `\n\nCROSS-BORDER EQUITY DOCUMENT NOTE: The company is incorporated in ${incorpJurisdiction} but the contract's governing law is ${govLawJurisdiction}. Apply ${incorpJurisdiction} company law for ALL share-structure language (share class names, conversion mechanics, allotment / return-of-allotment filings with the appropriate registrar). Apply ${govLawJurisdiction} law for dispute-resolution / forum-selection / general contract interpretation. Do NOT mix terminology — never use US "common/preferred stock" wording for a Nigerian or UK company even if NY/Delaware governing law is selected.`
  })() : ''

  // True when one of the 6 type-specific Nigeria equity blocks below will
  // fire. The shared nigeriaEquityClause is suppressed for these types
  // (Guardrail 4 — type-specific block and shared block are mutually exclusive).
  const hasNigeriaTypeSpecificEquityBlock = isIncorpNigeria && (
    isFoundersAgreementDoc || isIpAssignmentDoc || isAdvisoryBoardDoc ||
    isVestingAgreementDoc || isTermSheetDoc || isSafeAgreementDoc
  )

  const nigeriaEquityClause = isEquityDoc && isIncorpNigeria && !hasNigeriaTypeSpecificEquityBlock
    ? '\n\nIMPORTANT — NIGERIAN COMPANY LAW FOR EQUITY INSTRUMENTS: This document concerns issuance of shares / equity rights in a Nigerian-incorporated entity. Strictly apply: (i) the Companies and Allied Matters Act (CAMA) 2020 — use CAMA terminology ("ordinary shares" and "preference shares" — NEVER US-style "common stock" or "preferred stock"). Reference sections 124 (allotment of shares), 125 (return of allotment, filed with the Corporate Affairs Commission (CAC) within 15 days of allotment), 128 (pre-emption rights), 141 (share capital increases), 165 (register of members). For conversion mechanics on the next equity round, require a board resolution, shareholders\' resolution where an increase in share capital is needed, and CAC filing within 15 days. (ii) the Investments and Securities Act (ISA) 2025 for private-placement exemptions — the Agreement should represent that the issuance is a private placement exempt from full SEC registration under ISA 2025, that the investor is a sophisticated or qualified investor, and that no public offering or advertisement has occurred. Reference the relevant SEC Rules on Private Placement. (iii) For governing law default to the Laws of the Federal Republic of Nigeria when Nigeria is the company\'s jurisdiction (NOT Delaware — explicitly reject US defaults). (iv) Dispute resolution: either courts of the Federal Republic of Nigeria (Lagos or Abuja Judicial Division of the Federal High Court / High Court) or arbitration under the Arbitration and Mediation Act 2023, seat in Lagos, administered by LCA / NCIA / ICC as specified. (v) Denominate amounts in Naira (NGN / ₦) or the currency specified, include a clause on CBN foreign-exchange controls if the investment is in USD and conversion or repatriation is contemplated. (vi) Certificate of Incorporation / CAC Registration Number must be stated in the parties block. (vii) Stamping: note that the Agreement is dutiable under the Stamp Duties Act and should be stamped at the FIRS within 30 days of execution.'
    : ''

  const kenyaEquityClause = isEquityDoc && isIncorpKenya
    ? '\n\nIMPORTANT — KENYAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 2015 (Cap. 486) — reference sections 327 (allotment of shares), 334 (return of allotment filed with the Registrar of Companies within 1 month), 338 (pre-emption rights), 344 (alteration of share capital), and Part XXIII for disclosure obligations. Use Kenyan terminology: "ordinary shares" and "preference shares" (not US "common/preferred stock"). For securities law, apply the Capital Markets Act (Cap. 485A) and Capital Markets (Securities) (Public Offers, Listing and Disclosures) Regulations — private placements to accredited investors are exempt under Regulation 21 of the 2002 Regulations. Default governing law to the Laws of Kenya, dispute resolution to the High Court of Kenya at Nairobi or arbitration under the Arbitration Act 1995 with NCIA seat. Reference Business Registration Service (BRS) registration number in parties block. Denominate in KES unless specified.'
    : ''

  const ghanaEquityClause = isEquityDoc && isIncorpGhana
    ? '\n\nIMPORTANT — GHANAIAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 2019 (Act 992) — reference sections 43 (power to issue shares), 45 (allotment of shares), 46 (return of allotment filed with the Registrar of Companies within 28 days), 50 (pre-emption rights), 75 (alteration of stated capital). Use Ghanaian terminology: Ghana abolished par value — shares are "no par value" and the Agreement references "stated capital" rather than authorised capital. For securities regulation apply the Securities Industry Act 2016 (Act 929) and SEC Ghana rules — private placements to qualified investors are exempt under section 109. Default governing law to the Laws of the Republic of Ghana, dispute resolution to the High Court at Accra (Commercial Division) or arbitration under the Alternative Dispute Resolution Act 2010 (Act 798), seat in Accra (GAAC). Reference Registrar-General\'s Department company registration number in parties block. Denominate in GHS unless specified.'
    : ''

  const ukEquityClause = isEquityDoc && isIncorpUK
    ? '\n\nIMPORTANT — UK COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 2006 — reference sections 549–551 (authority to allot), 561 (pre-emption rights), 617 (alteration of share capital), 561–577 (disapplication of pre-emption), and Part 17 generally. Use UK terminology: "ordinary shares" and "preference shares" (not US "common/preferred stock"). For securities regulation apply FSMA 2000 and the Prospectus Regulation — small-scale private placements to qualified / sophisticated / HNW investors are exempt from prospectus requirements under Article 1(4) of the UK Prospectus Regulation. File SH01 (return of allotment) with Companies House within 1 month. Default governing law to the laws of England and Wales (or Scotland / Northern Ireland if specified), dispute resolution to the courts of England and Wales or arbitration under the Arbitration Act 1996 with LCIA or London seat. Reference Companies House number in parties block. Denominate in GBP unless specified. Note HMRC Stamp Duty / SDRT obligations on share transfers.'
    : ''

  const southAfricaEquityClause = isEquityDoc && isIncorpSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Companies Act 71 of 2008 — reference sections 38 (allotment), 39 (subscription for shares), 40 (consideration for shares), 41 (shareholder approval for issue of shares to directors or at a discount), 95 (securities register). Use South African terminology: "ordinary shares" / "preference shares", and note that "par value" shares were abolished for new companies — use "no par value" shares and CTC (contributed tax capital). For securities regulation apply the Financial Markets Act 19 of 2012 and the FSCA requirements — private placements to qualified investors under section 96 of the Companies Act are exempt from prospectus. Default governing law to the laws of the Republic of South Africa, dispute resolution to the High Court of South Africa (Gauteng or Western Cape Division) or arbitration under the Arbitration Act 42 of 1965 / AFSA rules, seat in Johannesburg. Reference CIPC registration number in parties block. Denominate in ZAR unless specified. Note SARB exchange-control considerations for cross-border investments.'
    : ''

  const usEquityClause = isEquityDoc && isIncorpUS && !isIncorpNigeria && !isIncorpKenya && !isIncorpGhana && !isIncorpSouthAfrica && !isIncorpUK
    ? '\n\nIMPORTANT — US COMPANY LAW FOR EQUITY INSTRUMENTS: Default incorporation state is Delaware for SAFE and startup documents unless the user specifies otherwise. Apply the Delaware General Corporation Law (DGCL) — reference §151 (classes and series of stock), §152 (issuance of capital stock), §153 (consideration for stock), §157 (rights and options), §161 (issuance of additional stock). Use US terminology: "common stock" and "preferred stock" (NOT UK/Commonwealth "ordinary/preference shares"). Use the most current Y Combinator post-money SAFE v1.2 template structure (September 2022) as a baseline unless a pre-money SAFE is explicitly selected. For federal securities law, claim Regulation D Rule 506(b) (or 506(c) if general solicitation is used) exemption from Securities Act registration, with a Form D filed with the SEC within 15 days of first sale. State Blue Sky notice filings may be required in each state where investors reside. Default governing law to Delaware (SAFE), jurisdiction and venue to state and federal courts in Delaware. Denominate in USD. For California companies, note that California may apply its own corporate-governance rules under Cal. Corp. Code §2115 for "quasi-California" corporations.'
    : ''

  const canadaEquityClause = isEquityDoc && isIncorpCanada && !isQuebec
    ? '\n\nIMPORTANT — CANADIAN COMPANY LAW FOR EQUITY INSTRUMENTS: Apply the Canada Business Corporations Act (CBCA) or the corresponding provincial Business Corporations Act (OBCA for Ontario, BCBCA for BC, ABCA for Alberta) — reference CBCA §25 (issue of shares), §27 (continuous disclosure of shares), §42 (solvency test for share issuance), §49 (share certificates). Use Canadian terminology: "common shares" and "preferred shares". For securities regulation apply the applicable provincial Securities Act (Ontario Securities Act, BC Securities Act, etc.) and National Instrument 45-106 — claim the "accredited investor" exemption (NI 45-106 §2.3), the "private issuer" exemption (§2.4), or the "offering memorandum" exemption (§2.9) as applicable. File Form 45-106F1 report of exempt distribution within 10 days. Default governing law to the laws of the specified Canadian province and the federal laws of Canada applicable therein, jurisdiction to that province\'s Superior Court of Justice. Use Canadian spelling (cheque, labour, organisation). Denominate in CAD unless specified.'
    : ''

  // ── Type-specific Nigeria equity clauses (Guardrail 4) ──────────────────
  // Each fires only when the matching doc-type detector AND isIncorpNigeria
  // are both true. These are EXCLUSIVE with nigeriaEquityClause — the
  // hasNigeriaTypeSpecificEquityBlock flag above suppresses the shared block
  // when any of these fires.

  const nigeriaFoundersAgreementClause = isFoundersAgreementDoc && isIncorpNigeria
    ? '\n\nIMPORTANT — NIGERIAN FOUNDERS AGREEMENT (CAMA 2020 / ISA 2025):\n' +
      'This is a Founders Agreement for a Nigerian-incorporated company. Apply the following requirements:\n\n' +
      'EQUITY STRUCTURE:\n' +
      '- Use CAMA 2020 terminology throughout: "ordinary shares" and "preference shares" — NEVER "common stock" or "preferred stock".\n' +
      '- Each founder\'s shareholding must reference the total issued share capital and the specific number of ordinary shares held. Reference CAMA s.124 (allotment) and s.165 (register of members).\n' +
      '- CAC filing: any allotment of shares to founders must be returned to the Corporate Affairs Commission (CAC) within 15 days of allotment (CAMA s.125).\n\n' +
      'VESTING SCHEDULE:\n' +
      '- Include a 4-year vesting schedule with a 1-year cliff as the default unless parties specify otherwise.\n' +
      '- State the vesting commencement date, cliff date, and monthly/quarterly vesting cadence after the cliff.\n' +
      '- Specify good leaver and bad leaver definitions with corresponding buyback mechanics: unvested shares are subject to repurchase by the company at nominal value (bad leaver) or fair market value (good leaver).\n\n' +
      'IP ASSIGNMENT:\n' +
      '- Each founder must assign to the company all intellectual property created in connection with the company\'s business, including pre-existing IP contributed at incorporation.\n' +
      '- Reference the Copyright Act 2022 (Act No. 35 of 2022) for copyright works and the Patents and Designs Act (Cap. P2 LFN 2004) for patentable inventions.\n' +
      '- Excluded prior works must be listed in a schedule.\n\n' +
      'NON-COMPETE / NON-SOLICITATION:\n' +
      '- Include a non-compete restricted period of 12–24 months post-departure, scoped to the company\'s actual business activities and geographic market.\n' +
      '- Nigerian courts will enforce non-competes if they protect a legitimate business interest and are reasonable in scope, duration, and geography.\n\n' +
      'STRUCTURE NUMBERING REQUIREMENTS:\n' +
      '- Each top-level Clause must have a unique sequential number.\n' +
      '- Verify before output: no two clauses share the same number.\n' +
      '- Sub-clauses follow their parent\'s number (Clause 8.1, 8.2, etc.).\n' +
      '- Sections like "Part I, Part II" are separate from clause numbering — clauses within each Part continue the global sequence.\n\n' +
      'GOVERNING LAW & DISPUTE RESOLUTION:\n' +
      '- Governing law: Laws of the Federal Republic of Nigeria.\n' +
      '- Dispute resolution: courts of the Federal Republic of Nigeria (Lagos or Abuja Judicial Division) or LCIA / LCA / NCIA arbitration, seat Lagos.\n' +
      '- Denominate monetary amounts in Naira (₦ / NGN).\n\n' +
      'STAMP DUTY: Note that the Agreement is dutiable under the Stamp Duties Act and should be stamped at the FIRS within 30 days of execution.'
    : ''

  const nigeriaIpAssignmentClause = isIpAssignmentDoc && isIncorpNigeria
    ? '\n\nIMPORTANT — NIGERIAN IP ASSIGNMENT AGREEMENT (Copyright Act 2022 / Patents and Designs Act):\n' +
      'This is an IP Assignment Agreement governed by Nigerian law. Apply the following:\n\n' +
      'ASSIGNMENT LANGUAGE:\n' +
      '- Use irrevocable absolute assignment language: "The Assignor hereby irrevocably and unconditionally assigns to the Assignee, with full title guarantee, all right, title, and interest in and to the Assigned IP."\n' +
      '- Reference the Copyright Act 2022 (Act No. 35 of 2022) for copyright works: assignment must be in writing and signed by the assignor (Copyright Act 2022 s.11).\n' +
      '- Reference the Patents and Designs Act (Cap. P2 LFN 2004) for patents: assignment must be in writing and registered at the Nigerian Trademarks, Patents and Designs Registry.\n' +
      '- Reference the Trade Marks Act (Cap. T13 LFN 2004) for trade marks: assignment may be with or without the goodwill of the business.\n\n' +
      'CONSIDERATION:\n' +
      '- State the assignment consideration in Naira (₦ / NGN).\n' +
      '- If nominal consideration, state "One Thousand Naira (₦1,000) and other good and valuable consideration."\n\n' +
      'WARRANTIES:\n' +
      '- Assignor warrants: sole ownership, no prior assignments, no encumbrances, no pending infringement claims, and the IP does not infringe third-party rights.\n' +
      '- Include an indemnity from the assignor for breach of IP warranties.\n\n' +
      'EXCLUDED PRIOR WORKS:\n' +
      '- Include a schedule of pre-existing materials / prior works explicitly excluded from the assignment.\n\n' +
      'NDPA 2023: If the IP includes personal data processing capabilities or datasets, note the Nigeria Data Protection Act 2023 (NDPA) obligations that transfer with the IP.\n\n' +
      'GOVERNING LAW: Laws of the Federal Republic of Nigeria. Jurisdiction: Federal High Court or Lagos State High Court.\n' +
      'STAMP DUTY: Dutiable under the Stamp Duties Act; stamp at FIRS within 30 days of execution.'
    : ''

  const nigeriaAdvisoryBoardClause = isAdvisoryBoardDoc && isIncorpNigeria
    ? '\n\nIMPORTANT — NIGERIAN ADVISORY BOARD AGREEMENT (CAMA 2020 / ISA 2025):\n' +
      'This is an Advisory Board Agreement for a Nigerian-incorporated company. Apply the following:\n\n' +
      'EQUITY COMPENSATION:\n' +
      '- Use CAMA 2020 terminology: "ordinary shares" — NEVER "common stock".\n' +
      '- Advisor equity grants are allotted as ordinary shares subject to vesting. Any allotment must comply with CAMA s.124 and be returned to CAC within 15 days (s.125).\n' +
      '- ISA 2025: advisor share issuances are private placements exempt from SEC registration provided the advisor is a sophisticated/qualified investor and no public offering has occurred.\n\n' +
      'VESTING:\n' +
      '- Include a monthly vesting schedule (no cliff is standard for advisors, but parties may agree a 3-month cliff).\n' +
      '- State total shares, monthly vesting increment, and total vesting period (typically 2 years).\n' +
      '- On termination, unvested shares lapse and the company may repurchase vested shares at fair market value within 90 days.\n\n' +
      'SCOPE OF ADVISORY SERVICES:\n' +
      '- Specify advisory hours per month and key deliverables.\n' +
      '- Advisor has no authority to bind the company; all decisions require board approval.\n\n' +
      'CONFIDENTIALITY & IP:\n' +
      '- Advisor must maintain strict confidentiality of the company\'s confidential information.\n' +
      '- All work product, inventions, and improvements created by the advisor in connection with the advisory services are assigned to the company.\n' +
      '- Reference Copyright Act 2022 for copyright works.\n\n' +
      'TERMINATION: Either party may terminate on 30 days\' written notice.\n\n' +
      'GOVERNING LAW: Laws of the Federal Republic of Nigeria. Jurisdiction: Lagos State High Court or Federal High Court.\n' +
      'STAMP DUTY: Dutiable under the Stamp Duties Act; stamp at FIRS within 30 days of execution.'
    : ''

  const nigeriaVestingAgreementClause = isVestingAgreementDoc && isIncorpNigeria
    ? '\n\nIMPORTANT — NIGERIAN VESTING AGREEMENT (CAMA 2020 / ISA 2025):\n' +
      'This is a Share Vesting Agreement for a Nigerian-incorporated company. Apply the following:\n\n' +
      'SHARE GRANT:\n' +
      '- Use CAMA 2020 terminology: "ordinary shares" — NEVER "common stock".\n' +
      '- State total grant shares, current issued share capital, and the grantee\'s percentage post-grant.\n' +
      '- Allotment of shares must comply with CAMA s.124 and be returned to CAC within 15 days (s.125).\n' +
      '- ISA 2025: the grant is a private placement exempt from SEC registration (sophisticated/qualified investor, no public offering).\n\n' +
      'VESTING SCHEDULE:\n' +
      '- Include a 4-year vesting schedule with a 1-year cliff as the default.\n' +
      '- State: vesting commencement date, cliff date, cliff vesting percentage (25%), and monthly/quarterly vesting cadence thereafter.\n' +
      '- All unvested shares remain subject to a right of repurchase by the company.\n\n' +
      'ACCELERATION:\n' +
      '- Single-trigger: full accelerated vesting on a Change of Control if the grantee\'s role is materially diminished or terminated.\n' +
      '- Double-trigger (preferred): acceleration only if there is both a Change of Control AND an involuntary termination within 12 months.\n' +
      '- Define "Change of Control" to include merger, acquisition, sale of substantially all assets.\n\n' +
      'GOOD LEAVER / BAD LEAVER:\n' +
      '- Good leaver (redundancy, ill health, death): vested shares retained; unvested shares subject to repurchase at fair market value.\n' +
      '- Bad leaver (resignation, termination for cause, breach): all unvested shares forfeited; vested shares subject to repurchase at nominal value (or lower of cost/FMV).\n\n' +
      'FORFEITURE: Unvested shares that lapse on termination are automatically forfeited and returned to the company\'s unissued share pool without further action.\n\n' +
      'GOVERNING LAW: Laws of the Federal Republic of Nigeria. Jurisdiction: Lagos State High Court or Federal High Court.\n' +
      'STAMP DUTY: Dutiable under the Stamp Duties Act; stamp at FIRS within 30 days of execution.'
    : ''

  const nigeriaTermSheetClause = isTermSheetDoc && isIncorpNigeria
    ? '\n\nIMPORTANT — NIGERIAN TERM SHEET (CAMA 2020 / ISA 2025):\n' +
      'This is an Investment Term Sheet for a Nigerian-incorporated company. Apply the following:\n\n' +
      'SHARE TERMINOLOGY:\n' +
      '- Use CAMA 2020 terminology: "ordinary shares" and "preference shares" — NEVER "common stock" or "preferred stock".\n' +
      '- New investors receive preference shares (Series A, A-1, etc.) per CAMA s.124. CAC filing within 15 days of allotment (s.125). Share capital increase per s.141 requires shareholder approval.\n\n' +
      'INVESTMENT ECONOMICS:\n' +
      '- State: investment amount (in ₦ or agreed currency), pre-money valuation, post-money valuation, and implied price per share.\n' +
      '- Liquidation preference: typically 1× non-participating for Nigerian preference shares (consistent with international practice).\n' +
      '- Anti-dilution: broad-based weighted-average is preferred; full-ratchet must be explicitly negotiated.\n\n' +
      'INVESTOR PROTECTIONS:\n' +
      '- Pre-emption rights: existing shareholders retain pre-emption on new share issuances (CAMA s.128).\n' +
      '- Protective provisions: investor consent required for changes to authorised share capital, creation of senior classes of shares, related-party transactions above a threshold, and asset disposals above a threshold.\n' +
      '- Information rights: annual audited accounts, quarterly management accounts, board representation or observer rights.\n\n' +
      'SECURITIES LAW: ISA 2025 — the round is a private placement exempt from full SEC registration. Investor represents it is a sophisticated/qualified investor. No public offering or advertisement has occurred.\n\n' +
      'EXCLUSIVITY & BINDING PROVISIONS:\n' +
      '- Only the exclusivity, confidentiality, governing-law, and expenses clauses are binding; all other terms are non-binding subject to execution of definitive agreements.\n\n' +
      'GOVERNING LAW: Laws of the Federal Republic of Nigeria. Disputes: Lagos or Abuja Judicial Division of the Federal High Court, or NCIA / LCA arbitration seated in Lagos.\n' +
      'CURRENCY: Denominate in Naira (₦ / NGN); if USD amounts are agreed, include a CBN exchange-control note on repatriation and conversion.'
    : ''

  const nigeriaSafeAgreementClause = isSafeAgreementDoc && isIncorpNigeria
    ? '\n\nIMPORTANT — NIGERIAN SAFE AGREEMENT (CAMA 2020 / ISA 2025):\n' +
      'This is a Simple Agreement for Future Equity (SAFE) for a Nigerian-incorporated company. Apply the following:\n\n' +
      'SHARE TERMINOLOGY:\n' +
      '- Use CAMA 2020 terminology: "ordinary shares" and "preference shares" — NEVER "common stock" or "preferred stock".\n' +
      '- On conversion, the SAFE converts into preference shares at the applicable conversion price. Allotment must comply with CAMA s.124; CAC return filed within 15 days (s.125); share capital increase via s.141 requires shareholder/board approval.\n\n' +
      'ECONOMIC TERMS:\n' +
      '- Valuation Cap: sets the maximum pre-money valuation at which the SAFE converts.\n' +
      '- Discount Rate: investor receives shares at a discount to the price paid by new investors in the Qualified Financing (typically 80–90%, i.e., a 10–20% discount).\n' +
      '- Conversion Price: the lower of (i) Cap Price = Valuation Cap ÷ Company Capitalisation, and (ii) Discount Price = lowest price per share in the Qualified Financing × Discount Rate.\n\n' +
      'CONVERSION EVENTS:\n' +
      '- Qualified Financing: automatic conversion on a priced equity round above a minimum amount.\n' +
      '- Liquidity Event (acquisition / IPO): investor may elect cash repayment at 1× investment amount or conversion.\n' +
      '- Dissolution Event: SAFE holder is repaid investment amount before ordinary shareholders.\n\n' +
      'MOST-FAVOURED-NATION (MFN):\n' +
      '- If the company issues subsequent SAFEs on more favourable economic terms, investor automatically receives those terms.\n\n' +
      'SECURITIES LAW: ISA 2025 — the SAFE is a private placement exempt from full SEC registration under the private-placement provisions. Investor represents it is a sophisticated/qualified investor and acknowledges no public offering has been made.\n\n' +
      'GOVERNING LAW: Laws of the Federal Republic of Nigeria. Disputes: courts of the Federal Republic of Nigeria (Lagos or Abuja Judicial Division) or arbitration under the Arbitration and Mediation Act 2023, seat in Lagos.\n' +
      'CURRENCY: Denominate in Naira (₦ / NGN) or USD if the investment is in foreign currency; include CBN foreign-exchange controls note on repatriation.\n' +
      'STAMP DUTY: Note that the SAFE is dutiable under the Stamp Duties Act and should be stamped at FIRS within 30 days of execution.'
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
      (isExcludedLagosArea
        ? '(i) *** MANDATORY STATUTE CITATION — DO NOT DEVIATE ***: This property is in an EXCLUDED LAGOS AREA (Apapa / Ikeja GRA / Ikoyi / Victoria Island) under s.1(3) of the Lagos State Tenancy Law 2011. You MUST cite "the Recovery of Premises Act (Cap. R7 LFN 2004) and the Rules of the High Court of Lagos State" as the governing statute in the Governing Law clause. DO NOT cite the Lagos State Tenancy Law 2011 for this property — the LSTL 2011 does not apply. Jurisdiction: the High Court of Lagos State (the Magistrate\'s Court has no jurisdiction for excluded areas). Notice periods follow the common-law periodic-tenancy rules (at least one full period of the tenancy) and any specific notice provisions in the tenancy agreement itself.\n'
        : isLstlLagos
          ? '(i) *** MANDATORY STATUTE CITATION — DO NOT DEVIATE ***: This property is in Lagos State (outside the s.1(3) excluded areas). You MUST cite "the Lagos State Tenancy Law 2011 (Law No. 8 of 2011)" by name in the Governing Law clause. Jurisdiction: Magistrate\'s Court for tenancy recovery where annual rent is below the jurisdictional limit (s.47 LSTL); High Court of Lagos State otherwise. The statutory notice periods in paragraph (ii) below are MANDATORY — do not contract out of them to the tenant\'s disadvantage.\n'
          : '(i) NIGERIAN STATE-SPECIFIC TENANCY STATUTE — cite the correct state statute by name in the Governing Law clause:\n' +
            (ngStateRivers ? '     • RIVERS STATE: cite "Rivers State Rent Control and Recovery of Premises Edict 1983 (No. 6 of 1983)" — Magistrate\'s Court Port Harcourt for recovery; statutory notice periods consistent with LSTL pattern.\n' : '') +
            (ngStateAnambra ? '     • ANAMBRA STATE: cite "Anambra State Recovery of Premises Law (Cap. 138 Laws of Anambra State 1991)" — High Court Awka for recovery; equivalent statutory notice periods apply.\n' : '') +
            (ngStateOyo ? '     • OYO STATE: cite "Oyo State Recovery of Premises Law (Cap. 142 Laws of Oyo State 2000)" — Magistrate\'s Court / High Court Ibadan for recovery.\n' : '') +
            (ngStateKano ? '     • KANO STATE: cite "Kano State Rent Control and Recovery of Premises Edict 1986 (No. 7 of 1986)" — Magistrate\'s Court Kano for recovery.\n' : '') +
            (ngStateEnugu ? '     • ENUGU STATE: cite "Recovery of Premises Law of Eastern Nigeria (Cap. 118)" as adopted by Enugu State — High Court Enugu for recovery.\n' : '') +
            (ngStateAbia ? '     • ABIA STATE: cite "Recovery of Premises Law of Eastern Nigeria (Cap. 118)" as adopted by Abia State — Magistrate\'s Court Umuahia / Aba for recovery.\n' : '') +
            (ngStateImo ? '     • IMO STATE: cite "Recovery of Premises Law of Eastern Nigeria (Cap. 118)" as adopted by Imo State — Magistrate\'s Court Owerri for recovery.\n' : '') +
            (ngStateFCT ? '     • FCT ABUJA: cite "Recovery of Premises Act (Cap. R7 LFN 2004)" — federal statute applies in the FCT — High Court of the FCT Abuja for recovery.\n' : '') +
            (!ngStateRivers && !ngStateAnambra && !ngStateOyo && !ngStateKano && !ngStateEnugu && !ngStateAbia && !ngStateImo && !ngStateFCT
              ? '     • Other Nigerian state: cite the equivalent state Tenancy / Recovery of Premises Law if known, else fall back to the federal Recovery of Premises Act (Cap. R7 LFN 2004) as the residual statute.\n'
              : '') +
            '     LAGOS reference (for context, not the governing statute here): LSTL 2011 applies in non-excluded Lagos areas; Recovery of Premises Act applies in Apapa, Ikeja GRA, Ikoyi, Victoria Island.\n') +
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
  // TIER 4 — KENYA doc-type-specific clauses
  // ────────────────────────────────────────────────────────────────────────
  const kenyaTenancyClause = (isTenancyDoc || isQuitNoticeDoc) && isKenya
    ? '\n\nIMPORTANT — KENYAN TENANCY LAW: Apply:\n' +
      '(i) LANDLORD AND TENANT (SHOPS, HOTELS AND CATERING ESTABLISHMENTS) ACT (Cap. 301) — governs "controlled tenancies" of business premises. Termination only on statutory grounds (s.7). Business Premises Rent Tribunal has jurisdiction.\n' +
      '(ii) RENT RESTRICTION ACT (Cap. 296) — governs residential "controlled tenancies" (monthly rent below statutory ceiling, set periodically). Rent increases and eviction require Rent Restriction Tribunal approval.\n' +
      '(iii) LAND REGISTRATION ACT 2012 (No. 3 of 2012) — leases exceeding 5 years must be registered at the Land Registry to bind third parties (s.38(d)).\n' +
      '(iv) DISTRESS FOR RENT ACT (Cap. 293) — landlord\'s remedy of distress for arrears; strict procedure (certified court broker, 14-day notice).\n' +
      '(v) STAMP DUTY ACT (Cap. 480) — leases are dutiable: 1% of rent (urban), 1% (rural) — unstamped instruments inadmissible until penalty paid.\n' +
      '(vi) NOTICE PERIODS — for uncontrolled tenancies: periodic tenancy requires notice equal to the length of the period (weekly=1 wk, monthly=1 month). Controlled tenancies under Cap. 301 require 2 months\' notice by either party, in prescribed Form A / Form B.\n' +
      '(vii) DEPOSIT — no statutory cap, but industry practice is 1–2 months\' rent, refundable at end minus itemised deductions.\n' +
      'Governing law: Laws of Kenya. Jurisdiction: Business Premises Rent Tribunal (Cap. 301) or Environment and Land Court (land issues) or Chief Magistrate\'s Court (general tenancy claims below jurisdictional limit).'
    : ''

  const kenyaEmploymentClause = isEmploymentDoc && isKenya
    ? '\n\nIMPORTANT — KENYAN EMPLOYMENT / LABOUR LAW: Apply:\n' +
      '(i) EMPLOYMENT ACT 2007 (No. 11 of 2007) §9 — WRITTEN CONTRACT must be drawn up by the employer and consented to by the employee; where the employee is illiterate, the contract must be EXPLAINED to the employee in a language they understand before signature (employer bears the onus).\n' +
      '(ii) WRITTEN PARTICULARS — Employment Act §10 (NOT §35): written particulars of employment must be given within 2 months of commencement, covering name and address of employer, name/age/occupation/ID of employee, job description, hours of work, wages, leave, probation, termination, etc.\n' +
      '(iii) TERMINATION NOTICE — Employment Act §35: daily-wage contract = no prior notice (terminate at close of any day); weekly contract = 1 week; bi-weekly = 2 weeks; monthly contract = 28 days written notice (or payment in lieu). During probation (max 6 months extendable once under §42), minimum notice is 7 days or payment in lieu.\n' +
      '(iv) PAYMENT IN LIEU — Employment Act §36: payment in lieu equals wages the employee would have received during the notice period.\n' +
      '(v) ANNUAL LEAVE — §28: 21 working days minimum after 12 consecutive months of service, paid at normal rate. Pro-rata entitlement for part-year.\n' +
      '(vi) SICK LEAVE — §30: 7 days full pay + 7 days half pay after 2 months\' continuous service, per 12-month cycle.\n' +
      '(vii) MATERNITY LEAVE — §29: 3 months fully paid; no dismissal / disadvantage by reason of pregnancy.\n' +
      '(viii) TERMINATION VALIDITY & FAIRNESS — §45: dismissal is unfair unless employer proves a valid reason related to conduct, capacity, compatibility, or operational requirements, AND the employer observed the procedural fairness requirements (notice of reasons, hearing with representation per §41). Remedies (§49): reinstatement, re-engagement, or compensation up to 12 months\' gross salary.\n' +
      '(ix) WORK INJURY BENEFITS ACT 2007 (WIBA) — employer strictly liable for work-related injuries; must obtain and maintain insurance cover. Permanent total incapacity compensation based on 96 months\' earnings. Claims to Director of Occupational Safety and Health Services (DOSHS).\n' +
      '(x) NSSF ACT 2013 (No. 45 of 2013) — mandatory contributions: 6% employer + 6% employee of pensionable pay, capped at Tier I / Tier II per the statutory schedule.\n' +
      '(xi) NHIF ACT (Cap. 255) / SHIF under Social Health Insurance Act 2023 — mandatory health cover contributions, graduated per gross salary; employer remits monthly.\n' +
      '(xii) MINIMUM WAGE — Regulation of Wages (General) Order under Labour Institutions Act 2007; rates set periodically by the Cabinet Secretary (Labour) per sector and geography. Reference the current Gazette notice.\n' +
      '(xiii) PAYE — Income Tax Act (Cap. 470): graduated bands (10% / 25% / 30% / 32.5% / 35%); personal relief KES 2,400/month; employer withholds and remits monthly via iTax.\n' +
      '(xiv) GOVERNING LAW — Laws of Kenya. Jurisdiction: Employment and Labour Relations Court (exclusive under ELRC Act 2011 §12). Arbitration under Arbitration Act 1995 permitted for non-rights disputes.'
    : ''

  const kenyaNonCompeteClause = isNonCompeteDoc && isKenya
    ? '\n\nIMPORTANT — KENYAN NON-COMPETE LAW: Kenya inherited the English common-law doctrine of restraint of trade (via the Judicature Act Cap. 8). Apply:\n' +
      '(i) PRIMA FACIE VOID — all restraints on trade are prima facie void as against public policy. Enforceable only if the party seeking to enforce proves the restraint is reasonable between the parties AND reasonable in the public interest (Nordenfelt v Maxim Nordenfelt [1894] AC 535 applied).\n' +
      '(ii) EMPLOYMENT ACT 2007 §5 — prohibits restrictions on employee freedom after termination of employment EXCEPT reasonable restraints protecting legitimate interests. Codifies the common-law position.\n' +
      '(iii) LEGITIMATE PROTECTABLE INTEREST — employer must show a protectable interest (trade secrets, confidential information, customer connection, goodwill). Mere protection from competition is insufficient.\n' +
      '(iv) REASONABLENESS TEST — assessed on (a) scope of activity, (b) duration, (c) geography. Narrow drafting favoured. Typical enforceable duration: 6–12 months; 2+ years rarely upheld.\n' +
      '(v) KENYAN AUTHORITY — Kenya courts have applied Nordenfelt principles; see Attorney-General v Eastern and Southern African Trade & Development Bank (where restraint was read down); consult recent ELRC/ High Court decisions.\n' +
      '(vi) GARDEN LEAVE — paid garden leave is more readily enforceable than an unpaid post-termination restraint.\n' +
      '(vii) SEVERANCE / BLUE PENCIL — include a severance clause permitting the court to strike unreasonable portions without voiding the whole.\n' +
      'Jurisdiction: Employment and Labour Relations Court.'
    : ''

  const kenyaPropertyClause = (isDeedOfAssignmentDoc || isPowerOfAttorneyDoc) && isKenya
    ? '\n\nIMPORTANT — KENYAN LAND / PROPERTY LAW: Apply:\n' +
      '(i) LAND REGISTRATION ACT 2012 (No. 3 of 2012) — all dispositions of registered land (transfers, charges, leases >2 years) must be registered at the Land Registry in the prescribed form (typically LRA Form 3 for transfer). Registration confers indefeasibility of title (s.25).\n' +
      '(ii) LAND ACT 2012 (No. 6 of 2012) — consent requirements: transfers of agricultural land subject to Land Control Board consent under the Land Control Act (Cap. 302); County Government approvals for sub-divisions.\n' +
      '(iii) STAMP DUTY ACT (Cap. 480) — on transfers of immovable property: 4% of value for property in municipalities; 2% for property elsewhere. Stamping within 30 days of execution. Unstamped = inadmissible until penalty paid.\n' +
      '(iv) CAPITAL GAINS TAX — Income Tax Act (Cap. 470) Eighth Schedule: 15% CGT on gains from disposal of immovable property (rate increased from 5% effective 1 January 2023).\n' +
      '(v) POWER OF ATTORNEY — REGISTRATION OF DOCUMENTS ACT (Cap. 285): a Power of Attorney affecting interests in land or which the holder intends to use publicly must be registered at the Registrar-General (within 4 months of execution). Attested by a Commissioner for Oaths, Notary Public, or Judge/Magistrate.\n' +
      '(vi) CONSENTS — Land Control Act Cap. 302 for agricultural land; National Land Commission consent where applicable.\n' +
      '(vii) SESSIONAL LEASEHOLD — note constitutional cap on non-citizen leaseholds at 99 years (Article 65, Constitution of Kenya 2010).\n' +
      'Governing law: Laws of Kenya. Jurisdiction: Environment and Land Court.'
    : ''

  const kenyaLoanClause = isLoanDoc && isKenya
    ? '\n\nIMPORTANT — KENYAN LOAN / CREDIT LAW: Apply:\n' +
      '(i) BANKING ACT (Cap. 488) — banking business (deposit-taking, lending against deposits) reserved to CBK-licensed banks. Non-bank lenders must operate under Microfinance Act 2006, SACCO Societies Act 2008, or register as Digital Credit Providers with CBK.\n' +
      '(ii) CENTRAL BANK RATE (CBR) — benchmark rate published monthly by the CBK Monetary Policy Committee. Commercial interest typically stated as CBR + margin.\n' +
      '(iii) IN DUPLUM RULE — under Banking Act s.44A (as amended by the Finance Act 2006), interest plus ancillary charges in default CANNOT exceed the principal sum outstanding at the time of default. This is a statutory cap — any draft exceeding the rule is unenforceable to the extent of the excess.\n' +
      '(iv) SECURED TRANSACTIONS — Movable Property Security Rights Act 2017 + Movable Property Security Rights Regulations 2017: creation and registration of security interests in movable property with the Movable Property Security Rights Registry. Land charges under the Land Registration Act 2012.\n' +
      '(v) INSOLVENCY ACT 2015 — priority of secured creditors; preferential claims rank above unsecured in liquidation.\n' +
      '(vi) INTEREST RATE CAP HISTORY — note that the Banking (Amendment) Act 2016 capped interest at CBR + 4% and a floor of 70% of CBR for deposits. This cap was REPEALED by the Finance Act 2019 (effective November 2019) — interest rates are now contractually free subject to the In Duplum Rule.\n' +
      '(vii) STAMP DUTY — Stamp Duty Act Cap. 480: loan agreements dutiable at a nominal rate; secured loans dutiable at 0.1% of secured sum.\n' +
      'Governing law: Laws of Kenya. Jurisdiction: High Court of Kenya (Commercial and Tax Division) or Commercial Court.'
    : ''

  const kenyaCommercialClause = isCommercialDoc && isKenya
    ? '\n\nIMPORTANT — KENYAN COMMERCIAL LAW (Distribution / Supply): Apply:\n' +
      '(i) SALE OF GOODS ACT (Cap. 31) — based on English SGA 1893: implied conditions of title (s.14), description (s.15), merchantable quality and fitness for purpose (s.16), sample (s.17). These may be excluded by agreement subject to Consumer Protection Act and common-law unfairness limits.\n' +
      '(ii) CONSUMER PROTECTION ACT 2012 (No. 46 of 2012) — prohibits unfair practices (Part II), unconscionable contracts (s.7), mandates cooling-off for direct sales (s.10, 5 business days).\n' +
      '(iii) COMPETITION ACT 2010 (No. 12 of 2010) — Competition Authority of Kenya: prohibits restrictive trade practices (Part III, ss.21–24), merger control, abuse of dominance. Review exclusivity, territory, and RPM clauses accordingly.\n' +
      '(iv) KENYA BUREAU OF STANDARDS ACT (Cap. 496) — product standards (KS), pre-export verification of conformity (PVoC) for imports, mandatory standards compliance for regulated goods.\n' +
      '(v) CISG — Kenya is NOT a CISG contracting state; CISG applies only if expressly adopted.\n' +
      '(vi) VAT — VAT Act 2013 (No. 35 of 2013): standard rate 16%.\n' +
      'Governing law: Laws of Kenya. Jurisdiction: High Court (Commercial Division) Nairobi; arbitration under Arbitration Act 1995 / NCIA.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 4 — GHANA doc-type-specific clauses
  // ────────────────────────────────────────────────────────────────────────
  const ghanaTenancyClause = (isTenancyDoc || isQuitNoticeDoc) && isGhana
    ? '\n\nIMPORTANT — GHANAIAN TENANCY LAW: Apply:\n' +
      '(i) RENT ACT 1963 (Act 220) and RENT REGULATIONS 1964 (LI 369) — govern "recoverable premises" (residential and most commercial). Rent Control Department has primary jurisdiction over rent disputes.\n' +
      '(ii) RENT CONTROL (CALCULATION OF RENT) REGULATIONS — rents for covered premises set by the Rent Control Department based on a prescribed formula; landlord cannot unilaterally exceed controlled rent.\n' +
      '(iii) LAND ACT 2020 (Act 1036) — consolidates and repeals Conveyancing Act 1973, Land Registry Act 1962, Land Title Registration Law 1986. All land dispositions registered at the Lands Commission (s.12 LA 2020). Leases >3 years must be registered.\n' +
      '(iv) STAMP DUTY ACT 2005 (Act 689) — leases dutiable at 0.5% of total rent (ad valorem); unstamped = inadmissible until penalty paid.\n' +
      '(v) NOTICE PERIODS — Rent Act s.17: weekly tenancy = 1 week; monthly tenancy = 1 month; yearly or greater = 3 months by either party for recoverable premises. For uncontrolled premises, common-law periodic-tenancy rules apply.\n' +
      '(vi) RENT ADVANCE CAP — Rent Act s.25A (as amended): landlord cannot demand more than 6 months\' rent in advance for residential premises. Contravention is an offence + refundable.\n' +
      '(vii) GROUNDS FOR RECOVERY — Rent Act s.17 and Schedule: non-payment, breach of covenant, landlord\'s personal use (with 3 months\' notice and tribunal consent for controlled tenancies), premises required for alteration.\n' +
      'Governing law: Laws of the Republic of Ghana. Jurisdiction: Rent Control Department (rent + possession for controlled tenancies); District Court / High Court otherwise.'
    : ''

  const ghanaEmploymentClause = isEmploymentDoc && isGhana
    ? '\n\nIMPORTANT — GHANAIAN EMPLOYMENT / LABOUR LAW: Apply:\n' +
      '(i) LABOUR ACT 2003 (Act 651) §12 — WRITTEN CONTRACT required for employment of 6 months or more (or the equivalent number of working days within the year). Must be signed by both employer and employee.\n' +
      '(ii) WRITTEN PARTICULARS — Labour Act §13: within 2 months of commencement, employer must give a WRITTEN STATEMENT in the form set out in Schedule 1 to the Act covering: name of employer and employee; place of work; nature of work; date of commencement; rate and method of payment; hours of work; overtime; holidays; sick-leave; notice periods; and any applicable collective agreement.\n' +
      '(iii) NOTICE OF TERMINATION — Labour Act §17: (a) contracts of 3 years or more require 1 month written notice OR 1 month pay in lieu; (b) contracts of less than 3 years require 2 weeks written notice OR 2 weeks pay in lieu; (c) week-to-week contracts require 7 days notice. Notice can be improved but not reduced.\n' +
      '(iv) ANNUAL LEAVE — §20 Labour Act: 15 working days minimum after 12 continuous months.\n' +
      '(v) SICK LEAVE — §24 Labour Act: reasonable paid sick leave on production of a medical certificate from a registered medical practitioner.\n' +
      '(vi) MATERNITY — §57 Labour Act: 12 weeks\' paid maternity leave on medical certification (extendable for complications or multiple births). No dismissal on grounds of pregnancy.\n' +
      '(vii) NATIONAL PENSIONS ACT 2008 (Act 766) — 3-tier pension scheme. Tier 1 (Basic National Social Security Scheme, managed by SSNIT): 13.5% employer + 5.5% employee of basic salary = 18.5%; Tier 2 (mandatory occupational scheme): 5% employer to a privately managed fund; Tier 3 (voluntary provident fund): optional.\n' +
      '(viii) NATIONAL HEALTH INSURANCE ACT 2012 (Act 852) — mandatory NHIS; 2.5% component of the 18.5% Tier 1 goes to NHIS via SSNIT.\n' +
      '(ix) MINIMUM WAGE — §68 Labour Act: Daily National Minimum Wage set annually by the National Tripartite Committee and gazetted. Reference the current gazette before drafting.\n' +
      '(x) PAYE — Income Tax Act 2015 (Act 896): graduated rates; employer withholds and remits monthly via the Ghana Revenue Authority.\n' +
      '(xi) REDUNDANCY — §65 Labour Act: redundancy pay negotiated with the worker or union; minimum 4 weeks\' salary per year served is customary practice.\n' +
      '(xii) TERMINATION — §63 Labour Act: notice (or pay in lieu) for ordinary termination; summary dismissal only for serious misconduct after fair hearing. National Labour Commission hears unfair termination claims.\n' +
      'Governing law: Laws of the Republic of Ghana. Jurisdiction: National Labour Commission (unfair termination, §§140–142); High Court (contractual claims and statutory rights).'
    : ''

  const ghanaPropertyClause = (isDeedOfAssignmentDoc || isPowerOfAttorneyDoc) && isGhana
    ? '\n\nIMPORTANT — GHANAIAN LAND / PROPERTY LAW: Apply:\n' +
      '(i) LAND ACT 2020 (Act 1036) — comprehensive land law reform. s.12 — registration at the Lands Commission. s.31 — allodial title; s.37 — usufructuary interest; s.41 — leasehold. Consolidates and replaces the Conveyancing Act 1973, Land Registry Act 1962, and Land Title Registration Law 1986.\n' +
      '(ii) LANDS COMMISSION ACT 2008 (Act 767) — Lands Commission comprises the Survey and Mapping, Land Registration, Land Valuation, and Public and Vested Lands Management divisions. All instruments affecting land registered at the Land Registration Division.\n' +
      '(iii) STAMP DUTY ACT 2005 (Act 689) — transfers dutiable at 0.5% of consideration or open-market value (whichever higher). Stamping at the Ghana Revenue Authority within 30 days; unstamped = inadmissible until penalty paid.\n' +
      '(iv) CAPITAL GAINS TAX — Income Tax Act 2015 (Act 896) Schedule 3: 15% CGT on gains from disposal of chargeable assets including land (subject to principal-residence and other exemptions).\n' +
      '(v) CUSTOMARY LAW — where the assignor holds a customary or stool / skin interest, customary law principles and the consent of the stool / skin / family head may be required. Chieftaincy Act 2008 governs resolution of chieftaincy disputes over land.\n' +
      '(vi) POWER OF ATTORNEY — registered at the Land Registration Division if it affects immovable property; attested and stamped.\n' +
      '(vii) EXECUTION — under seal with attestation by two witnesses with names and addresses; corporate donors execute per the Companies Act 2019 (Act 992).\n' +
      'Governing law: Laws of the Republic of Ghana. Jurisdiction: High Court (Land Division) Accra or Kumasi, or Circuit Court for lower-value claims.'
    : ''

  const ghanaLoanClause = isLoanDoc && isGhana
    ? '\n\nIMPORTANT — GHANAIAN LOAN / CREDIT LAW: Apply:\n' +
      '(i) BORROWERS AND LENDERS ACT 2020 (Act 1052) — comprehensive borrower-lender framework. Requires registration of credit agreements at the Collateral Registry (Bank of Ghana) within 28 days of execution. Unregistered security interests are not enforceable against third parties (s.18).\n' +
      '(ii) BANKS AND SPECIALISED DEPOSIT-TAKING INSTITUTIONS ACT 2016 (Act 930) — banking business reserved to BoG-licensed institutions; capital adequacy, prudential norms, resolution regime.\n' +
      '(iii) NON-BANK FINANCIAL INSTITUTIONS ACT 2008 (Act 774) — governs finance houses, savings and loans companies, micro-credit institutions; all require BoG licence.\n' +
      '(iv) BANK OF GHANA POLICY RATE — benchmark rate set by the Monetary Policy Committee, published periodically; commercial interest typically MPR + margin.\n' +
      '(v) STAMP DUTY — Stamp Duty Act 2005 (Act 689): nominal on the loan agreement; ad valorem on secured instruments.\n' +
      '(vi) COLLATERAL REGISTRY — register all security interests (movable and certain immovable) to establish priority under the Borrowers and Lenders Act 2020. Priority runs from date of registration.\n' +
      '(vii) PRIORITY — Insolvency Act 2020 (Act 1015): secured creditors rank first in realisation of charged assets.\n' +
      '(viii) USURY — no specific usury statute, but courts may strike down unconscionable rates under common-law unfairness or the Contracts Act 1960 (Act 25) s.4 (illegal contracts).\n' +
      'Governing law: Laws of the Republic of Ghana. Jurisdiction: High Court (Commercial Division) Accra; arbitration under Act 798 with GAAC seat.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 4 — SOUTH AFRICA doc-type-specific clauses
  // ────────────────────────────────────────────────────────────────────────
  const southAfricaTenancyClause = (isTenancyDoc || isQuitNoticeDoc) && isSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN TENANCY LAW: Apply:\n' +
      '(i) RENTAL HOUSING ACT 50 of 1999 (as amended by the Rental Housing Amendment Act 35 of 2014) — primary residential-tenancy statute. Rental Housing Tribunal has jurisdiction over "unfair practices" disputes.\n' +
      '(ii) RENTAL HOUSING REGULATIONS 2001 — deposit MUST be held in an interest-bearing account; interest accrues to the tenant; deposit refundable within 14 days of termination (or 21 days where disputed), minus itemised damages.\n' +
      '(iii) CONSUMER PROTECTION ACT 68 of 2008 — applies to residential lettings except where landlord and tenant are both juristic persons of specified turnover. s.14 CPA: fixed-term agreement may be cancelled early by tenant on 20 business days\' notice, subject to a "reasonable cancellation penalty" (often capped by regulation). Tenant\'s right to renew: landlord must give 40–80 business days\' written notice of changes before expiry.\n' +
      '(iv) PIE ACT — PREVENTION OF ILLEGAL EVICTION FROM AND UNLAWFUL OCCUPATION OF LAND ACT 19 of 1998 — court order required before ANY eviction of an unlawful occupier. Self-help eviction is a criminal offence. Procedure: application to Magistrate\'s Court (or High Court for commercial) with notice to the occupier.\n' +
      '(v) STAMP DUTY — STAMP DUTIES ACT was repealed in 2009; NO stamp duty on leases in South Africa.\n' +
      '(vi) DEEDS REGISTRIES ACT 47 of 1937 s.77 — long leases (>10 years) may be registered against the title deed at the Deeds Office.\n' +
      '(vii) TERMINATION — s.14 CPA 20-business-day notice period for consumer leases; common-law notice "reasonable in the circumstances" for commercial leases; month-to-month lease typically 1-month notice.\n' +
      '(viii) SECTIONAL TITLES SCHEMES MANAGEMENT ACT 8 of 2011 — where the let property is in a sectional title scheme, body corporate rules bind the tenant.\n' +
      'Governing law: Laws of the Republic of South Africa. Jurisdiction: Rental Housing Tribunal (residential unfair-practice disputes); Magistrates\' Court (possession, monetary claims below jurisdictional limit); High Court (higher-value, commercial).'
    : ''

  const southAfricaEmploymentClause = isEmploymentDoc && isSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN EMPLOYMENT / LABOUR LAW: Apply:\n' +
      '(i) BASIC CONDITIONS OF EMPLOYMENT ACT 75 of 1997 (BCEA) — s.29: written particulars of employment on commencement (name, description, place, remuneration, hours, leave, notice, etc.).\n' +
      '(ii) NOTICE PERIODS — BCEA s.37: 1 week for service up to 6 months; 2 weeks for 6 months to 1 year; 4 weeks for 1+ years or if farm/domestic worker with 6+ months. Notice cannot be less than the BCEA minimum; may be improved.\n' +
      '(iii) ANNUAL LEAVE — BCEA s.20: 21 consecutive days per annual leave cycle (or 1 day per 17 days worked, or 1 hour per 17 hours worked). Paid at normal remuneration.\n' +
      '(iv) SICK LEAVE — BCEA ss.22–23: 30 days paid sick leave per 36-month cycle (after first 6 months\' service, in which the employee gets 1 day\'s sick leave per 26 days worked).\n' +
      '(v) FAMILY RESPONSIBILITY LEAVE — BCEA s.27: 3 days per annual leave cycle.\n' +
      '(vi) MATERNITY — BCEA s.25: 4 consecutive months\' unpaid maternity leave (paid via UIF per the Unemployment Insurance Act).\n' +
      '(vii) LABOUR RELATIONS ACT 66 of 1995 (LRA) — unfair dismissal (Chapter VIII), automatically unfair dismissals (s.187), procedural and substantive fairness. CCMA (Commission for Conciliation, Mediation and Arbitration) for referral within 30 days.\n' +
      '(viii) UIF (Unemployment Insurance Fund) — Unemployment Insurance Act 63 of 2001 + Unemployment Insurance Contributions Act 4 of 2002: 1% employer + 1% employee of monthly remuneration capped at the annual earnings ceiling (currently R17,712/month as of 2024, verify current).\n' +
      '(ix) SKILLS DEVELOPMENT LEVIES ACT 9 of 1999 — 1% of payroll payable by employers with payroll above threshold, remitted to SARS; recoverable from SETAs for training.\n' +
      '(x) COMPENSATION FOR OCCUPATIONAL INJURIES AND DISEASES ACT 130 of 1993 (COIDA) — employer\'s contribution based on industry risk rating; replaces civil claims for workplace injury.\n' +
      '(xi) NATIONAL MINIMUM WAGE ACT 9 of 2018 — national minimum wage set annually by the Minister (current 2024 rate R27.58/hour; verify current gazette).\n' +
      '(xii) PAYE — Income Tax Act 58 of 1962: graduated rates; employer deducts and remits monthly via SARS EMP201.\n' +
      '(xiii) EMPLOYMENT EQUITY ACT 55 of 1998 (EEA) — prohibits unfair discrimination (s.6); designated employers (50+ employees or specified turnover) must implement affirmative action and submit Employment Equity Report annually.\n' +
      '(xiv) PROTECTION OF PERSONAL INFORMATION ACT 4 of 2013 (POPIA) — applies to employee personal data; lawful basis, minimality, retention, security, cross-border transfer restrictions under s.72.\n' +
      'Governing law: Laws of the Republic of South Africa. Jurisdiction: CCMA (unfair dismissal within 30 days), Labour Court (strikes, review of CCMA awards), Bargaining Council where applicable, or Magistrate\'s Court / High Court for contractual claims.'
    : ''

  const southAfricaNonCompeteClause = isNonCompeteDoc && isSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN NON-COMPETE LAW: South Africa DIFFERS from Commonwealth positioning — restraints of trade are PRIMA FACIE VALID and ENFORCEABLE. Apply:\n' +
      '(i) CONSTITUTIONAL RIGHT TO TRADE — s.22 of the Constitution of the Republic of South Africa 1996: "Every citizen has the right to choose their trade, occupation or profession freely." Restraints are tested against this right.\n' +
      '(ii) MAGNA ALLOYS v ELLIS [1984] 4 SA 874 (A) — Appellate Division reversed the common-law position: restraint of trade is prima facie valid; the EMPLOYEE bears the onus to prove unreasonableness. This is the opposite of the English / Nigerian / Kenyan position.\n' +
      '(iii) REASONABLENESS TEST — applied by the Court in Basson v Chilwan [1993] 3 SA 742 (A): (a) is there an interest that deserves protection? (b) is such interest prejudiced by the restraint? (c) if so, how does that interest weigh up against the employee\'s interest in economic activity? (d) is there another facet of public policy that requires enforcement / non-enforcement?\n' +
      '(iv) LEGITIMATE PROTECTABLE INTEREST — trade secrets, confidential information, customer/goodwill connection. Mere competition is NOT protectable.\n' +
      '(v) DURATION — typical enforceable duration in SA is 12–24 months (longer than in Nigeria / Kenya because of the pro-enforcement presumption). 3+ years possible but fact-specific.\n' +
      '(vi) GEOGRAPHY — must correspond to the area of actual business / customer connection.\n' +
      '(vii) SEVERANCE / READ-DOWN — South African courts will READ DOWN unreasonable portions rather than strike the whole clause (Sasfin v Beukes [1989] 1 SA 1 (A) principle).\n' +
      '(viii) PUBLIC POLICY — NCA / CPA do not directly regulate non-compete clauses, but unconscionability jurisprudence under s.48 CPA 68 of 2008 may apply in consumer-facing restraints.\n' +
      'Governing law: Laws of the Republic of South Africa. Jurisdiction: Labour Court or High Court.'
    : ''

  const southAfricaPropertyClause = (isDeedOfAssignmentDoc || isPowerOfAttorneyDoc) && isSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN LAND / PROPERTY LAW: Apply:\n' +
      '(i) DEEDS REGISTRIES ACT 47 of 1937 — all transfers of immovable property must be registered at the Deeds Office. Registration is essential for the passing of dominium.\n' +
      '(ii) CONVEYANCING — only a CONVEYANCER (attorney admitted as a conveyancer under the Legal Practice Act 28 of 2014) may lodge a Deed of Transfer at the Deeds Office. The draft assignment / transfer must be prepared and executed in the conveyancer\'s presence.\n' +
      '(iii) TRANSFER DUTY ACT 40 of 1949 — sliding scale on the value of the property above the threshold (currently first R1,100,000 nil; then graduated up to 13% on value above R11m — verify current SARS tables). Transfer duty payable within 6 months of acquisition.\n' +
      '(iv) VAT — where the seller is a registered VAT vendor and the transaction is in the course of an enterprise, VAT (15%) applies INSTEAD of transfer duty.\n' +
      '(v) FICA — FINANCIAL INTELLIGENCE CENTRE ACT 38 of 2001 — estate agents and conveyancers are "accountable institutions" subject to KYC, record-keeping, and suspicious-transaction reporting obligations.\n' +
      '(vi) POWER OF ATTORNEY TO PASS TRANSFER — standard form required by the Deeds Office; executed by the seller before two witnesses and the conveyancer.\n' +
      '(vii) ALIENATION OF LAND ACT 68 of 1981 — sale of land must be in writing and signed by the parties (s.2). Agreements not in writing are of no force or effect.\n' +
      '(viii) CAPITAL GAINS TAX — Eighth Schedule to the Income Tax Act 58 of 1962: CGT on disposal of immovable property (primary-residence exclusion first R2m of gain).\n' +
      'Governing law: Laws of the Republic of South Africa. Jurisdiction: High Court (Land / Commercial Division); Deeds Office for registration.'
    : ''

  const southAfricaLoanClause = isLoanDoc && isSouthAfrica
    ? '\n\nIMPORTANT — SOUTH AFRICAN LOAN / CREDIT LAW: Apply:\n' +
      '(i) NATIONAL CREDIT ACT 34 of 2005 (NCA) — primary statute. Applies to ALL credit agreements where the borrower is a natural person (and small juristic persons below specified turnover). Requires credit provider REGISTRATION with the National Credit Regulator (NCR).\n' +
      '(ii) AFFORDABILITY ASSESSMENT — NCA s.81 read with the NCR\'s Affordability Assessment Regulations: credit provider must assess the consumer\'s ability to repay; reckless credit claims void the credit agreement.\n' +
      '(iii) COOLING-OFF — NCA s.121: 5 business days for consumers to rescind certain credit agreements (typically those entered into at a location other than the credit provider\'s registered business).\n' +
      '(iv) IN DUPLUM RULE — NCA s.103(5) (codifying common-law doctrine): total interest, fees, and charges that have ACCRUED but not been paid may not at any time exceed the unpaid balance of the principal debt at the time of default. Contracts breaching this rule are unenforceable to the extent of the excess.\n' +
      '(v) INTEREST RATE CAPS — NCA Regulations set maximum prescribed interest rates per credit category (mortgage, unsecured, short-term, etc.), calculated as a margin over the Repo Rate. Rates above cap = usurious and unenforceable.\n' +
      '(vi) SARB REPO RATE — benchmark set by the SARB Monetary Policy Committee; published on the SARB website and in the Gazette.\n' +
      '(vii) USURY ACT 73 of 1968 — LARGELY SUPERSEDED by the NCA; applies only to the limited residual agreements not covered by the NCA.\n' +
      '(viii) FINANCIAL SECTOR REGULATION ACT 9 of 2017 — twin-peaks regulation: PA (Prudential Authority, SARB) + FSCA (Financial Sector Conduct Authority).\n' +
      '(ix) DEBT REVIEW — NCA Part D: over-indebted consumers can apply for debt review; credit provider suspends enforcement.\n' +
      '(x) SECURITIES — General Law Amendment Act 50 of 1956; Deeds Registries Act for mortgage bonds; notarial bonds for movable property (General and Special Notarial Bonds Act 57 of 1956).\n' +
      'Governing law: Laws of the Republic of South Africa. Jurisdiction: Magistrates\' Court (NCA disputes within jurisdictional limit); High Court (higher-value); National Consumer Tribunal (NCR-related); arbitration under Arbitration Act 42 of 1965 / AFSA.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 4 — NIGERIA COMMERCIAL HYGIENE clauses (NDA + general commercial)
  // ────────────────────────────────────────────────────────────────────────
  // FIX 1: word-boundary regex prevents the previous endsWith('nda') bug
  // where any prompt mentioning India (or "agenda", "Honda", "Uganda") would
  // false-positive as an NDA and inject NDA-specific NG clauses into the
  // wrong document type. /\bnda\b/ matches only the standalone token.
  const isNdaDoc = lower.includes('non-disclosure agreement') || /\bnda\b/.test(lower)
  const isGeneralCommercialDoc = lower.includes('terms of service') || lower.includes('memorandum of understanding')
    || lower.includes(' mou') || lower.includes('letter of intent') || lower.includes(' loi ')
    || lower.includes('business partnership') || lower.includes('joint venture')
    || lower.includes('payment terms') || lower.includes('purchase agreement')

  const nigeriaNDAClause = isNdaDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN NDA / CONFIDENTIALITY LAW: Apply:\n' +
      '(i) NO STANDALONE TRADE-SECRET STATUTE — Nigeria does not have a dedicated trade-secrets act. Protection flows from (a) CONTRACT (the NDA itself), (b) EQUITABLE DOCTRINE OF BREACH OF CONFIDENCE (Coco v A.N. Clark (Engineers) [1969] RPC 41 applied by Nigerian courts), and (c) the implied equitable duty of confidence in fiduciary and employment relationships.\n' +
      '(ii) GAID 2025 PRIMACY / NDPA 2023 OVERLAY — GAID 2025 is the primary binding regulatory directive for data processing in Nigeria; NDPA 2023 is the underlying Act which GAID 2025 implements. Where "Confidential Information" includes personal data of third parties, both instruments apply concurrently: lawful basis [GAID 2025 (implementing NDPA 2023 s.25 [VERIFY])], data-subject rights [GAID 2025 (implementing NDPA 2023 s.34 [VERIFY])], cross-border transfer restrictions [GAID 2025 (implementing NDPA 2023 s.43 [VERIFY])]. The NDA should NOT purport to override data-subject rights by contract.\n' +
      '(iii) NIGERIAN AUTHORITIES — Adetoun Oladeji (Nig.) Ltd v N.B. Plc [2007] 5 NWLR (Pt.1027) 415 (Supreme Court on breach of confidence); Rabiu v AG Kaduna [1980] 8–11 SC 130; Microfeed Nigeria v Gov. of Kano State for confidential-information principles in commercial context.\n' +
      '(iv) REASONABLE DURATION — perpetual confidentiality obligations are enforceable where the information genuinely remains a trade secret; but where the information enters the public domain, the obligation falls away (absent contract to the contrary). Typical drafted duration: 3–5 years for ordinary business info; indefinite for trade secrets.\n' +
      '(v) NON-SOLICITATION / NON-DEALING — clauses restraining post-NDA solicitation of employees or customers are subject to the restraint-of-trade doctrine — must be reasonable in scope and duration (see Koumoulis v Leventis Motors).\n' +
      '(vi) REMEDIES — injunction (prohibitory and mandatory), damages (measured as loss of business / account of profits / unjust enrichment), delivery-up of materials.\n' +
      '(vii) DISPUTE RESOLUTION — Arbitration and Mediation Act 2023 is the current framework (repealed the Arbitration and Conciliation Act 2004). Reference AMA 2023 with Lagos seat for most commercial NDAs.\n' +
      '(viii) STAMP DUTY — NDAs are dutiable at a nominal rate as "agreements under hand" per Stamp Duties Act Sch.1.\n' +
      '\n\nNIGERIAN NDA — NDPA/GAID COMPLIANCE REQUIREMENTS (REVIEWED BY DATALEX CONSULTING)\n' +
      'The following 9 requirements are MANDATORY. Each must appear as a distinct, substantive clause in the generated NDA. A clause heading alone is NOT sufficient — each clause must contain operative obligations. Do not skip, summarise, or weaken any of these requirements.\n\n' +
      '1. LAWFUL BASIS FOR PROCESSING — MANDATORY\n' +
      '(a) The "Personal Data" definition MUST incorporate the full definition from NDPA 2023 Section 65 [VERIFY], covering any information relating to an identified or identifiable natural person, including information usable alone or in combination to identify a person.\n' +
      '(b) A SEPARATE "Sensitive Personal Data" sub-category MUST be defined per GAID 2025 (implementing NDPA 2023 Section 30 [VERIFY]), covering: genetic data, biometric data, health data, racial or ethnic origin, religious or philosophical beliefs, political opinions, trade union membership, sexual orientation.\n' +
      '(c) A dedicated clause titled "Lawful Basis for Processing" MUST require each party to: (i) declare in writing the specific lawful basis relied upon BEFORE processing any personal data shared under this Agreement; (ii) select the basis from those recognised under GAID 2025 (implementing NDPA 2023 Section 25 [VERIFY]): consent, contract performance, legal obligation, vital interests of the data subject, public interest, or legitimate interests; (iii) maintain written documentation of the chosen basis for regulatory inspection.\n\n' +
      '2. DATA MINIMISATION — MANDATORY\n' +
      'A dedicated clause titled "Data Minimisation" MUST: (a) expressly restrict any personal data shared under this Agreement to only what is strictly necessary to fulfil the defined Purpose; (b) prohibit collection, processing, or retention of personal data beyond that scope; (c) cite GAID 2025 (implementing NDPA 2023 Section 24(1)(c) [VERIFY]) as the statutory authority.\n\n' +
      '3. DATA RETENTION AND DELETION — MANDATORY\n' +
      'A dedicated clause titled "Data Retention and Deletion" MUST: (a) specify the retention period: personal data shall be retained for the duration of this Agreement plus 2 years where legally required, or 30 days following fulfilment of the Purpose, whichever is the shorter period [VERIFY with Rosemary — she will confirm the final recommended default]; (b) require secure deletion OR irreversible anonymisation of all personal data upon expiry of the retention period; (c) require written confirmation of deletion or anonymisation within 14 days of a request from the disclosing party; (d) cite the GAID 2025 retention directive as the primary authority.\n\n' +
      '4. SECURITY MEASURES (TECHNICAL AND ORGANISATIONAL) — MANDATORY\n' +
      'Replace any vague "appropriate security measures" language. A dedicated clause titled "Technical and Organisational Security Measures" MUST specify: (a) encryption of all personal data using industry-standard algorithms such as AES-256 or equivalent, applied both at rest and in transit; (b) role-based access controls with documented authorisation lists, restricting access to personal data to personnel who require it solely to fulfil the Purpose; (c) internal data governance processes including incident logging, access audit trails, and periodic (at minimum annual) compliance reviews; (d) an obligation to maintain these measures for the duration of the Agreement and the applicable retention period; (e) cite GAID 2025 (implementing NDPA 2023 Section 39 [VERIFY]) as the source of this obligation.\n\n' +
      '5. DATA SUBJECT RIGHTS — MANDATORY\n' +
      'A dedicated clause titled "Data Subject Rights" MUST: (a) acknowledge and give effect to the rights under GAID 2025 (implementing NDPA 2023 Sections 33–38 [VERIFY]): right of access, right to rectification, right to erasure, right to object, and right to data portability; (b) require each party to facilitate the exercise of these rights in relation to personal data for which it is responsible under this Agreement; (c) confirm each data subject\'s right to lodge a complaint with the Nigeria Data Protection Commission (NDPC); (d) require each party to respond to data subject requests within 30 days of receipt; (e) designate a named contact point at each party responsible for handling data subject requests.\n\n' +
      '6. AUDIT AND COMPLIANCE VERIFICATION — MANDATORY\n' +
      'A dedicated clause titled "Audit and Compliance Verification" MUST: (a) entitle each party to request, at any time, written evidence of the other party\'s compliance with its GAID 2025 and NDPA 2023 obligations under this Agreement; (b) entitle each party to conduct a reasonable compliance audit, or to accept an equivalent independent third-party audit report in lieu; (c) require 14 calendar days\' prior written notice before any audit; (d) provide that each party bears its own audit costs unless the audit reveals a material breach, in which case the breaching party bears the reasonable and documented costs of the audit.\n\n' +
      '7. CROSS-BORDER DATA TRANSFER — GAID 2025 SAFEGUARDS — MANDATORY\n' +
      'The cross-border transfer clause MUST be expanded to include: (a) a declaration that GAID 2025 is the primary framework governing international transfers of personal data originating from Nigeria; (b) a requirement that any transfer of personal data outside Nigeria must rely on one of: (i) an adequacy determination by the NDPC, (ii) binding contractual safeguards such as standard data transfer clauses, or (iii) where neither applies, the explicit and informed written consent of the affected data subjects; (c) an obligation to notify affected data subjects of any international transfer, including the destination country and the transfer mechanism used.\n\n' +
      '8. BREACH NOTIFICATION HIERARCHY — MANDATORY\n' +
      'The breach-notification clause MUST be structured as a TWO-STEP hierarchy:\n' +
      'STEP 1 — PARTY-TO-PARTY NOTIFICATION (IMMEDIATE, BEFORE REGULATORY REPORTING): Upon discovery of any actual or reasonably suspected personal data breach affecting data processed under this Agreement, the discovering party MUST notify the other party in writing within 24 hours of discovery, and in any event BEFORE making any regulatory notification. The notice MUST include: (i) the nature of the breach; (ii) the categories and approximate number of personal data records affected; (iii) the estimated number of data subjects affected; (iv) the remediation steps taken or proposed.\n' +
      'STEP 2 — REGULATORY NOTIFICATION (72-HOUR NDPC OBLIGATION — RETAIN): RETAIN the obligation to notify the NDPC within 72 hours of becoming aware of a personal data breach, as required by GAID 2025 (implementing NDPA 2023 Section 40 [VERIFY]). Do NOT reduce, limit, or remove this obligation.\n\n' +
      '9. CONFIDENTIALITY DURATION AND DATA PROTECTION SURVIVAL — MANDATORY\n' +
      'The confidentiality duration clause MUST: (a) specify the confidentiality period explicitly: obligations of confidentiality shall continue for 3 years from the date of termination or expiry of this Agreement, or such longer period as required by applicable law [VERIFY with Rosemary — she will set the final recommended default]; (b) include an express survival clause: data protection obligations (lawful basis, data minimisation, security measures, data subject rights, audit rights, cross-border transfer safeguards, and breach notification) SURVIVE termination or expiry of this Agreement for the full duration of the applicable retention period; (c) cite GAID 2025 (implementing NDPA 2023 Section 41 [VERIFY]) as the source of continuing post-termination obligations.\n\n' +
      'This Nigerian NDA has been reviewed for NDPA 2023 / GAID 2025 compliance gaps by DataLex Consulting (Barrister Rosemary Onu-Okeke, Esq. LL.B, B.L, MSc). Every instruction above is MANDATORY. Do not skip, summarise, or weaken any of the 9 numbered requirements. Where [VERIFY] tags appear, retain the exact statute citation provided — do NOT invent or substitute section numbers. Non-compliance with NDPA 2023 data protection obligations exposes parties to regulatory penalties under GAID 2025 (implementing NDPA 2023 Section 48 [VERIFY]) of up to ₦10,000,000 or 2% of annual gross revenue, whichever is greater.\n' +
      'Governing law: Laws of the Federal Republic of Nigeria. Jurisdiction: Federal High Court (IP / confidential-information disputes relating to patents/copyright) or State High Court (pure contract / equity).'
    : ''

  const nigeriaCommercialGeneralClause = isGeneralCommercialDoc && isNigeria
    ? '\n\nIMPORTANT — NIGERIAN COMMERCIAL / TRANSACTIONAL LAW (general): Apply:\n' +
      '(i) CAMA 2020 — Companies and Allied Matters Act: s.746+ (partnerships); Part B / Chapter 2 (registration of business names); s.862+ (incorporated trustees). For partnerships >20 persons OR carrying on business jointly for profit with legal personality, registration with CAC is required.\n' +
      '(ii) JOINT VENTURES — contractual JVs do not require incorporation; corporate JVs are incorporated as limited liability companies under CAMA 2020. Nigerian Investment Promotion Commission Act (Cap. N117) — foreign investment vehicles register with NIPC; may require approvals under the Foreign Exchange (Monitoring and Miscellaneous Provisions) Act.\n' +
      '(iii) TAX — Federal Inland Revenue Service: Companies Income Tax Act (30% for large, 20% for medium, 0% for small companies per Finance Act 2020); Value Added Tax Act (7.5% standard rate since Finance Act 2020); Personal Income Tax Act; Withholding Tax regulations (various rates 5–10% depending on transaction).\n' +
      '(iv) FCCPA 2018 (Federal Competition and Consumer Protection Act) — for consumer-facing terms: prohibits unfair terms (s.127), misleading conduct (s.116), product liability (s.136). FCCPC + FCCPT enforce.\n' +
      '(v) ARBITRATION AND MEDIATION ACT 2023 — primary ADR framework for commercial disputes. Seat: Lagos (typical), Abuja, or institutional (LCA / NCIA / ICC). Emergency-arbitrator provisions (s.16), third-party funding recognised (s.61).\n' +
      '(vi) STAMP DUTY — Stamp Duties Act (Cap. S8 LFN 2004): agreements under hand (nominal), instruments with quantifiable consideration (ad valorem 0.78% / other rates). MOU / LOI / binding instruments dutiable; non-binding LOI / MOU may be treated as nominal.\n' +
      '(vii) TERMS OF SERVICE — where serving Nigerian consumers, apply FCCPA 2018 s.127 unfair-terms prohibition + NDPA 2023 data-protection obligations + NCC regulations (telecom) if applicable.\n' +
      '(viii) BUSINESS PROPOSALS / LOI — typically non-binding memoranda; include an express "subject to contract" / "non-binding except for exclusivity, confidentiality, costs" carve-out to avoid unintended binding effect.\n' +
      '(ix) PAYMENT TERMS — Bills of Exchange Act (Cap. B8); Factors Act; letter-of-credit practice under UCP 600 as commonly adopted.\n' +
      'Governing law: Laws of the Federal Republic of Nigeria (specify state). Jurisdiction: Federal High Court (corporate, tax, IP, foreign-exchange) or State High Court (general contract); arbitration under AMA 2023.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // TIER 4 — US / CANADA doc-type-specific clauses
  // ────────────────────────────────────────────────────────────────────────
  const usEmploymentClause = isEmploymentDoc && (isUSA || isCalifornia)
    ? '\n\nIMPORTANT — US EMPLOYMENT LAW: Apply:\n' +
      '(i) AT-WILL EMPLOYMENT DOCTRINE — employment may be terminated by either party at any time, for any reason or no reason, without notice, UNLESS (a) contract specifies otherwise, (b) employment is in Montana (Wrongful Discharge from Employment Act 1987 — just cause required after probationary period), (c) termination is for a reason prohibited by federal law (Title VII Civil Rights Act 1964, ADEA, ADA, FMLA retaliation, NLRA concerted activity, OSHA whistleblower, etc.) or state law, or (d) implied-contract or public-policy exceptions apply.\n' +
      '(ii) FLSA — FAIR LABOR STANDARDS ACT (29 U.S.C. §§201+): federal minimum wage $7.25/hour (many states higher); overtime at 1.5x for non-exempt employees over 40 hours/week; exemption categories (executive, administrative, professional, outside sales, computer) have specific duties tests and salary thresholds.\n' +
      '(iii) WORKER CLASSIFICATION — IRS 20-Factor / Common Law Test for employees; ABC Test in California, Massachusetts, New Jersey, others (worker is independent contractor ONLY if A: free from control, B: work outside usual course of hiring entity\'s business, C: engaged in independently established trade/occupation). Misclassification triggers back-wages, taxes, penalties.\n' +
      '(iv) TAX FORMS — Employees: Form W-2 (year-end), I-9 (employment verification), W-4 (withholding). Independent contractors: Form 1099-NEC (if ≥$600/year) or 1099-MISC; no withholding; contractor self-pays self-employment tax (15.3%).\n' +
      '(v) STATE-SPECIFIC — reference user\'s state: CALIFORNIA (Labor Code §2802 expense reimbursement, WARN Act 75+ employees 60-day notice, CalWARN 75+, meal/rest breaks, PAGA class actions, SB 1162 pay transparency, non-compete void under Bus. & Prof. Code §16600); NEW YORK (NYLL frequency of pay by classification, NYSHRL anti-discrimination, pay-transparency amendments 2023); TEXAS (at-will, payday law Tex. Lab. Code §61); ILLINOIS (BIPA for biometric data); WASHINGTON (non-compete restrictions RCW 49.62); MASSACHUSETTS (non-compete requires garden leave / mutually agreed consideration, M.G.L. c.149 §24L).\n' +
      '(vi) COBRA — Consolidated Omnibus Budget Reconciliation Act (29 U.S.C. §1161+): continuation of group health coverage for 18 months post-termination (36 months for certain qualifying events) at employee expense for employers with 20+ employees.\n' +
      '(vii) FMLA — Family and Medical Leave Act (29 U.S.C. §2601+): 12 weeks unpaid leave with job protection for covered employers (50+ employees within 75 miles) and eligible employees (12+ months, 1,250+ hours).\n' +
      '(viii) ERISA — Employee Retirement Income Security Act: governs employer-sponsored pension and health plans; fiduciary duties.\n' +
      '(ix) WORKERS\' COMP — state-specific; typically mandatory; bars most civil claims for workplace injury.\n' +
      '(x) IMMIGRATION — I-9 within 3 business days; E-Verify mandatory in certain states and for federal contractors.\n' +
      'Governing law: specified US state law (federal law overrides where applicable). Jurisdiction: federal court (federal-question, diversity, or FLSA collective); state court or agency (EEOC, state FEP agency) per claim.'
    : ''

  // FIX 8 — US state-specific employment sub-clauses. Each fires ONLY when
  // both the US employment doc AND the specific state are detected (in the
  // jurisdiction-scoped fields). California already has californiaClause for
  // most cases; this adds extra employment-specific California depth as well.
  const californiaEmploymentClause = isEmploymentDoc && isCalifornia
    ? '\n\nCALIFORNIA EMPLOYMENT — apply on top of general US employment law:\n' +
      '• Cal. Labor Code §2802 — employer must reimburse all necessary expenses incurred by employee in discharge of duties (cell phone, mileage, home-office where required).\n' +
      '• Cal. Bus. & Prof. Code §16600 — non-compete clauses are VOID. Do not include post-employment non-competes; even non-solicitation of customers is restricted to trade-secret protection (Edwards v Arthur Andersen [2008] 44 Cal.4th 937).\n' +
      '• Meal & rest breaks — Cal. Labor Code §§512, 226.7: 30-minute unpaid meal break for shifts >5 hours, second meal break for shifts >10 hours; 10-minute paid rest break per 4 hours worked. Premium pay (1 hour wages) for missed breaks.\n' +
      '• WARN Act (CalWARN) — Cal. Labor Code §§1400-1408: 60-day notice for plant closing / mass layoff at any covered establishment with 75+ employees.\n' +
      '• AB 5 ABC Test (codified at Cal. Labor Code §2750.3) — independent-contractor classification: worker is contractor ONLY if A: free from control, B: work outside usual course of hiring entity\'s business, C: customarily engaged in independently established trade. Strict; many traditional 1099 categories now misclassified.\n' +
      '• Pay transparency — SB 1162 (2023): employers with 15+ employees must include pay scale in job postings; provide pay scale to current employees on request.\n' +
      '• PAGA — Private Attorneys General Act allows employees to sue on behalf of state for Labor Code violations. Recent reform AB 2288 (2024) limits scope but does not eliminate.'
    : ''

  const newYorkEmploymentClause = isEmploymentDoc && isUsStateNY
    ? '\n\nNEW YORK EMPLOYMENT — apply on top of general US employment law:\n' +
      '• NYLL (New York Labor Law) §191 — frequency of pay: manual workers weekly, clerical / other semi-monthly. Common compliance gap for employers using bi-weekly for manual workers (recent class-action wave).\n' +
      '• NYLL §195(1) — Wage Theft Prevention Act (WTPA): written notice of pay rate, pay date, allowances, employer name/address must be provided at hire and on rate change. Failure = $50/day damages capped at $5,000.\n' +
      '• NYSHRL — New York State Human Rights Law: anti-discrimination, broader than federal Title VII; applies to all employers regardless of size; includes gender identity, sexual orientation, predisposing genetic characteristics.\n' +
      '• Pay transparency (NY Labor Law §194-b, effective Sept 2023): job postings for positions performed at least partially in NY must disclose compensation range.\n' +
      '• NY Paid Family Leave — up to 12 weeks paid family leave; employee-funded payroll deduction (~0.45% of wages 2025).\n' +
      '• Non-competes — generally enforceable if reasonable; recent legislative attempts to ban have stalled. Garden-leave consideration recommended.\n' +
      'Jurisdiction: NY state court (Supreme Court) or federal SDNY/EDNY; NYSHRL claims to NY State Division of Human Rights or court.'
    : ''

  const texasEmploymentClause = isEmploymentDoc && isUsStateTX
    ? '\n\nTEXAS EMPLOYMENT — apply on top of general US employment law:\n' +
      '• At-will doctrine — broadly applied; few exceptions (Sabine Pilot public-policy exception narrow).\n' +
      '• Tex. Labor Code §61 (Texas Payday Law) — wages due on or before next regular pay day after termination. Final pay: discharge = within 6 days; voluntary quit = next regular pay date.\n' +
      '• No state minimum wage above federal — Texas defaults to FLSA $7.25/hour.\n' +
      '• No state-mandated meal/rest breaks (FLSA federal rules apply only to break compensation).\n' +
      '• Non-competes — Tex. Bus. & Com. Code §15.50: enforceable if (a) ancillary to otherwise enforceable agreement, (b) contains reasonable limitations on time / geography / scope. Marsh USA v Cook [2011] confirmed enforceability standards.\n' +
      '• No state version of WARN — federal WARN Act (100+ employees) is the only mass-layoff notice requirement.\n' +
      'Jurisdiction: Texas state district court or federal court; Texas Workforce Commission for unemployment / wage claims.'
    : ''

  const floridaEmploymentClause = isEmploymentDoc && isUsStateFL
    ? '\n\nFLORIDA EMPLOYMENT — apply on top of general US employment law:\n' +
      '• At-will doctrine — strongly applied; very few public-policy exceptions.\n' +
      '• Fla. Stat. §542.335 — non-competes ENFORCEABLE if employer demonstrates legitimate business interest (trade secrets, customer relationships >3 months, training / specialised investment) AND restraint is reasonable (presumed reasonable: ≤6 months for non-customer-relationship cases, ≤2 years for customer-relationship cases). Florida is one of the most employer-friendly non-compete jurisdictions in the US.\n' +
      '• No state minimum wage law of consequence — Fla. Const. Art. X §24 sets minimum at $13/hour (2024) rising to $15/hour (Sept 2026).\n' +
      '• No state-mandated meal/rest breaks (FLSA only).\n' +
      '• Final pay — no state requirement for prompt final wages; common-law contract terms apply.\n' +
      '• Florida Civil Rights Act 1992 — anti-discrimination; mirrors Title VII. Jurisdiction: Florida Commission on Human Relations or court.\n' +
      'Jurisdiction: Florida circuit court or federal court; Department of Economic Opportunity for unemployment.'
    : ''

  const illinoisEmploymentClause = isEmploymentDoc && isUsStateIL
    ? '\n\nILLINOIS EMPLOYMENT — apply on top of general US employment law:\n' +
      '• 820 ILCS 90/ — Illinois Freedom to Work Act (as amended 2022): non-competes VOID for employees earning ≤ $75,000/year; non-solicits VOID for employees earning ≤ $45,000/year (income thresholds adjusted annually). Above thresholds, must be reasonable in scope/duration/geography AND supported by adequate consideration.\n' +
      '• 740 ILCS 14/ — BIPA (Biometric Information Privacy Act): written notice + written consent required before collecting biometric data (fingerprints, face geometry, etc.). $1,000 negligent / $5,000 reckless statutory damages per violation. Major employer-class-action exposure.\n' +
      '• 820 ILCS 105/ — Illinois Minimum Wage Law: state minimum $14/hour (2024), $15/hour (Jan 2025).\n' +
      '• Illinois One Day Rest in Seven Act — at least 24 consecutive hours of rest in every calendar week.\n' +
      '• Illinois Paid Leave for All Workers Act (effective Jan 2024) — minimum 40 hours / 5 days paid leave per year for any reason.\n' +
      '• Illinois Human Rights Act (775 ILCS 5/) — broader than Title VII; covers employers with 15+ (1+ for sexual harassment).\n' +
      'Jurisdiction: Illinois Circuit Court or federal court; Illinois Department of Human Rights for IHRA claims.'
    : ''

  const washingtonEmploymentClause = isEmploymentDoc && isUsStateWA
    ? '\n\nWASHINGTON EMPLOYMENT — apply on top of general US employment law:\n' +
      '• RCW 49.62 — Washington non-compete statute: VOID unless (a) employee earns > $116,594 annually (2024 threshold, adjusted yearly), OR (b) independent contractor earns > $291,485 annually. Employer must disclose terms to employee in writing at offer. Garden leave required for layoff-triggered non-compete.\n' +
      '• Pay transparency — RCW 49.58.110 (effective Jan 2023): job postings for employers with 15+ employees must include wage scale and benefits.\n' +
      '• WA Paid Family & Medical Leave (RCW 50A) — up to 12 weeks paid; funded by payroll premiums (~0.74% of wages, split employer/employee).\n' +
      '• Final pay — RCW 49.48.010: wages due at end of next pay period after termination.\n' +
      '• WA Minimum Wage Act (RCW 49.46) — state minimum $16.28/hour (2024).\n' +
      '• Long-Term Services and Supports Trust Act (RCW 50B.04) — payroll tax (0.58% of wages) for long-term care insurance, employee can opt out under narrow conditions.\n' +
      '• Washington Law Against Discrimination (RCW 49.60) — broader than Title VII; covers employers with 8+; includes gender identity, sexual orientation.\n' +
      'Jurisdiction: WA Superior Court or federal Western/Eastern District of Washington; WA Human Rights Commission for WLAD claims.'
    : ''

  const canadaEmploymentClause = isEmploymentDoc && isCanada && !isQuebec
    ? '\n\nIMPORTANT — CANADIAN EMPLOYMENT LAW: Apply:\n' +
      '(i) JURISDICTION SPLIT — Canada is a federation; most employment is provincially regulated UNLESS the employer is in a federally regulated industry (banks, telcos, inter-provincial transport, federal agencies). Federally regulated: Canada Labour Code (R.S.C. 1985, c. L-2). Provincially regulated: Employment Standards Act/Code of the specific province.\n' +
      '(ii) PROVINCIAL ESAs — ONTARIO Employment Standards Act 2000 (S.O. 2000, c. 41): s.57 notice 1 wk (3 mo–1 yr service), 2 wk (1–3 yr), +1 wk/yr up to 8 wk; s.64 severance pay where employer has ≥$2.5M payroll AND employee has 5+ yr service = 1 wk per year served, capped at 26 wk. BC Employment Standards Act: s.63 length-of-service compensation. Alberta Employment Standards Code: s.55–56 termination notice. NAME the specific province in the contract.\n' +
      '(iii) COMMON-LAW REASONABLE NOTICE — statutory minimums are a FLOOR, not a ceiling. Common-law reasonable notice calculated per the BARDAL FACTORS (Bardal v Globe & Mail Ltd [1960] OR 1102): (a) age of employee, (b) length of service, (c) character of employment (nature of role, level of responsibility), (d) availability of similar employment considering the employee\'s experience, training, and qualifications. Typical common-law notice: 1 month per year of service, but varies widely (more for older / senior / longer-tenured employees; capped informally around 24 months).\n' +
      '(iv) ENFORCEABLE LIMITATION — to displace common-law notice with a contractual term, the contract must CLEARLY and UNAMBIGUOUSLY limit notice to the statutory minimum (or any other figure), AND the clause must COMPLY with the ESA at ALL possible future points of termination (Waksdale v Swegon North America Inc [2020] ONCA 391 — if the "for cause" clause violates the ESA, the "without cause" clause is also void).\n' +
      '(v) CPP — Canada Pension Plan (R.S.C. 1985, c. C-8): employer + employee contributions on earnings up to the Year\'s Maximum Pensionable Earnings (YMPE; 2025: $71,300). Standard rate: 5.95% each. Additional CPP (CPP2): 4% each on earnings between YMPE and YAMPE (2025: $81,200).\n' +
      '(vi) EI — Employment Insurance Act: employee 1.64% up to $65,700 (2025); employer 1.4x employee rate. Lower in Quebec (separate QPIP).\n' +
      '(vii) INCOME TAX — Income Tax Act: federal tax + provincial tax. Employer withholds via payroll (TD1 / TD1ON / etc.); remits to CRA monthly.\n' +
      '(viii) PROVINCIAL HEALTH — Ontario Health Premium (Ontario Taxation Act 2007); Manitoba Health and Post-Secondary Education Tax Levy (1.95% / 4.3% of payroll); BC Employer Health Tax (1.95% / 2.925%).\n' +
      '(ix) STATUTORY HOLIDAYS — province-specific. Ontario: 9 paid public holidays under ESA. BC: 10. Quebec: 8 + Fête nationale.\n' +
      '(x) MINIMUM WAGE — provincial; ON: $17.20/hr (as of Oct 2024, verify current); BC: $17.40/hr; AB: $15/hr; QC: $15.75/hr; federal min wage for federally regulated: $17.30/hr (April 2024).\n' +
      '(xi) HUMAN RIGHTS — provincial Human Rights Codes + Canadian Human Rights Act (federally regulated): prohibited grounds (race, sex, age, disability, religion, gender identity, etc.).\n' +
      '(xii) TERMINATION AT COMMON LAW — just cause is a high bar (McKinley v BC Tel [2001] 2 SCR 161). Without cause = statutory minimums + common-law reasonable notice unless effectively contracted out.\n' +
      'Governing law: Laws of the specified Canadian province and the federal laws of Canada applicable therein. Jurisdiction: that province\'s Superior Court of Justice / Supreme Court / Court of King\'s Bench. Use Canadian spelling (labour, organisation, cheque).'
    : ''

  const usCanadaPropertyClause = (isTenancyDoc || isQuitNoticeDoc) && (isUSA || isCalifornia || (isCanada && !isQuebec))
    ? '\n\nIMPORTANT — US / CANADA RESIDENTIAL TENANCY LAW: Apply:\n' +
      (isCanada ? '(i) CANADA — PROVINCIAL RESIDENTIAL TENANCIES STATUTES govern residential tenancies; NAME the specific province: ONTARIO Residential Tenancies Act 2006 (S.O. 2006, c. 17) — Landlord and Tenant Board has exclusive jurisdiction; rent-increase-guideline applies annually (exception: newly built units after 15 November 2018). BRITISH COLUMBIA Residential Tenancy Act SBC 2002, c. 78 — Residential Tenancy Branch. ALBERTA Residential Tenancies Act SA 2004, c. R-17.1. Notice periods: Ontario N12 / N13 for landlord\'s own use / demolition with 60 days\' notice. Security deposits: Ontario = last month\'s rent (no damage deposit allowed); BC ≤ half of first month\'s rent + pet deposit; Alberta ≤ 1 month\'s rent.\n' +
      '(ii) CANADA — HUMAN RIGHTS CODE protections apply to residential leasing (race, family status, disability, source of income in some provinces, etc.). Illegal to refuse on prohibited ground.\n' +
      '(iii) PIPEDA + provincial privacy apply to tenant personal data.\n' : '') +
      (isUSA || isCalifornia ? '(i) US — STATE LANDLORD-TENANT LAW governs residential tenancies; NAME the specific state: CALIFORNIA Civ. Code §§1940–1954.05 + Tenant Protection Act of 2019 (AB 1482) — rent cap CPI + 5% up to 10%, just-cause eviction after 12 months. NEW YORK Real Property Law §§220+ + RPAPL + NYC Rent Stabilization. TEXAS Property Code Title 8. FLORIDA Fla. Stat. ch. 83.\n' +
      '(ii) US — SECURITY DEPOSIT LIMITS: varies by state (CA 1 month unfurnished / 2 months furnished post-2024 AB 12; NY 1 month Real Prop. Law §7-108; FL no cap but holding requirements; TX no cap).\n' +
      '(iii) US — IMPLIED WARRANTY OF HABITABILITY: common-law in most states (Javins v First National Realty [1970] for DC doctrine); codified in many state codes (CA Civ. Code §1941).\n' +
      '(iv) US — FAIR HOUSING ACT (42 U.S.C. §3601+): prohibits discrimination on race, colour, national origin, religion, sex (including gender identity / sexual orientation per Bostock), familial status, disability. State / local laws may add protected classes (source of income, age, lawful source of income).\n' +
      '(v) US — NOTICE PERIODS: tenancy-at-will = at least the rent period (e.g., monthly = 30 days); fixed-term = end of term (no notice required unless state law otherwise). Specific state rules vary (CA requires 60 days for tenancies of 1+ year; 30 days otherwise).\n' +
      '(vi) US — EVICTION: must be via state court process (unlawful detainer / FED / summary ejectment); SELF-HELP EVICTION is illegal in virtually all states.\n' : '') +
      'Governing law: the specified state / province. Jurisdiction: state landlord-tenant court or provincial RTB / LTB.'
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
      '(i) *** DO NOT DEFAULT TO CALIFORNIA, DELAWARE, OR U.S. LAW ***: A frequent LLM failure mode is falling back to U.S. jurisdictions when no specific country is referenced in the prompt. NEVER do this. Use the jurisdiction the user explicitly specified; if the user specified no jurisdiction at all, cite "the applicable laws of the governing jurisdiction as selected by the parties" and defer to English common-law principles as a neutral baseline — NOT U.S. law.\n' +
      '(ii) COMMONWEALTH COMMON-LAW CONTRACT PRINCIPLES — for jurisdictions whose law is based on English common law (most African, Caribbean, South Asian, and Pacific jurisdictions): offer, acceptance, consideration, intention to create legal relations, capacity, legality. Draft the document in line with these universal requirements.\n' +
      '(iii) CISG — for cross-border sale of goods, note the United Nations Convention on Contracts for the International Sale of Goods (Vienna 1980) applies if both parties\' jurisdictions are contracting states, unless expressly excluded.\n' +
      '(iv) LOCAL CURRENCY — denominate amounts in the local currency of the specified jurisdiction (or USD if the user has expressly so specified).\n' +
      '(v) FORUM SELECTION — name the most senior commercial court in the capital city of the specified jurisdiction (e.g. "the High Court sitting in [capital city]") for exclusive jurisdiction. For arbitration, suggest the most proximate institutional arbitration centre.\n' +
      '(vi) CAUTIONARY TONE — because the system does not have a verified statute library for this jurisdiction, reference specific local statutes conservatively or by generic description (e.g. "the applicable labour law of [jurisdiction]"), rather than naming specific statutes that may not exist or have been repealed.\n' +
      '(vii) DATA PROTECTION — where the document touches personal data, reference "the applicable data-protection law of [jurisdiction]" and list the UNIVERSAL baseline rights (notice, consent, access, rectification, erasure, breach notification).\n' +
      '(viii) INVITATION TO VERIFY — the drafted document should include a cover note inviting the user to have a locally qualified legal practitioner review the governing-law and dispute-resolution clauses, since local statutory specifics may displace general principles.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // EXECUTION FORMALITIES — applies to ALL non-DPA documents
  // ────────────────────────────────────────────────────────────────────────
  // The default prompt used to say "End with a signature block" with zero
  // specificity — Claude would often produce a single signature line per
  // party with no witnesses, no "IN WITNESS WHEREOF" preamble, no execution
  // formalities. For a document that's meant to be presented to a
  // counterparty (or enforced in court), that's professionally embarrassing.
  // This clause forces a consistent legal-grade execution section.
  const executionFormalitiesClause = !isDpa
    ? '\n\nMANDATORY EXECUTION / SIGNATURE BLOCK (non-negotiable — include this EXACTLY as described at the END of every document):\n' +
      '1. IN WITNESS WHEREOF preamble — begin the execution section with: "IN WITNESS WHEREOF, the Parties have hereunto set their hands and seals the day and year first above written." (adapt phrasing slightly if the governing-law jurisdiction uses a different convention, but keep an equivalent formal preamble).\n' +
      '2. PER-PARTY EXECUTION BLOCK — for EACH signatory party, provide:\n' +
      '     • A block titled with the party\'s full legal name and role (e.g., "SIGNED by the Landlord" / "SIGNED by the Tenant" / "SIGNED on behalf of [Company Name]")\n' +
      '     • A signature line: "Signature: _____________________________"\n' +
      '     • Printed-name line: "Name: _____________________________"\n' +
      '     • Role/title line if applicable (for corporate parties): "Title: _____________________________"\n' +
      '     • Date line: "Date: _____________________________"\n' +
      '     • Place of execution line: "Place: _____________________________"\n' +
      '3. TWO WITNESSES PER PARTY (Nigerian / Commonwealth standard) — immediately after each party\'s signature block, add TWO attesting-witness blocks formatted:\n' +
      '     • "WITNESS 1 (to the [Party role]):"  then Signature / Name / Address / Occupation / Date lines (same format as above with one Address line and one Occupation line added)\n' +
      '     • "WITNESS 2 (to the [Party role]):"  same format\n' +
      '   Do this for every party. Two witnesses per party is mandatory for Nigerian deeds and strongly customary for other Nigerian / Commonwealth instruments. For purely U.S. documents (Delaware corporate docs, California consumer agreements) one witness or a notary block is acceptable — use jurisdictional judgement.\n' +
      '4. DEED-OF-ASSIGNMENT + POWER-OF-ATTORNEY UPGRADE — if the document is a Deed of Assignment or Power of Attorney, REPLACE the "IN WITNESS WHEREOF" preamble with "EXECUTED AS A DEED" and require the signature to be delivered under seal. Add a "DELIVERED by the [party] in the presence of:" phrasing before each witness block.\n' +
      '5. TENANCY SCHEDULE — for a Tenancy Agreement, add a final section titled "SCHEDULE 1 — DESCRIPTION OF THE PREMISES" at the very end (after the execution blocks) containing: full property address; description of the demised premises (house / flat / shop number, floors, rooms, any common areas demised); a reference to any attached floor plan ("Annexure A"); and any fixtures and fittings included (furniture, appliances, air-conditioning units). Keep this purely descriptive — not legal language.\n' +
      '6. DEFINITIONS BEFORE EXECUTION — do NOT put signature lines ahead of any substantive clause. The execution section is strictly the LAST section of the document (before any schedules). Keep schedules after the execution blocks.\n' +
      '7. NO POST-SIGNATURE COMMENTARY — the document ends with the last witness line (or end of Schedule 1, whichever is later). Do not append "Note:", "This document was generated by...", "For legal advice, consult...", or any footer commentary. The client wrapper adds any required footer.'
    : ''

  // ────────────────────────────────────────────────────────────────────────
  // EXPLICIT ANTI-CALIFORNIA GUARD — prevents Claude from defaulting to
  // California / Delaware / U.S. law when the user has provided any other
  // jurisdiction. This fires even when a known jurisdiction is detected, to
  // reinforce the instruction that has been failing in practice.
  // ────────────────────────────────────────────────────────────────────────
  const isUsDocumentExplicit = isUSA || isCalifornia
  const antiUsDefaultClause = !isDpa && !isUsDocumentExplicit
    ? '\n\n*** CRITICAL — DO NOT DEFAULT TO US / CALIFORNIA / DELAWARE LAW ***: The user has NOT selected a U.S. jurisdiction for this document. Do not under any circumstances default the governing law, venue, arbitration rules, or statute references to California, Delaware, New York, the Uniform Commercial Code, the American Arbitration Association, or any U.S. court. Use the jurisdiction explicitly selected by the user. If the user\'s selection is ambiguous or missing, use English common-law principles and name "the courts of [user\'s stated jurisdiction]" or, as a last resort, "the courts of the Federal Republic of Nigeria" (the default upstream jurisdiction for this service). A California-default output will be treated as an error.'
    : ''

  // FIX 2 — DPA jurisdiction routing. Previous chain ended with
  // 'Nigeria — NDPA 2023' as a fallback for ANY non-US/non-Canada
  // jurisdiction, meaning UK, Kenya, Ghana, and South Africa DPAs all
  // routed to Nigerian regulator + statute. UK DPAs were the worst case:
  // a UK data controller got a Nigerian-flavoured DPA with NDPC referral.
  // Now: dedicated routing for UK / SA / KE / GH (all already in CLAUSE_REGISTRY)
  // + a Commonwealth fallback for fully unmapped jurisdictions.
  const systemPrompt = isDpa
    ? buildDpaSystemPrompt(
        isUK ? 'United Kingdom — UK GDPR / DPA 2018'
        : isCalifornia ? 'United States — CCPA/CPRA'
        : isQuebec ? 'Canada — Quebec Law 25'
        : isCanada ? 'Canada — PIPEDA'
        : isUSA ? 'United States — CCPA/CPRA'
        : isSouthAfrica ? 'South Africa — POPIA'
        : isKenya ? 'Kenya — Data Protection Act 2019'
        : isGhana ? 'Ghana — Data Protection Act 2012'
        : isNigeria ? 'Nigeria — NDPA 2023'
        : 'Commonwealth common-law privacy baseline'
      ) + '\n\nThis is a premium paid document — make it exceptional.'
    : (libraryJurContext ? libraryJurContext + '\n\n' : '')
      + 'You are an expert legal document drafter with deep knowledge of international law, including the common-law traditions of Nigeria, Kenya, Ghana, South Africa, Canada, the United States, the United Kingdom, and Commonwealth jurisdictions; the civil-law tradition of Quebec; and the statutory frameworks of each (CAMA 2020 & ISA 2025 for Nigeria; Lagos State Tenancy Law 2011; Labour Act & PRA 2014; Land Use Act 1978; Hire Purchase Act 1965; Companies Act 2015 for Kenya; Companies Act 2019 (Act 992) for Ghana; Companies Act 71 of 2008 for South Africa; Companies Act 2006 and FSMA 2000 for the UK; DGCL for Delaware; CBCA and provincial ESAs for Canada; PIPEDA, Quebec Law 25, CCPA/CPRA, UK GDPR, NDPA 2023, POPIA, Kenya DPA 2019 for data). Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. Use the spelling conventions of the governing jurisdiction (US English for US documents, British / Commonwealth English for UK / African / Commonwealth documents, Canadian English for Canadian documents). This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.'
      + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause
      + nigeriaEquityClause + kenyaEquityClause + ghanaEquityClause + ukEquityClause + southAfricaEquityClause + usEquityClause + canadaEquityClause + equityCrossBorderNote
      + nigeriaFoundersAgreementClause + nigeriaIpAssignmentClause + nigeriaAdvisoryBoardClause + nigeriaVestingAgreementClause + nigeriaTermSheetClause + nigeriaSafeAgreementClause
      + nigeriaTenancyClause + nigeriaDeedClause + nigeriaQuitNoticeClause + nigeriaPowerOfAttorneyClause + nigeriaLandlordAgentClause
      + nigeriaEmploymentClause + nigeriaNonCompeteClause
      + nigeriaLoanClause + nigeriaHirePurchaseClause + nigeriaCommercialClause
      + ukGeneralClause + kenyaGeneralClause + ghanaGeneralClause + southAfricaGeneralClause + canadaGeneralClause + usGeneralClause
      + kenyaTenancyClause + kenyaEmploymentClause + kenyaNonCompeteClause + kenyaPropertyClause + kenyaLoanClause + kenyaCommercialClause
      + ghanaTenancyClause + ghanaEmploymentClause + ghanaPropertyClause + ghanaLoanClause
      + southAfricaTenancyClause + southAfricaEmploymentClause + southAfricaNonCompeteClause + southAfricaPropertyClause + southAfricaLoanClause
      + nigeriaNDAClause + nigeriaCommercialGeneralClause
      + usEmploymentClause + canadaEmploymentClause + usCanadaPropertyClause
      + californiaEmploymentClause + newYorkEmploymentClause + texasEmploymentClause
      + floridaEmploymentClause + illinoisEmploymentClause + washingtonEmploymentClause
      + genericFallbackClause
      + antiUsDefaultClause + executionFormalitiesClause

  try {
    const controller = new AbortController()
    // 280s timeout (5s headroom under Vercel's 300s function ceiling on Fluid
    // Compute). Previously 90s, which produced 504s on the Signova UI and on
    // the API Market proxy when Claude Sonnet 4.6 took >90s on complex docs
    // with the full 46-clause jurisdiction-aware system prompt.
    const timeoutId = setTimeout(() => controller.abort(), 280000)

    // Phase 4 — doc_type resolution via registry (body field first, regex
    // fallback instrumented). Then delegate to the shared orchestrator.
    const { docType, resolvedVia } = resolveDocType({ bodyDocTypeId, prompt })
    if (resolvedVia !== 'body') {
      // Observable: how often does the consumer UI fall through to the
      // regex fallback? If this number is non-trivial, the UI rollout is
      // incomplete. If it goes to zero, we can remove the fallback in a
      // future PR.
      logWarn('/generate', {
        event: 'doc_type_resolution_fallback',
        body_doc_type_id: bodyDocTypeId || null,
        resolved_via: resolvedVia,
        resolved_doc_type: docType,
        message: 'Consumer request arrived without a registered doc_type_id; used regex fallback',
      })
    }

    const jurisdictionLog =
      (isNigeria && 'Nigeria') ||
      (lower.match(/governing law:\s*([^\n]+)/) || [])[1] ||
      (lower.match(/country:\s*([^\n]+)/) || [])[1] ||
      null

    // Phase 5 — consumer path worker-classification inference. No UI
    // changes: we run a deterministic rule set (registry-defined) over
    // the already-assembled prompt. Ambiguous outcomes fail-close with
    // WORKER_CLASSIFICATION_AMBIGUOUS so users aren't silently routed
    // to the wrong clause set.
    let workerClassification = null
    let classificationInstruction = ''
    if (docType && isWorkerClassificationRequired(docType)) {
      const inferred = inferWorkerClassification(prompt, docType)
      if (inferred.ok) {
        workerClassification = inferred.mode
        classificationInstruction = buildClassificationInstruction(docType, workerClassification)
        logInfo('/generate', {
          event: 'worker_classification_inferred',
          doc_type: docType,
          resolved: workerClassification,
          triggering_anchors: inferred.triggering_anchors,
        })
      } else {
        // Ambiguous — zero or multiple rules matched. Fail-close before
        // spending an Anthropic call; reference_id lets the user quote
        // the failure in support.
        clearTimeout(timeoutId)
        const refId = `ref_${randomBytes(4).toString('hex')}`
        logError('/generate', {
          reference_id: refId,
          code: WORKER_CLASSIFICATION_AMBIGUOUS,
          doc_type: docType,
          candidates: inferred.candidates,
          reason: inferred.reason,
          valid_values: getWorkerClassificationModes(docType),
        })
        return res.status(422).json({
          error: 'Could not determine whether this is an independent-contractor, exempt-worker (s.91), or employee engagement from the information provided. Please add clarifying language (e.g. "independent contractor", "annual leave", "s.91 exempt") and regenerate.',
          code: WORKER_CLASSIFICATION_AMBIGUOUS,
          reference_id: refId,
          candidates: inferred.candidates,
          valid_values: getWorkerClassificationModes(docType),
        })
      }
    }

    const completion = await generateWithCompletenessCheck({
      apiKey,
      model: 'claude-sonnet-4-6',
      systemPrompt,
      userPrompt: prompt,
      docType,
      jurisdiction: jurisdictionLog,
      workerClassification,
      classificationInstruction,
      logger: { logWarn, logError },
      abortSignal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!completion.ok) {
      // Fail-closed: do NOT return a partial or mistyped document.
      // Stable machine-readable code + reference_id that matches the
      // structured log. Code is one of DOC_INCOMPLETE_AFTER_RETRY
      // (Phase 3, truncation) or DOC_TITLE_BODY_MISMATCH (Phase 4,
      // routing). Payload shape is normalised by the orchestrator so
      // downstream consumers can switch on `code`.
      const failurePayload = {
        error: completion.code === DOC_TITLE_BODY_MISMATCH
          ? 'Generated document body declares a different document type than requested.'
          : 'Document generation did not complete. Please try again; if this persists, quote the reference ID.',
        code: completion.code,
        reference_id: completion.referenceId,
      }
      if (completion.code === DOC_INCOMPLETE_AFTER_RETRY) {
        failurePayload.missing_clauses = completion.missingClauses
      }
      if (completion.code === DOC_TITLE_BODY_MISMATCH) {
        failurePayload.expected_title = completion.expectedTitle
        failurePayload.conflicting_title = completion.conflictingTitle
      }
      if (completion.code === DOC_FORBIDDEN_COMBINATION) {
        failurePayload.error = 'Generated document contains a legally incoherent combination of clauses. Please regenerate.'
        failurePayload.combination_id = completion.combinationId
        failurePayload.description = completion.description
        failurePayload.anchor_hits = completion.anchorHits
      }
      return res.status(502).json(failurePayload)
    }

    const rawText = completion.text

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
