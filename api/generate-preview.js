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

  // ── Jurisdiction detection (parity with paid generate.js) ─────────────────
  const isNigeria = lower.includes('nigeria') || lower.includes('ndpa') || lower.includes('ndpc')
  const isQuebec = /\bqu[eé]bec\b/.test(lower) || lower.includes('law 25') || lower.includes('bill 64') ||
    /\b(montr[eé]al|quebec city)\b/.test(lower)
  const isCanada = !isQuebec && (lower.includes('canada') || lower.includes('canadian') ||
    /\b(ontario|british columbia|alberta|manitoba|saskatchewan|nova scotia|new brunswick|newfoundland|prince edward island|yukon|nunavut|northwest territories)\b/.test(lower) ||
    /\b(toronto|vancouver|calgary|edmonton|ottawa|mississauga|winnipeg|halifax|victoria|saskatoon|regina|hamilton)\b/.test(lower) ||
    lower.includes('pipeda') || lower.includes('casl'))
  const isCalifornia = lower.includes('california') || lower.includes('ccpa') || lower.includes('cpra') ||
    /\b(san francisco|los angeles|san diego|san jose|sacramento|oakland|santa clara|palo alto|silicon valley)\b/.test(lower)
  const isUSA = !isCalifornia && (
    lower.includes('united states') ||
    /\b(USA|U\.S\.A\.|U\.S\.)\b/.test(prompt) ||
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

  const dpaJurisdiction = isCalifornia ? 'United States — CCPA/CPRA'
    : isQuebec ? 'Canada — Quebec Law 25'
    : isCanada ? 'Canada — PIPEDA'
    : isUSA ? 'United States — CCPA/CPRA'
    : 'Nigeria — NDPA 2023'

  const systemContent = isDpa
    ? buildDpaSystemPrompt(dpaJurisdiction)
    : 'You are a legal document drafting assistant with deep knowledge of common-law (Canada, US, UK), civil-law (Quebec), and the statutory privacy regimes of North America. Generate professional, comprehensive legal documents based on the user details provided. Use formal legal language with clear numbered sections. Use the spelling conventions of the governing jurisdiction. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.' + nigeriaClause + canadaClause + quebecClause + californiaClause + usaClause

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
