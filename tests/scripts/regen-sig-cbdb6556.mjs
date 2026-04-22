#!/usr/bin/env node
//
// tests/scripts/regen-sig-cbdb6556.mjs
//
// One-command regeneration of SIG-CBDB6556 against the fixed pipeline.
// Submits a synthetic input matching the known shape of the original
// document (Nigerian Service Agreement, founder hiring lawyer for
// pre-incorporation work, independent_contractor classification)
// through the same shared orchestrator that powers production.
//
// Output:
//   tmp/SIG-CBDB6556-regenerated.txt (repo-local, gitignored)
//   Absolute path printed to stdout on completion.
//
// This script is for founder visual review ONLY. It does not email,
// push, or send anywhere. If ANTHROPIC_API_KEY is not set, it runs
// against a canned "clean" mock so the output is still reviewable
// on machines without LLM credentials.
//
// Usage:
//   node tests/scripts/regen-sig-cbdb6556.mjs
//   node tests/scripts/regen-sig-cbdb6556.mjs --mock   (force mock path)

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import {
  generateWithCompletenessCheck,
  DOC_INCOMPLETE_AFTER_RETRY,
  DOC_TITLE_BODY_MISMATCH,
  DOC_FORBIDDEN_COMBINATION,
} from '../../lib/doc-completeness.js'
import { buildClassificationInstruction } from '../../lib/doc-classification.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..', '..')
const TMP_DIR = join(REPO_ROOT, 'tmp')
const OUTPUT_PATH = join(TMP_DIR, 'SIG-CBDB6556-regenerated.txt')

// Synthetic input matching the SIG-CBDB6556 shape. Cross-referenced
// against tests/fixtures/sig-cbdb6556-inputs.json (the reconstructed
// baseline) — same shape, same jurisdiction, same classification.
const DOC_TYPE = 'service-agreement'
const JURISDICTION = 'Nigeria'
const WORKER_CLASSIFICATION = 'independent_contractor'

const FIELDS = {
  provider: 'Adewale Okonkwo Consulting Ltd.',
  client: 'BrightPath Nigeria Ltd.',
  services: 'Legal advisory for pre-incorporation structuring, CAMA 2020 compliance review, and initial shareholder agreement drafting for the founder\'s incoming Lagos-based holding company. The engagement is as an independent contractor — no employment relationship.',
  fee: '\u20a61,500,000 total, paid in two tranches (50% on signing, 50% on delivery of final incorporation pack)',
  paymentTerms: '50% upfront, 50% on completion',
  duration: 'One-time project',
  ipOwnership: 'Client owns all deliverables',
  confidentiality: 'Yes \u2014 both parties keep information confidential',
  jurisdiction: JURISDICTION,
}

// Assemble the same freeform prompt the consumer UI would have sent.
function buildPrompt() {
  const summary = Object.entries(FIELDS)
    .map(([k, v]) => {
      const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
      return `${label}: ${v}`
    })
    .join('\n')
  return [
    'Generate a professional, comprehensive Service Agreement document for the following business:',
    '',
    summary,
    '',
    'Requirements:',
    '- Formal legal language appropriate for the governing jurisdiction.',
    '- Clear numbered sections and subsections.',
    '- Include all standard clauses expected in a Service Agreement.',
    '- Do not include any placeholder text like [INSERT NAME] — use the actual values provided.',
    '- End with a signature block.',
    '',
    'Output the complete document only.',
  ].join('\n')
}

// Minimal system prompt — the real api/generate.js assembles a 46-clause
// jurisdiction-aware system prompt, but for a visual-review regeneration
// we send a conservative baseline so the output reflects the fix
// (classification routing + completeness check + title/body validation)
// rather than the extensive clause library. Reviewing the FIX, not the
// clause set.
function buildSystemPrompt() {
  return [
    'You are an expert legal document drafter with deep knowledge of Nigerian law. Generate a comprehensive, professional service agreement tailored precisely to the details provided. Use formal legal language, clear numbered sections, and include all standard clauses.',
    'The document is governed by the laws of the Federal Republic of Nigeria. Do NOT invoke California, Delaware, or any U.S. state unless the user explicitly named one.',
    '',
    'Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block.',
  ].join('\n\n')
}

// Canned clean output — used when ANTHROPIC_API_KEY is absent or --mock
// is passed. Matches the Phase 5 independent_contractor clean fixture
// shape so the validators pass and the output is representative.
function loadMockOutput() {
  try {
    const fixturePath = join(REPO_ROOT, 'tests', 'fixtures', 'sig-cbdb6556-clean-independent-contractor.txt')
    return readFileSync(fixturePath, 'utf8')
  } catch {
    return '# SERVICE AGREEMENT\n\n(mock output — fixture missing; see lib/doc-registry.json for the registered title.)\n'
  }
}

function makeMockFetch() {
  return async () => ({
    text: loadMockOutput(),
    stopReason: 'end_turn',
    raw: { mocked: true },
  })
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const apiKey = process.env.ANTHROPIC_API_KEY
  const wantsMock = args.has('--mock') || !apiKey

  const userPrompt = buildPrompt()
  const systemPrompt = buildSystemPrompt()
  const classificationInstruction = buildClassificationInstruction(DOC_TYPE, WORKER_CLASSIFICATION)

  const logger = {
    logInfo: (ep, payload) => console.error(`[info ${ep}]`, JSON.stringify(payload)),
    logWarn: (ep, payload) => console.error(`[warn ${ep}]`, JSON.stringify(payload)),
    logError: (ep, payload) => console.error(`[error ${ep}]`, JSON.stringify(payload)),
  }

  console.error(wantsMock
    ? '[regen] No ANTHROPIC_API_KEY (or --mock passed) — using fixture-backed mock path.'
    : '[regen] ANTHROPIC_API_KEY found — calling live Anthropic.'
  )

  const result = await generateWithCompletenessCheck({
    apiKey: apiKey || 'mocked',
    model: 'claude-sonnet-4-6',
    systemPrompt,
    userPrompt,
    docType: DOC_TYPE,
    jurisdiction: JURISDICTION,
    workerClassification: WORKER_CLASSIFICATION,
    classificationInstruction,
    logger,
    abortSignal: undefined,
    anthropicFetch: wantsMock ? makeMockFetch() : undefined,
  })

  mkdirSync(TMP_DIR, { recursive: true })

  if (!result.ok) {
    const lines = [
      `# SIG-CBDB6556 regeneration \u2014 FAIL-CLOSED`,
      ``,
      `The fixed pipeline rejected this generation:`,
      ``,
      `- code: ${result.code}`,
      `- reference_id: ${result.referenceId}`,
    ]
    if (result.code === DOC_INCOMPLETE_AFTER_RETRY) lines.push(`- missing_clauses: ${JSON.stringify(result.missingClauses)}`)
    if (result.code === DOC_TITLE_BODY_MISMATCH) lines.push(`- expected_title: ${result.expectedTitle}`, `- conflicting_title: ${result.conflictingTitle}`)
    if (result.code === DOC_FORBIDDEN_COMBINATION) lines.push(`- combination_id: ${result.combinationId}`, `- description: ${result.description}`)
    lines.push(``)
    lines.push(`This IS the fixed pipeline behaviour: on detected defects, fail-close with a stable error code + reference ID rather than ship a broken document.`)
    writeFileSync(OUTPUT_PATH, lines.join('\n'))
    console.log(OUTPUT_PATH)
    return
  }

  const header = [
    `# SIG-CBDB6556 regeneration \u2014 OK`,
    ``,
    `- reference_id: ${result.referenceId}`,
    `- used_continuation: ${result.usedContinuation}`,
    `- first_stop_reason: ${result.firstStopReason || '(n/a)'}`,
    `- source: ${wantsMock ? 'fixture-backed mock' : 'live Anthropic'}`,
    `- doc_type: ${DOC_TYPE}`,
    `- jurisdiction: ${JURISDICTION}`,
    `- worker_classification: ${WORKER_CLASSIFICATION}`,
    ``,
    `---`,
    ``,
  ].join('\n')

  writeFileSync(OUTPUT_PATH, header + result.text + '\n')
  console.log(OUTPUT_PATH)
}

main().catch(err => {
  console.error('[regen] fatal:', err)
  process.exit(1)
})
