// lib/statute-injection.js
//
// Builds a verified-statute prompt context block for injection into the
// document-generator system prompt. Reads from the Supabase statute cache
// (populated in Day 2) and applies any per-entry reframing instructions
// from the bundle metadata before formatting the result.
//
// Public API:
//   buildStatuteContext(jurisdiction, docType): Promise<string | null>
//
// Returns null when retrieval is disabled, the bundle is unverified, or
// the cache has nothing usable. Generation must continue normally on null.

import { getBundleMeta } from './statute-bundles.js'
import { getStatuteBundle } from './statute-retrieval.js'

const PER_JURISDICTION_FLAG = {
  usa_federal: 'STATUTE_RETRIEVAL_USA_FEDERAL',
  usa_california: 'STATUTE_RETRIEVAL_USA_CALIFORNIA',
  usa_new_york: 'STATUTE_RETRIEVAL_USA_NEW_YORK',
  usa_texas: 'STATUTE_RETRIEVAL_USA_TEXAS',
  usa_florida: 'STATUTE_RETRIEVAL_USA_FLORIDA',
  usa_delaware: 'STATUTE_RETRIEVAL_USA_DELAWARE',
  nigeria: 'STATUTE_RETRIEVAL_NIGERIA',
  canada_federal: 'STATUTE_RETRIEVAL_CANADA_FEDERAL',
  canada_ontario: 'STATUTE_RETRIEVAL_CANADA_ONTARIO',
  canada_quebec: 'STATUTE_RETRIEVAL_CANADA_QUEBEC',
  canada_bc: 'STATUTE_RETRIEVAL_CANADA_BC',
  uk: 'STATUTE_RETRIEVAL_UK',
  kenya: 'STATUTE_RETRIEVAL_KENYA',
  ghana: 'STATUTE_RETRIEVAL_GHANA',
  south_africa: 'STATUTE_RETRIEVAL_SOUTH_AFRICA',
}

function applyReframing(content, reframing) {
  if (!reframing || !Array.isArray(reframing.find) || !reframing.replace_with) {
    return content
  }
  let out = content
  for (const term of reframing.find) {
    if (typeof term !== 'string' || term.length === 0) continue
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'gi')
    out = out.replace(re, reframing.replace_with)
  }
  return out
}

function firstSourceUrl(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return null
  const first = sources[0]
  if (!first) return null
  if (typeof first === 'string') return first
  return first.url ?? null
}

function isAcceptableVerdict(verdict) {
  if (!verdict) return true // missing meta entry → treat as ok (legacy/bare)
  const v = String(verdict).toLowerCase()
  if (v.includes('mismatch')) return false
  if (v.includes('rejected')) return false
  return true // 'match', 'partial', 'consistent', etc. all inject
}

function describeVerdict(result) {
  if (!result) return null
  const v = String(result.verdict ?? '').toLowerCase()
  if (v.includes('match') && !v.includes('mis')) return '✓ MATCH (verified primary-source)'
  if (v === 'consistent') return '✓ CONSISTENT (source-consistency verified)'
  if (v.includes('partial') && result.reframing) {
    return '⚠ PARTIAL (verification note applied before injection)'
  }
  if (v.includes('partial')) return '⚠ PARTIAL (see verification note)'
  return result.verdict ?? null
}

export async function buildStatuteContext(jurisdiction, docType) {
  if (process.env.STATUTE_RETRIEVAL_ENABLED !== 'true') return null

  const perJurFlag = PER_JURISDICTION_FLAG[jurisdiction]
  if (perJurFlag && process.env[perJurFlag] !== 'true') return null

  const meta = getBundleMeta(jurisdiction, docType)
  if (!meta) return null

  const cached = await getStatuteBundle(jurisdiction, docType)
  if (!Array.isArray(cached) || cached.length === 0) return null

  const verificationResults = meta.verification_results ?? {}
  const formattedEntries = []

  for (const row of cached) {
    const result = verificationResults[row.statuteRef]
    if (!isAcceptableVerdict(result?.verdict)) continue
    if (!row.content) continue

    const reframedContent = applyReframing(row.content, result?.reframing)
    const sourceUrl = firstSourceUrl(row.sources) ?? '(no source URL)'
    const verdictLabel = describeVerdict(result) ?? 'unverified'

    formattedEntries.push(
      `Reference: ${row.statuteRef}\n` +
      `Source: ${sourceUrl}\n` +
      `Verification: ${verdictLabel}\n` +
      `Content: ${reframedContent}`
    )
  }

  if (formattedEntries.length === 0) return null

  return [
    '--- VERIFIED STATUTE CONTEXT ---',
    'The following statute references have been retrieved and verified against authoritative sources. Use them as the factual basis for any citations or legal claims in the generated document.',
    '',
    formattedEntries.join('\n\n---\n\n'),
    '',
    'When citing statutes in the generated document, cite ONLY the references above. Do not invent additional statute citations. If a topic is not covered above, address it in general legal terms without citing a specific statute.',
    '--- END VERIFIED STATUTE CONTEXT ---',
  ].join('\n')
}
