#!/usr/bin/env node
// scripts/audit-execution-block-false-positives.mjs
//
// Sweep the Signova audit chain (Upstash Redis) for documents that may have
// been stamped ok:true while structurally incomplete due to the
// hasExecutionBlock false-positive class fixed in
// fix(completeness): tighten hasExecutionBlock to prevent false-positive class.
//
// Customer-impact context — SIG-858825A9 (2026-05-07):
// Customer received a truncated MOU stamped ok:true because Section 3.9 of
// the body contained "...amendment signed by authorized representatives..."
// in body prose, satisfying the old detector's lowercase substring match
// for "signed by" and bypassing the continuation retry.
//
// What this script CAN do:
//   - Iterate audit-chain entries since the prior sig-block fix (2026-05-02)
//   - Filter to premium-tier (paid) documents
//   - Flag entries with anomalously low word_count for the doc tier
//     (truncation indicator)
//
// What this script CANNOT do (deliberate trust-model decision):
//   - Inspect document body text — the audit chain stores fingerprint only,
//     not the body. The body never leaves the request lifecycle.
//   - Look up by SIG-XXXX reference — those IDs are minted client-side at
//     render time (src/pages/Preview.jsx line 248) and don't reach the
//     audit chain.
//   - Resolve customer email — receipts carry doc_tier + word_count only.
//     Olumide must cross-reference flagged fingerprints with payment
//     records (Stripe / Oxapay) to identify customers for proactive
//     remediation.
//
// Output:
//   - Console: summary + flagged entry list (fingerprints + word_counts +
//     dates), redacted (no body, no customer info)
//   - File: docs/incidents/<DATE>-execution-block-false-positive-sweep.md
//
// Usage:
//   node scripts/audit-execution-block-false-positives.mjs

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, parse as parsePath } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

// ── Load .env.local from nearest ancestor ──────────────────────────────────
function findAndLoadEnv(startDir) {
  let cur = startDir
  const root = parsePath(cur).root
  while (cur && cur !== root) {
    const candidate = join(cur, '.env.local')
    if (existsSync(candidate)) {
      const env = readFileSync(candidate, 'utf8')
      for (const line of env.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/)
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
      }
      return candidate
    }
    cur = dirname(cur)
  }
  return null
}
const envPath = findAndLoadEnv(__dir)
if (envPath) console.log(`[env] loaded ${envPath}`)

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
  process.exit(2)
}

// ── Config ─────────────────────────────────────────────────────────────────
const PRIOR_FIX_DATE = '2026-05-02T00:00:00Z' // prior signature-block fix landed
const TRUNCATION_THRESHOLD_WORDS = 2500 // below this, flag as candidate-truncated
const SUSPICIOUS_THRESHOLD_WORDS = 4000 // suspicious but possibly legitimate (short docs)

// ── Connect ────────────────────────────────────────────────────────────────
const { Redis } = await import('@upstash/redis')
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// ── Iterate audit entries ──────────────────────────────────────────────────
console.log('\n[1/3] Scanning audit chain...')

const entries = []
let cursor = '0'
let totalScanned = 0
do {
  // SCAN with match — Upstash supports this via the REST API
  const [nextCursor, keys] = await redis.scan(cursor, { match: 'signova:audit:entry:*', count: 100 })
  cursor = nextCursor
  for (const key of keys) {
    const raw = await redis.get(key)
    if (!raw) continue
    const entry = typeof raw === 'string' ? JSON.parse(raw) : raw
    totalScanned++
    entries.push(entry)
  }
} while (cursor !== '0')

console.log(`  ✓ scanned ${totalScanned} audit entries total`)

// ── Filter ─────────────────────────────────────────────────────────────────
console.log('\n[2/3] Filtering for at-risk entries...')

const cutoff = new Date(PRIOR_FIX_DATE).getTime()

function classify(entry) {
  const stored = new Date(entry.stored_at).getTime()
  if (Number.isNaN(stored) || stored < cutoff) return null

  const r = entry.receipt || {}
  if (r.doc_tier !== 'premium') return null

  const wc = typeof r.word_count === 'number' ? r.word_count : null
  if (wc == null) return { ...entry, risk: 'unknown_word_count' }
  if (wc < TRUNCATION_THRESHOLD_WORDS) return { ...entry, risk: 'likely_truncated', wc }
  if (wc < SUSPICIOUS_THRESHOLD_WORDS) return { ...entry, risk: 'possibly_short', wc }
  return null
}

const flagged = entries.map(classify).filter(Boolean)

const byRisk = {
  likely_truncated: flagged.filter(e => e.risk === 'likely_truncated'),
  possibly_short: flagged.filter(e => e.risk === 'possibly_short'),
  unknown_word_count: flagged.filter(e => e.risk === 'unknown_word_count'),
}

console.log(`  ✓ ${flagged.length} entries since ${PRIOR_FIX_DATE} need review:`)
console.log(`      likely_truncated (word_count < ${TRUNCATION_THRESHOLD_WORDS}): ${byRisk.likely_truncated.length}`)
console.log(`      possibly_short  (word_count < ${SUSPICIOUS_THRESHOLD_WORDS}): ${byRisk.possibly_short.length}`)
console.log(`      unknown_word_count (legacy receipts): ${byRisk.unknown_word_count.length}`)

// ── Write redacted incident report ─────────────────────────────────────────
console.log('\n[3/3] Writing redacted incident report...')

const incidentsDir = join(ROOT, 'docs', 'incidents')
if (!existsSync(incidentsDir)) mkdirSync(incidentsDir, { recursive: true })

const today = new Date().toISOString().slice(0, 10)
const reportPath = join(incidentsDir, `${today}-execution-block-false-positive-sweep.md`)

function redact(entry) {
  const r = entry.receipt || {}
  return {
    fingerprint: r.fingerprint || null,
    issued_at: r.issued_at || null,
    stored_at: entry.stored_at || null,
    word_count: r.word_count ?? null,
    sequence: entry.sequence ?? null,
    risk: entry.risk,
  }
}

// ── Detect chain silence (separate observability concern) ─────────────────
const allStoredAtIso = entries
  .map(e => e.stored_at)
  .filter(Boolean)
  .sort()
const lastAuditAt = allStoredAtIso[allStoredAtIso.length - 1] || null
const daysSinceLastEntry = lastAuditAt
  ? Math.floor((Date.now() - new Date(lastAuditAt).getTime()) / (1000 * 60 * 60 * 24))
  : null
const chainAppearsSilent = lastAuditAt && new Date(lastAuditAt) < new Date(PRIOR_FIX_DATE)

const lines = [
  `# Execution-block false-positive sweep — ${today}`,
  '',
  ...(chainAppearsSilent ? [
    '## ⚠ Secondary finding: audit chain has been silent',
    '',
    `The most recent audit entry is dated **${lastAuditAt}** (${daysSinceLastEntry} days ago).`,
    'The customer-impact case SIG-858825A9 generated 2026-05-07 is NOT in the chain.',
    'This means the chain stopped accepting new entries before the prior',
    'sig-block fix shipped — possibly due to a Redis credential/connectivity',
    'issue, env-var rotation, or a non-fatal exception path in',
    '`appendToAuditLog` (the call is wrapped in try/catch and logs a warning',
    'but does not block generation, so the silence is invisible to users).',
    '',
    '**Implication for this sweep:** the time-window filter returns ZERO',
    'candidates not because no documents were affected, but because the',
    'chain itself has no entries to filter. The customer remediation for',
    'SIG-858825A9 must be handled directly (the customer is already known',
    'via the African founders community). Other affected customers cannot',
    'be identified through the audit chain until the chain is restored.',
    '',
    '**Separate follow-up:** investigate why audit appends stopped around',
    `${lastAuditAt}. Check Vercel logs for "/generate" entries with the`,
    '`Audit log append failed (non-fatal)` warning. Restore audit chain',
    'function before relying on this sweep for future incidents.',
    '',
    '---',
    '',
  ] : []),
  '## Context',
  '',
  'On 2026-05-07 customer SIG-858825A9 reported a truncated MOU stamped',
  '`ok:true`. Root cause: `hasExecutionBlock()` in `lib/doc-completeness.js`',
  'matched the lowercase substring "signed by" in body-prose Section 3.9',
  '("...amendment signed by authorised representatives..."). The fix',
  'tightens the detector to require uppercase `SIGNED` at line start AND',
  'a structural anchor (signature underline / `Date:` / `Title:` /',
  '`Print Name:`) within ±100 chars.',
  '',
  '## Audit-chain sweep',
  '',
  '**Time window:** entries with `stored_at` >= ' + PRIOR_FIX_DATE + ' (date the prior',
  'sig-block fix landed; earlier entries pre-date the regression class).',
  '',
  '**Filter:** premium-tier receipts only (paid generations); preview-tier',
  'is excluded because previews are intentionally short.',
  '',
  '**Truncation thresholds:**',
  `- \`likely_truncated\`: word_count < ${TRUNCATION_THRESHOLD_WORDS} (NDAs/MOUs are usually 4000+ words when complete)`,
  `- \`possibly_short\`: word_count < ${SUSPICIOUS_THRESHOLD_WORDS} (could be a legitimate short doc, eg. a 2-party simple NDA)`,
  '- `unknown_word_count`: legacy receipts where the field was not populated',
  '',
  '## Trust-model limitations of this sweep',
  '',
  'The audit chain stores **fingerprint only**, not document body. Direct',
  'string-matching against shipped documents is therefore not possible from',
  'the audit chain alone. The sweep flags **truncation candidates** by',
  'word count; identifying the exact subset that hit the false-positive',
  'class requires either (a) cross-referencing flagged fingerprints with',
  'payment records to contact customers and ask for a copy of their doc,',
  'or (b) re-running each affected request from saved input prompts (not',
  'currently retained server-side either).',
  '',
  'SIG-XXXX reference IDs are minted client-side at render time',
  '([src/pages/Preview.jsx:248](src/pages/Preview.jsx#L248)) and do not',
  'persist to the audit chain. The chain stores Ed25519-signed fingerprints',
  'and content hashes only.',
  '',
  '## Summary',
  '',
  `- Total audit entries scanned: ${totalScanned}`,
  `- Entries since ${PRIOR_FIX_DATE}: ${flagged.length} flagged`,
  `- \`likely_truncated\`: ${byRisk.likely_truncated.length}`,
  `- \`possibly_short\`: ${byRisk.possibly_short.length}`,
  `- \`unknown_word_count\`: ${byRisk.unknown_word_count.length}`,
  '',
  '## Flagged entries (redacted — no body, no customer info)',
  '',
  '### likely_truncated',
  '',
  byRisk.likely_truncated.length === 0
    ? '_(none)_'
    : '```json\n' + JSON.stringify(byRisk.likely_truncated.map(redact), null, 2) + '\n```',
  '',
  '### possibly_short',
  '',
  byRisk.possibly_short.length === 0
    ? '_(none)_'
    : '```json\n' + JSON.stringify(byRisk.possibly_short.map(redact), null, 2) + '\n```',
  '',
  '### unknown_word_count',
  '',
  byRisk.unknown_word_count.length === 0
    ? '_(none)_'
    : '```json\n' + JSON.stringify(byRisk.unknown_word_count.map(redact), null, 2) + '\n```',
  '',
  '## Recommended remediation',
  '',
  '1. **For each `likely_truncated` fingerprint**: cross-reference Stripe',
  '   and Oxapay records by `issued_at` timestamp to identify the',
  '   customer email. Reach out proactively offering free regeneration',
  '   with the fix in place.',
  '2. **For known case SIG-858825A9** (African founders community customer):',
  '   already known. Offer regeneration directly.',
  '3. **For `possibly_short`**: review case-by-case. Some may be',
  '   legitimate short docs (eg. a one-page Letter of Intent). Use the',
  '   doc tier + word count + customer feedback channel to decide.',
  '4. **Frontend follow-up**: the warning at',
  '   `src/pages/Preview.jsx:se` uses the same loose check',
  '   (`/IN WITNESS WHEREOF|EXECUTED AS A DEED|SIGNED by/i`). Tighten it',
  '   in a separate PR — same regex strategy, lower stakes (UX warning,',
  '   not a gate).',
  '',
]

writeFileSync(reportPath, lines.join('\n'))
console.log(`  ✓ ${reportPath}`)

console.log('\nDone.')
