// Phase 6 — regression harness for the document generation pipeline.
//
// Three amendments live here:
//   2. Dynamic worker-classification sweep — iterates every registered
//      doc_type × mode pair against a mocked LLM and asserts
//      forbidden_combinations are absent.
//   3. Duplicate-heading-after-continuation — when the orchestrator fires
//      a continuation retry, the stitched combined text must not contain
//      duplicate canonical clause headings from the registry's
//      required_clauses aliases.
//   5. Risk report — diagnostic sweep across 28 doc_types × 3
//      jurisdictions × 5 sample variations, emits
//      tests/fixtures/risk-report.md for founder review.
//
// No endpoint handler edits. Mock-LLM only. All three live in one file
// so they share mock-scaffold setup.

import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  listDocTypes,
  getDocType,
  getTitle,
  getRequiredClauses,
  getForbiddenTitles,
  getForbiddenCombinations,
  getWorkerClassificationModes,
} from '../../lib/doc-registry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(__dirname, '..', 'fixtures')
const RISK_REPORT_PATH = join(FIXTURES, 'risk-report.md')

// ─── Env + fetch mock (dev API path) ────────────────────────────────────────
// Using the developer API endpoint because it accepts structured
// {document_type, worker_classification, fields, jurisdiction} directly
// — simpler than the consumer endpoint's prompt regex + classifier.
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.NODE_ENV = 'test'

const mockFetch = vi.fn()
global.fetch = mockFetch

function anthropicResponse(text, stopReason = 'end_turn') {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ content: [{ type: 'text', text }], stop_reason: stopReason }),
  })
}

function mockReq(body) {
  return {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer sk_test_local_dev',
      host: 'api.ebenova.dev',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    _headers: {},
    status(code) { this.statusCode = code; return this },
    json(data) { this.body = data; return this },
    setHeader(k, v) { this._headers[k] = v },
    end() { return this },
  }
  return res
}

const { default: handler } = await import('../../api/v1/documents/generate.js')

// ─── Synthetic clean-output builder ─────────────────────────────────────────
//
// Given a doc_type (and jurisdiction for title variants), construct a
// minimal output that:
//   (a) carries the registered title as the header — passes title/body
//   (b) contains at least one heading for every required_clauses alias —
//       passes completeness
//   (c) does NOT contain any forbidden_titles substring
//   (d) does NOT contain any forbidden_combination anchor patterns
//
// Purely structural; no legal wording — this is a test fixture, not a
// legal document.
function synthesiseCleanOutput(docTypeId, jurisdiction = null) {
  const title = getTitle(docTypeId, jurisdiction) || 'Document'
  const required = getRequiredClauses(docTypeId)
  const forbiddenTitles = getForbiddenTitles(docTypeId)
  const forbiddenCombos = getForbiddenCombinations(docTypeId)

  // Headings use the FIRST alias of each required clause, capitalised.
  let body = `# ${title}\n\n`
  body += `**This Agreement is made between the parties named in Schedule 1.**\n\n`
  if (required.length === 0) {
    body += `**1. GENERIC CLAUSE**\nBoilerplate content.\n\n`
    body += `**SIGNED** for the parties: ____________________\n`
  } else {
    required.forEach((clause, idx) => {
      const alias = String(clause.anyOf?.[0] || clause.id).toUpperCase()
      body += `**${idx + 1}. ${alias}**\nContent for ${clause.id}.\n\n`
    })
    body += `**SIGNED** for the parties: ____________________\n`
  }

  // Defensive: scrub any accidentally-introduced forbidden titles.
  for (const bad of forbiddenTitles) {
    const re = new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    body = body.replace(re, 'REDACTED_FOR_TEST')
  }

  // Defensive: neutralise any forbidden_combination anchor patterns that
  // the random alias capitalisation might have hit.
  for (const combo of forbiddenCombos) {
    for (const anchor of combo.anchors || []) {
      for (const pat of anchor.patterns || []) {
        try {
          body = body.replace(new RegExp(pat, 'gi'), 'REDACTED_FOR_TEST')
        } catch {
          // invalid regex in registry — skip (the registry test covers it)
        }
      }
    }
  }

  return body
}

// Default Nigeria-ish field set for any doc_type.
function defaultFields() {
  return {
    provider: 'Acme Ltd.',
    client: 'Beta Corp',
    services: 'Generic services for harness testing.',
    fee: '$1',
    country: 'Nigeria',
    jurisdiction: 'Nigeria',
  }
}

// ─── Amendment 2: dynamic worker-classification sweep ───────────────────────
describe('Phase 6 — dynamic worker-classification sweep (Amendment 2)', () => {
  beforeEach(() => { mockFetch.mockReset() })

  const cases = []
  for (const docTypeId of listDocTypes()) {
    const modes = getWorkerClassificationModes(docTypeId)
    if (modes.length === 0) continue
    for (const mode of modes) {
      cases.push({ docTypeId, mode })
    }
  }

  it('the sweep is non-empty (at least one doc_type registers worker_classification_modes)', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it.each(cases)(
    '$docTypeId × $mode: clean synthetic output passes all validators (200 OK, no forbidden_combination fires)',
    async ({ docTypeId, mode }) => {
      const clean = synthesiseCleanOutput(docTypeId, 'Nigeria')
      mockFetch.mockResolvedValueOnce(anthropicResponse(clean, 'end_turn'))

      const req = mockReq({
        document_type: docTypeId,
        jurisdiction: 'Nigeria',
        fields: defaultFields(),
        worker_classification: mode,
      })
      const res = mockRes()
      await handler(req, res)

      expect(
        res.statusCode,
        `Dynamic harness: ${docTypeId} × ${mode} failed. Status=${res.statusCode}, body=${JSON.stringify(res.body)?.slice(0, 300)}`
      ).toBe(200)
    }
  )
})

// ─── Amendment 3: duplicate-heading-after-continuation ──────────────────────
//
// When the orchestrator fires a continuation retry, the stitched text
// must not contain duplicate canonical clause headings. Heading here
// means any required_clauses alias at a markdown-numbered-bold heading
// position like `**N. <ALIAS>**` or `**N. <ALIAS>`.
describe('Phase 6 — duplicate-heading-after-continuation (Amendment 3)', () => {
  beforeEach(() => { mockFetch.mockReset() })

  // Helper: for a given doc_type, count heading-form occurrences of
  // each alias across its required_clauses, combined across all aliases
  // of the same clause (so "termination" + "term and termination"
  // shouldn't both trigger). Returns { clauseId: occurrenceCount }.
  function countCanonicalHeadings(text, docTypeId) {
    const required = getRequiredClauses(docTypeId)
    const counts = {}
    for (const clause of required) {
      // \b at the end prevents prefix matches — e.g. alias "term" must
      // not count the heading "**5. TERMINATION**" twice (once for
      // "term", once for "termination").
      const patterns = (clause.anyOf || []).map(a => `\\*\\*\\s*\\d+\\.\\s*${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      const combined = patterns.join('|')
      if (!combined) continue
      const re = new RegExp(combined, 'gi')
      const matches = text.match(re) || []
      counts[clause.id] = matches.length
    }
    return counts
  }

  it('success path: stitched continuation with NO duplicate canonical headings — handler returns 200 and counts stay ≤ 1', async () => {
    // Fixture ensures registry's service-agreement required_clauses are
    // hit exactly once after stitching. First half carries clauses 1-3;
    // continuation carries clauses 4-6 (disjoint, no overlap).
    const firstHalf = [
      '# SERVICE AGREEMENT',
      '**1. SCOPE OF SERVICES** content.',
      '**2. FEES** content.',
      '**3. TERM** content.',
      '**4.',
    ].join('\n\n')
    const continuation = [
      ' continuation of clause 4 text.',
      '**5. TERMINATION** content.',
      '**6. GOVERNING LAW** content.',
      '**7. SIGNATURE** — SIGNED for the parties: ____________________',
    ].join('\n\n')

    mockFetch
      .mockResolvedValueOnce(anthropicResponse(firstHalf, 'max_tokens'))
      .mockResolvedValueOnce(anthropicResponse(continuation, 'end_turn'))

    const req = mockReq({
      document_type: 'service-agreement',
      jurisdiction: 'Nigeria',
      fields: defaultFields(),
      worker_classification: 'independent_contractor',
    })
    const res = mockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const text = res.body?.document || ''
    const counts = countCanonicalHeadings(text, 'service-agreement')
    for (const [clauseId, n] of Object.entries(counts)) {
      expect(n, `clause "${clauseId}" appeared ${n} times as a canonical heading; should be ≤1`).toBeLessThanOrEqual(1)
    }
  })

  it('regression case: duplicate TERMINATION heading across first+continuation halves is detectable by countCanonicalHeadings', () => {
    // Pure helper test — verifies the detection function would catch
    // the bug if it ever ships. We do NOT exercise the handler here
    // because Phase 6's deferred TODO did not land production detection;
    // this asserts the harness check itself works.
    const stitchedWithDupe = [
      '# SERVICE AGREEMENT',
      '**1. SCOPE OF SERVICES** content.',
      '**2. FEES** content.',
      '**3. TERM** content.',
      '**4. TERMINATION** first half content.',
      '**5. GOVERNING LAW** content.',
      '',
      '**5. TERMINATION** continuation re-emitted the clause.',
      '**6. SIGNATURE** block.',
    ].join('\n\n')
    const counts = countCanonicalHeadings(stitchedWithDupe, 'service-agreement')
    expect(counts.termination, 'duplicate-detection helper must spot the re-emitted clause').toBeGreaterThanOrEqual(2)
  })
})

// ─── Amendment 5: risk report ───────────────────────────────────────────────
//
// Per the Phase 6 spec: 5 sample documents per (doc_type × {nigeria, usa, uk})
// against the mocked LLM. Record completeness, title-drift, and
// statutory-citation presence per generation. Emit
// tests/fixtures/risk-report.md ranked by failure rate, worst first.
describe('Phase 6 — risk report (Amendment 5)', () => {
  beforeEach(() => { mockFetch.mockReset() })

  // 5 sample variations. For each sample we mutate the clean output in
  // a defined way; if the doc_type's registry doesn't configure the
  // relevant validator, the sample records "n/a" and doesn't count
  // against the failure rate.
  const SAMPLES = ['clean', 'truncated', 'missing-required-clause', 'title-drift', 'forbidden-combination']
  const JURISDICTIONS = ['nigeria', 'usa', 'uk']

  function sampleOutput(sample, docTypeId, jurisdiction) {
    const clean = synthesiseCleanOutput(docTypeId, jurisdiction)
    const required = getRequiredClauses(docTypeId)
    const forbiddenTitles = getForbiddenTitles(docTypeId)
    const forbiddenCombos = getForbiddenCombinations(docTypeId)

    if (sample === 'clean') return { text: clean, stopReason: 'end_turn', applicable: true }

    if (sample === 'truncated') return { text: clean.slice(0, Math.floor(clean.length * 0.6)), stopReason: 'max_tokens', applicable: true }

    if (sample === 'missing-required-clause') {
      if (required.length === 0) return { applicable: false, reason: 'no required_clauses configured' }
      // Remove the first clause's alias from the output.
      const alias = String(required[0].anyOf?.[0] || required[0].id)
      const re = new RegExp(alias, 'gi')
      return { text: clean.replace(re, 'REMOVED'), stopReason: 'end_turn', applicable: true }
    }

    if (sample === 'title-drift') {
      if (forbiddenTitles.length === 0) return { applicable: false, reason: 'no forbidden_titles configured' }
      const drifted = clean + `\n\nThis ${forbiddenTitles[0]} governs the engagement.\n`
      return { text: drifted, stopReason: 'end_turn', applicable: true }
    }

    if (sample === 'forbidden-combination') {
      if (forbiddenCombos.length === 0) return { applicable: false, reason: 'no forbidden_combinations configured' }
      // Inject ONE pattern from each anchor group so the combination fires.
      let bad = clean
      for (const anchor of forbiddenCombos[0].anchors || []) {
        const pat = anchor.patterns?.[0]
        if (!pat) continue
        // Strip regex escapes for a human-readable insertion.
        const injectable = pat.replace(/\\/g, '').replace(/\s\*/g, ' ').replace(/\\b/g, '').trim() || 's.91'
        bad += `\n\nInserted for harness: ${injectable}.`
      }
      return { text: bad, stopReason: 'end_turn', applicable: true }
    }

    return { applicable: false }
  }

  // Pick a classification mode if the doc_type requires one. Dev API
  // rejects missing classification up-front, so we must pass one.
  function pickMode(docTypeId) {
    const modes = getWorkerClassificationModes(docTypeId)
    return modes.length > 0 ? modes[0] : null
  }

  // Jurisdiction → handler-friendly string.
  function jurisdictionLabel(j) {
    if (j === 'nigeria') return 'Nigeria'
    if (j === 'usa') return 'United States'
    if (j === 'uk') return 'United Kingdom'
    return j
  }

  async function runOne(docTypeId, jurisdiction, sample) {
    const out = sampleOutput(sample, docTypeId, jurisdiction)
    if (!out.applicable) return { applicable: false, reason: out.reason || 'n/a' }

    mockFetch.mockReset()
    mockFetch
      .mockResolvedValueOnce(anthropicResponse(out.text, out.stopReason))
      // continuation retry (the orchestrator may or may not fire one; mock anyway)
      .mockResolvedValueOnce(anthropicResponse(out.text, out.stopReason))

    const mode = pickMode(docTypeId)
    const body = {
      document_type: docTypeId,
      jurisdiction: jurisdictionLabel(jurisdiction),
      fields: { ...defaultFields(), jurisdiction: jurisdictionLabel(jurisdiction) },
    }
    if (mode) body.worker_classification = mode

    const req = mockReq(body)
    const res = mockRes()
    try {
      await handler(req, res)
    } catch (err) {
      return { applicable: true, status: 'error', error: String(err).slice(0, 120) }
    }

    return {
      applicable: true,
      status: res.statusCode,
      code: res.body?.error?.code || null,
      succeeded: res.statusCode >= 200 && res.statusCode < 300,
    }
  }

  it('generates tests/fixtures/risk-report.md (28 doc_types × 3 jurisdictions × 5 samples, mocked LLM)', async () => {
    const rows = []
    for (const docTypeId of listDocTypes()) {
      for (const jurisdiction of JURISDICTIONS) {
        for (const sample of SAMPLES) {
          const outcome = await runOne(docTypeId, jurisdiction, sample)
          rows.push({ docTypeId, jurisdiction, sample, ...outcome })
        }
      }
    }

    // Summarise per doc_type: for "clean" samples expected-to-pass, how
    // many passed? For the other samples (truncated/missing/drift/combo)
    // expected-to-fail, how many failed correctly?
    const summary = {}
    for (const row of rows) {
      const s = (summary[row.docTypeId] ||= {
        clean_pass_count: 0, clean_total: 0,
        negative_caught_count: 0, negative_total: 0,
        not_applicable: 0,
      })
      if (!row.applicable) { s.not_applicable += 1; continue }
      if (row.sample === 'clean') {
        s.clean_total += 1
        if (row.succeeded) s.clean_pass_count += 1
      } else {
        s.negative_total += 1
        if (!row.succeeded) s.negative_caught_count += 1
      }
    }

    // Detect registry gaps (founder-facing diagnostic).
    const gaps = {}
    for (const id of listDocTypes()) {
      const entry = getDocType(id)
      gaps[id] = {
        empty_required_clauses: (entry.required_clauses || []).length === 0,
        empty_forbidden_titles: (entry.forbidden_titles || []).length === 0,
        empty_worker_classification_modes: (entry.worker_classification_modes || []).length === 0,
      }
    }

    // Overall health score per doc_type — used to rank worst-first.
    // 0.0 = everything failed, 1.0 = everything behaved as expected.
    const docTypes = Object.keys(summary).sort((a, b) => {
      const scoreA = scoreFor(summary[a])
      const scoreB = scoreFor(summary[b])
      return scoreA - scoreB  // ascending = worst-first
    })

    const lines = []
    lines.push('# Phase 6 — doc-pipeline risk report')
    lines.push('')
    lines.push('Generated by `tests/harness/doc-pipeline-harness.test.js` against the mocked LLM.')
    lines.push('Ranked worst-first by overall health score. See the legend at the bottom for what the columns mean.')
    lines.push('')
    lines.push('Run configuration:')
    lines.push(`- Doc types: ${listDocTypes().length}`)
    lines.push(`- Jurisdictions per doc_type: ${JURISDICTIONS.length} (${JURISDICTIONS.join(', ')})`)
    lines.push(`- Samples per (doc_type × jurisdiction): ${SAMPLES.length} (${SAMPLES.join(', ')})`)
    lines.push(`- Total mocked generations: ${rows.length}`)
    lines.push('')
    lines.push('| Doc type | Clean pass rate | Negative-case catch rate | Registry gaps |')
    lines.push('|---|---|---|---|')
    for (const id of docTypes) {
      const s = summary[id]
      const cleanPct = s.clean_total === 0 ? 'n/a' : `${s.clean_pass_count}/${s.clean_total}`
      const negPct = s.negative_total === 0 ? 'n/a (no negative cases configured)' : `${s.negative_caught_count}/${s.negative_total}`
      const g = gaps[id]
      const gapFlags = []
      if (g.empty_required_clauses) gapFlags.push('required_clauses=[]')
      if (g.empty_forbidden_titles) gapFlags.push('forbidden_titles=[]')
      if (g.empty_worker_classification_modes) gapFlags.push('worker_classification_modes=[]')
      lines.push(`| \`${id}\` | ${cleanPct} | ${negPct} | ${gapFlags.length > 0 ? gapFlags.join(', ') : '—'} |`)
    }
    lines.push('')
    lines.push('## Legend')
    lines.push('')
    lines.push('- **Clean pass rate** — of the clean samples expected to generate a valid document, how many landed 200 OK? Ideal: `3/3` (one per jurisdiction).')
    lines.push('- **Negative-case catch rate** — of the malformed samples (truncated / missing clause / title drift / forbidden combination) expected to fail-close, how many were actually caught? Ideal: all applicable negatives caught. `n/a` rows indicate registry gaps: the doc_type has no `required_clauses`, no `forbidden_titles`, and no `forbidden_combinations` configured, so the malformed samples have nothing to hit.')
    lines.push('- **Registry gaps** — columns of the registry entry that are empty arrays. Founder-facing input for next-week registry-population work. DO NOT auto-populate from this column.')
    lines.push('')
    lines.push('## Not done here (by Phase 6 scope)')
    lines.push('')
    lines.push('- Live-canary run against real Anthropic')
    lines.push('- Observability dashboards / fallback-rate alerting')
    lines.push('- Hand-populating `required_clauses` / `forbidden_titles` for the other 26 doc_types — that is a separate workstream.')
    lines.push('')

    mkdirSync(FIXTURES, { recursive: true })
    writeFileSync(RISK_REPORT_PATH, lines.join('\n'))

    expect(lines.length).toBeGreaterThan(10)
    expect(rows.length).toBeGreaterThan(0)
  }, 120000)

  function scoreFor(s) {
    const cleanWeight = s.clean_total === 0 ? 1 : s.clean_pass_count / s.clean_total
    const negWeight = s.negative_total === 0 ? 1 : s.negative_caught_count / s.negative_total
    return (cleanWeight + negWeight) / 2
  }
})
