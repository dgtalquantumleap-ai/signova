#!/usr/bin/env node
// scripts/smoke-test-retrieval.mjs
//
// A/B smoke test for Day 3 statute-retrieval injection.
//
// Generates two US Federal NDAs against Anthropic — one WITH the statute
// context injection, one WITHOUT — and prints a side-by-side comparison
// (length, U.S.C. citation count, DTSA/EEA/§ 1833 mention, etc.).
//
// Bypasses the dev server. Calls Anthropic directly with a minimal NDA
// prompt + (optionally) the same statute context block that the real
// endpoints would inject. Isolates the marginal effect of retrieval.
//
// Usage:
//   node scripts/smoke-test-retrieval.mjs
//
// Required env (loaded from nearest .env.local walking up from this file):
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Output:
//   <repo>/tmp/nda-with-retrieval.txt
//   <repo>/tmp/nda-without-retrieval.txt
//
// Exit codes:
//   0 — both generations succeeded
//   1 — one or both generations failed (details printed)
//   2 — fatal config / env error

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, parse as parsePath } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dir, '..')

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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY')
  process.exit(2)
}

// ── Build base system prompt ──────────────────────────────────────────────
// Minimal — focuses the test on retrieval's marginal effect, not on the
// full clause stack of api/generate.js. The base instruction names the
// jurisdiction (US Federal) and document type (NDA) so the model behaves
// comparably across both runs.
const BASE_SYSTEM = [
  'You are an expert legal document drafter generating United States federal-law non-disclosure agreements.',
  'Use formal legal language with numbered sections.',
  'Cite specific statutes (with U.S. Code section references) where relevant — confidentiality, trade secrets, remedies, whistleblower notices.',
  'Apply US English spelling. Use USD for monetary references.',
  'End with a complete execution block (parties\' signature lines, dates, witness lines if customary).',
  'Do not append disclaimers, footnotes, or "consult a lawyer" notes.',
].join(' ')

const USER_PROMPT =
  'Generate a comprehensive non-disclosure agreement between:\n' +
  '- Acme Robotics Inc. (Disclosing Party), a Delaware corporation\n' +
  '- Beta Manufacturing LLC (Receiving Party), a New York limited liability company\n' +
  '\n' +
  'Purpose: protect confidential information shared during evaluation of a potential supply-chain partnership.\n' +
  'Term: 3 years from the effective date.\n' +
  'Governing law: United States federal law and applicable state law where required.\n' +
  'Include standard provisions: definitions, exceptions to confidentiality, return of materials, remedies for breach, whistleblower notices required by federal law, and execution block.'

// ── Force retrieval ON for the WITH run, then OFF for the WITHOUT run ────
async function buildStatuteContextOn() {
  process.env.STATUTE_RETRIEVAL_ENABLED = 'true'
  process.env.STATUTE_RETRIEVAL_USA_FEDERAL = 'true'
  // Fresh import so the retrieval module reads the env we just set.
  const { buildStatuteContext } = await import('../lib/statute-injection.js?on=' + Date.now())
  return await buildStatuteContext('usa_federal', 'nda')
}

async function callAnthropic(systemPrompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: USER_PROMPT }],
    }),
  })
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`Anthropic HTTP ${resp.status}: ${txt.slice(0, 300)}`)
  }
  const data = await resp.json()
  return data?.content?.[0]?.text ?? ''
}

function metrics(text) {
  if (!text) return { length: 0, uscCount: 0, hasDtsa: false, hasEea: false, has1833: false, has1832: false, has1839: false, has1836: false }
  const uscMatches = text.match(/\b\d+\s*U\.?S\.?C\.?\s*§?\s*\d+/gi) ?? []
  return {
    length: text.length,
    uscCount: uscMatches.length,
    hasDtsa: /\bDTSA\b|defend\s+trade\s+secrets\s+act/i.test(text),
    hasEea: /\bEEA\b|economic\s+espionage\s+act/i.test(text),
    has1833: /\b18\s*U\.?S\.?C\.?\s*§?\s*1833\b/i.test(text),
    has1832: /\b18\s*U\.?S\.?C\.?\s*§?\s*1832\b/i.test(text),
    has1839: /\b18\s*U\.?S\.?C\.?\s*§?\s*1839\b/i.test(text),
    has1836: /\b18\s*U\.?S\.?C\.?\s*§?\s*1836\b/i.test(text),
  }
}

function fmtRow(label, on, off) {
  const arrow = on === off ? '   '
    : (typeof on === 'number' && typeof off === 'number' && on > off) ? ' ↑ '
    : (typeof on === 'boolean' && on === true && off === false) ? ' ↑ '
    : ' ↓ '
  return `  ${label.padEnd(28)}: ${String(off).padEnd(10)}${arrow}${on}`
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('\n=== Day 3 retrieval smoke test ===\n')

console.log('[1/3] Building statute context (retrieval ON)...')
let statuteContext
try {
  statuteContext = await buildStatuteContextOn()
} catch (err) {
  console.error('  ✗ buildStatuteContext threw:', err.message)
  process.exit(1)
}
if (!statuteContext) {
  console.error('  ✗ buildStatuteContext returned null — cache may be empty or flags wrong')
  process.exit(1)
}
console.log(`  ✓ statute context built: ${statuteContext.length} chars`)

const tmpDir = join(ROOT, 'tmp')
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

console.log('\n[2/3] Generating NDA WITH retrieval (Sonnet)...')
let textOn
try {
  const t0 = Date.now()
  textOn = await callAnthropic(BASE_SYSTEM + '\n\n' + statuteContext)
  console.log(`  ✓ ${textOn.length} chars in ${Date.now() - t0}ms`)
  writeFileSync(join(tmpDir, 'nda-with-retrieval.txt'), textOn)
} catch (err) {
  console.error('  ✗ ON run failed:', err.message)
  process.exit(1)
}

console.log('\n[3/3] Generating NDA WITHOUT retrieval (Sonnet)...')
let textOff
try {
  const t0 = Date.now()
  textOff = await callAnthropic(BASE_SYSTEM)
  console.log(`  ✓ ${textOff.length} chars in ${Date.now() - t0}ms`)
  writeFileSync(join(tmpDir, 'nda-without-retrieval.txt'), textOff)
} catch (err) {
  console.error('  ✗ OFF run failed:', err.message)
  process.exit(1)
}

const mOn = metrics(textOn)
const mOff = metrics(textOff)

console.log('\n────────────── A/B comparison ──────────────')
console.log(`  ${'metric'.padEnd(28)}: ${'OFF'.padEnd(10)}   ON`)
console.log(`  ${'-'.repeat(28)}: ${'-'.repeat(10)}   ${'-'.repeat(10)}`)
console.log(fmtRow('total length (chars)', mOn.length, mOff.length))
console.log(fmtRow('U.S.C. citation count', mOn.uscCount, mOff.uscCount))
console.log(fmtRow('mentions DTSA', mOn.hasDtsa, mOff.hasDtsa))
console.log(fmtRow('mentions EEA', mOn.hasEea, mOff.hasEea))
console.log(fmtRow('cites § 1839 (def)', mOn.has1839, mOff.has1839))
console.log(fmtRow('cites § 1836 (civil)', mOn.has1836, mOff.has1836))
console.log(fmtRow('cites § 1833 (notice)', mOn.has1833, mOff.has1833))
console.log(fmtRow('cites § 1832 (criminal)', mOn.has1832, mOff.has1832))

console.log(`\nFiles written:`)
console.log(`  ${join(tmpDir, 'nda-with-retrieval.txt')}`)
console.log(`  ${join(tmpDir, 'nda-without-retrieval.txt')}`)
console.log(`\nRead both, decide if retrieval improves the document, then approve Day 3 commit.`)

process.exit(0)
