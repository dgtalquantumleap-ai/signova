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

  // ── Jurisdiction detection ────────────────────────────────────────────────
  // Note: "USA"/"U.S."/"U.S.A." checked against ORIGINAL case (not lowered) to
  // avoid matching the pronoun "us" (e.g. "send us the draft").
  const isNigeria = lower.includes('nigeria') || lower.includes('ndpa') || lower.includes('ndpc')
  const isQuebec = /\bqu[eé]bec\b/.test(lower) || lower.includes('law 25') || lower.includes('bill 64') ||
    /\b(montr[eé]al|quebec city)\b/.test(lower)
  const isCanada = !isQuebec && (lower.includes('canada') || lower.includes('canadian') ||
    /\b(ontario|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|northwest territories)\b/.test(lower) ||
    /\b(toronto|vancouver|calgary|edmonton|ottawa|mississauga|winnipeg|halifax|victoria|saskatoon|regina|hamilton)\b/.test(lower) ||
    /\b(o\.n\.|bc|b\.c\.|ab|mb|sk|ns|nb|pei|yt|nt|nu)\b/.test(lower) ||
    lower.includes('pipeda') || lower.includes('casl'))
  const isCalifornia = lower.includes('california') || lower.includes('ccpa') || lower.includes('cpra') ||
    /\b(san francisco|los angeles|san diego|san jose|sacramento|oakland|santa clara|palo alto|silicon valley)\b/.test(lower)
  const isUSA = !isCalifornia && (
    lower.includes('united states') ||
    /\b(USA|U\.S\.A\.|U\.S\.)\b/.test(prompt) ||  // original case — avoids pronoun "us"
    lower.includes('ucc ') || lower.includes('can-spam') ||
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

  const systemPrompt = isDpa
    ? buildDpaSystemPrompt(
        isCalifornia ? 'United States — CCPA/CPRA'
        : isQuebec ? 'Canada — Quebec Law 25'
        : isCanada ? 'Canada — PIPEDA'
        : isUSA ? 'United States — CCPA/CPRA'
        : 'Nigeria — NDPA 2023'
      ) + '\n\nThis is a premium paid document — make it exceptional.'
    : 'You are an expert legal document drafter with deep knowledge of international law, including the common-law traditions of Canada, the United States, the United Kingdom, and Commonwealth jurisdictions, as well as the civil-law tradition of Quebec and the statutory privacy regimes of North America (PIPEDA, Quebec Law 25, CCPA/CPRA, and aligned US state laws). Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. Use the spelling conventions of the governing jurisdiction (US English for US documents, Canadian English for Canadian documents). This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.' + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause

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
