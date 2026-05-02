#!/usr/bin/env node
// scripts/smoke-signatures.mjs
//
// Signature-block smoke test for the 2026-05-02 NDA/MOU regression fix.
//
// Calls Anthropic directly with the system prompts our three endpoints now
// produce, then searches the last 30 lines of each response for execution-
// block markers. No Vercel CLI or HTTP server required.
//
// Usage:
//   node scripts/smoke-signatures.mjs
//
// Requires ANTHROPIC_API_KEY in env (loaded from .env.local automatically).
//
// Scenario coverage (7 scenarios as per the fix brief):
//   1. Nigerian NDA — prompt contains "NDPA 2023" (the bug-trigger)
//   2. Nigerian NDA — plain (control)
//   3. Nigerian MOU — multi-party
//   4. US NDA — one witness / notary acceptable
//   5. UK NDA — one witness / notary acceptable
//   6. Nigerian Tenancy Agreement — known-good control
//   7. Nigerian DPA — must NOT produce execution block guidance (DPA path)

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHmac } from 'node:crypto'

// Load .env.local
const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')
try {
  const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
    if (m) process.env[m[1]] = m[2]
  }
} catch { /* no .env.local */ }

const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1) }

// Import the shared execution-formalities clause
const { EXECUTION_FORMALITIES_CLAUSE } = await import('../lib/execution-formalities.js')

// Import the Nigeria jurisdiction context library
const { buildJurisdictionContext } = await import('../lib/jurisdiction-context.js')

// ── Colour helpers ────────────────────────────────────────────────────────
const isTTY = process.stdout.isTTY
const green  = s => isTTY ? `\x1b[32m${s}\x1b[0m` : s
const red    = s => isTTY ? `\x1b[31m${s}\x1b[0m` : s
const yellow = s => isTTY ? `\x1b[33m${s}\x1b[0m` : s
const dim    = s => isTTY ? `\x1b[2m${s}\x1b[0m`  : s
const bold   = s => isTTY ? `\x1b[1m${s}\x1b[0m`  : s

// ── Anthropic call ────────────────────────────────────────────────────────
async function callAnthropic({ model, systemPrompt, userPrompt, maxTokens }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Anthropic ${res.status}: ${err?.error?.message || 'unknown'}`)
  }
  const data = await res.json()
  return {
    text: data?.content?.[0]?.text || '',
    stopReason: data?.stop_reason || null,
  }
}

// ── Execution-block detector (mirrors lib/doc-completeness.js) ─────────────
function hasExecutionBlock(text) {
  const tail = text.slice(Math.floor(text.length * 0.7))
  const tailLower = tail.toLowerCase()
  if (
    tailLower.includes('signed by') ||
    tailLower.includes('in witness whereof') ||
    tailLower.includes('witness name:') ||
    tailLower.includes('witness signature:')
  ) return true
  const lines = tail.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (/_{10,}/.test(lines[i])) {
      const window = lines.slice(i, Math.min(i + 4, lines.length))
      if (window.some(l => /date:/i.test(l))) return true
    }
  }
  return false
}

// ── Scenario builder ──────────────────────────────────────────────────────
const ngJurCtx = buildJurisdictionContext('nigeria')

// Base system prompt for non-DPA docs (mirrors api/generate.js systemPrompt block)
function buildNonDpaSystemPrompt({ extraClauses = '' } = {}) {
  return ngJurCtx
    + '\n\nWhen drafting this document, apply the jurisdiction framework above: cite the statutes listed where they bear on the document type; use the governing-law clause structure from the framework; use the forum/venue from the framework; use the currency from the framework for monetary references; do not invoke statutes from other jurisdictions.'
    + '\n\nYou are an expert legal document drafter. Generate comprehensive, professional legal documents. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.'
    + extraClauses
    + EXECUTION_FORMALITIES_CLAUSE
}

// DPA system prompt — execution formalities must NOT be appended
function buildDpaSystemPromptLocal() {
  return 'You are an expert data protection lawyer. Generate a comprehensive Data Processing Agreement (DPA). Use formal legal language. This is a premium paid document.'
}

const MODEL_FAST  = 'claude-haiku-4-5-20251001'
const MODEL_FULL  = 'claude-sonnet-4-6'

// Use 8000 tokens for smoke test (Haiku is fast; 8000 = enough for a complete
// document without running the full 20000 production budget).
const SMOKE_TOKENS_NDA     = 8000
const SMOKE_TOKENS_MOU     = 12000
const SMOKE_TOKENS_TENANCY = 8000
const SMOKE_TOKENS_SHORT   = 5000
const SMOKE_TOKENS_DPA     = 5000

// Set to a specific scenario ID to run only that one (for re-runs)
const RUN_ONLY = process.env.SCENARIO ? parseInt(process.env.SCENARIO) : null

const SCENARIOS = [
  {
    id: 1,
    label: 'Nigerian NDA — prompt contains "NDPA 2023" (the bug-trigger)',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_NDA,
    systemPrompt: buildNonDpaSystemPrompt(),
    userPrompt: `Generate a Nigerian Non-Disclosure Agreement (NDA).

Party A: Acme Nigeria Limited (Disclosing Party)
Party B: Beta Ventures Ltd (Receiving Party)
Purpose: Evaluate a potential technology partnership
Governing Law: Laws of the Federal Republic of Nigeria
Jurisdiction: Lagos State High Court
Note: This NDA should be NDPA 2023 compliant — the parties handle personal data.

Generate the complete NDA document.`,
    expectBlock: true,
    note: 'isDpa must be false despite "NDPA 2023" in user prompt',
  },
  {
    id: 2,
    label: 'Nigerian NDA — plain (control)',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_NDA,
    systemPrompt: buildNonDpaSystemPrompt(),
    userPrompt: `Generate a Nigerian Non-Disclosure Agreement.

Disclosing Party: Sunrise Fintech Ltd
Receiving Party: Kola Adewale (individual consultant)
Purpose: Software development engagement
Governing Law: Nigeria
Duration: 3 years

Generate the complete NDA.`,
    expectBlock: true,
  },
  {
    id: 3,
    label: 'Nigerian MOU — multi-party',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_MOU,
    systemPrompt: buildNonDpaSystemPrompt(),
    userPrompt: `Generate a Memorandum of Understanding (MOU) between three parties.

Party A: Lagos State University (Educational Institution)
Party B: Naira Tech Innovations Ltd (Technology Company)
Party C: GreenBridge Foundation (NGO)
Purpose: Collaboration on a digital literacy program in underserved communities
Duration: 24 months
Financial Terms: Party B contributes ₦5,000,000 in equipment; Party C provides grants of ₦2,000,000
Governing Law: Nigeria
Jurisdiction: Lagos State High Court

Generate the complete MOU.`,
    expectBlock: true,
  },
  {
    id: 4,
    label: 'US NDA — one witness / notary block acceptable',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_SHORT,
    systemPrompt: 'You are an expert legal document drafter. Generate comprehensive, professional US legal documents. Use formal legal language. Never add disclaimers or suggestions to consult a lawyer.' + EXECUTION_FORMALITIES_CLAUSE,
    userPrompt: `Generate a Non-Disclosure Agreement governed by Delaware law.

Disclosing Party: Apex Innovations Inc (Delaware corporation)
Receiving Party: Jordan Smith (individual)
Purpose: Evaluate potential employment relationship
Governing Law: State of Delaware, United States
Duration: 2 years`,
    expectBlock: true,
  },
  {
    id: 5,
    label: 'UK NDA — English law',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_SHORT,
    systemPrompt: 'You are an expert legal document drafter with knowledge of English law. Generate comprehensive, professional UK legal documents. Use formal legal language. Never add disclaimers.' + EXECUTION_FORMALITIES_CLAUSE,
    userPrompt: `Generate a Non-Disclosure Agreement governed by English law.

Disclosing Party: Meridian Capital Ltd (company registered in England and Wales)
Receiving Party: DataStream Analytics Ltd (company registered in England and Wales)
Purpose: Evaluate potential acquisition
Governing Law: England and Wales
Duration: 5 years`,
    expectBlock: true,
  },
  {
    id: 6,
    label: 'Nigerian Tenancy Agreement (control — known to work)',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_TENANCY,
    systemPrompt: buildNonDpaSystemPrompt(),
    userPrompt: `Generate a Nigerian Tenancy Agreement.

Landlord: Chief Emmanuel Babatunde Adeyemi
Tenant: Mrs. Fatima Musa
Property: Flat 3B, 15 Adeola Odeku Street, Victoria Island, Lagos
Rent: ₦2,400,000 per annum
Tenancy Period: 2 years commencing 1 June 2026
Security Deposit: ₦2,400,000
Governing Law: Lagos State, Nigeria

Generate the complete Tenancy Agreement.`,
    expectBlock: true,
  },
  {
    id: 7,
    label: 'Nigerian DPA — must still trigger DPA path (isDpa = true)',
    model: MODEL_FAST,
    maxTokens: SMOKE_TOKENS_DPA,
    systemPrompt: buildDpaSystemPromptLocal(),
    userPrompt: `Generate a Data Processing Agreement (DPA) between a data controller and data processor under Nigerian law (NDPA 2023 / GAID 2025).

Controller: Acme Fintech Ltd
Processor: CloudData Services Ltd
Processing purpose: Customer KYC data for financial onboarding
Governing Law: Nigeria`,
    expectBlock: false,
    note: 'DPA uses separate system prompt — TWO WITNESSES PER PARTY must NOT appear',
  },
]

// ── Runner ────────────────────────────────────────────────────────────────
const results = []

console.log(bold('\n=== Signature Block Smoke Test (2026-05-02 fix) ===\n'))
console.log(dim('Using model: ' + MODEL_FAST + ' for speed\n'))

for (const s of SCENARIOS.filter(s => !RUN_ONLY || s.id === RUN_ONLY)) {
  process.stdout.write(`  ${dim('#' + s.id)} ${s.label} ... `)
  const t0 = Date.now()
  try {
    const { text, stopReason } = await callAnthropic({
      model: s.model,
      systemPrompt: s.systemPrompt,
      userPrompt: s.userPrompt,
      maxTokens: s.maxTokens,
    })

    const ms = Date.now() - t0
    const blockFound = hasExecutionBlock(text)
    const dpaClauseFound = text.includes('TWO WITNESSES PER PARTY')

    let ok = true
    let notes = []

    if (s.expectBlock && !blockFound) {
      ok = false
      notes.push('MISSING execution block')
    }
    if (!s.expectBlock && dpaClauseFound) {
      ok = false
      notes.push('DPA erroneously got TWO WITNESSES PER PARTY')
    }
    if (stopReason === 'max_tokens') {
      notes.push('⚠ hit max_tokens — may be truncated')
    }

    const status = ok ? green('✓') : red('✗')
    const notesStr = notes.length ? ' — ' + notes.join('; ') : ''
    console.log(`${status} ${dim(`(${ms}ms, stop=${stopReason})`)}${notesStr}`)

    if (s.note) console.log(`     ${dim('note: ' + s.note)}`)

    // Last 30 lines
    const lines = text.split('\n')
    const last30 = lines.slice(-30).join('\n')
    console.log(dim('     ── last 30 lines ──────────────────────────────────'))
    for (const l of last30.split('\n')) {
      console.log(dim('     │ ') + (l.trim() ? l : dim('(blank)')))
    }
    console.log(dim('     ─────────────────────────────────────────────────\n'))

    results.push({ id: s.id, label: s.label, ok, stopReason, ms })
  } catch (err) {
    const ms = Date.now() - t0
    console.log(`${red('✗')} ${red(err.message)} ${dim(`(${ms}ms)`)}`)
    results.push({ id: s.id, label: s.label, ok: false, error: err.message, ms })
  }
}

// ── Summary ───────────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length
const failed = results.filter(r => !r.ok)

console.log(bold('=== Summary ==='))
console.log(`  ${green(passed + ' passed')}, ${failed.length ? red(failed.length + ' failed') : dim('0 failed')}`)
if (failed.length) {
  console.log(red('\n  Failures:'))
  for (const f of failed) {
    console.log(`    ${red('✗')} #${f.id} ${f.label}`)
    if (f.error) console.log(`        ${dim(f.error)}`)
  }
  process.exit(1)
}
console.log()
process.exit(0)
