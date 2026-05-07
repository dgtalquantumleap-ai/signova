#!/usr/bin/env node
// scripts/smoke-test-delaware-nda.mjs
//
// A/B smoke test for Day 5A Delaware routing — generates two Delaware NDAs
// against Anthropic (one WITH usa_delaware bundle injection, one WITHOUT)
// and prints citation metrics focused on Delaware-specific markers
// (6 Del. C. §§ 2001-2004, Court of Chancery, DUTSA).
//
// Bypasses the dev server. Calls Anthropic directly with the same statute
// context block that the real endpoints would inject. Isolates the
// marginal effect of the usa_delaware bundle vs. usa_federal fallback.
//
// Usage:
//   node scripts/smoke-test-delaware-nda.mjs
//
// Required env (loaded from nearest .env.local walking up from this file):
//   ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Output:
//   <repo>/tmp/nda-delaware-with-retrieval.txt
//   <repo>/tmp/nda-delaware-without-retrieval.txt

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

const BASE_SYSTEM = [
  'You are an expert legal document drafter generating non-disclosure agreements governed by Delaware law.',
  'Use formal legal language with numbered sections.',
  'Cite specific statutes (with U.S. Code and Delaware Code section references) where relevant — confidentiality, trade secrets, remedies, whistleblower notices.',
  'Apply US English spelling. Use USD for monetary references.',
  'End with a complete execution block (parties\' signature lines, dates, witness lines if customary).',
  'Do not append disclaimers, footnotes, or "consult a lawyer" notes.',
].join(' ')

const USER_PROMPT =
  'Generate a comprehensive non-disclosure agreement between:\n' +
  '- Acme Robotics Inc. (Disclosing Party), a Delaware corporation\n' +
  '- Beta Manufacturing LLC (Receiving Party), a Delaware limited liability company\n' +
  '\n' +
  'Purpose: protect confidential information shared during evaluation of a potential supply-chain partnership.\n' +
  'Term: 3 years from the effective date.\n' +
  'Governing law: State of Delaware (United States — Delaware). Forum: Delaware Court of Chancery for equitable relief; Delaware Superior Court (New Castle County) for legal claims.\n' +
  'Include standard provisions: definitions, exceptions to confidentiality, return of materials, remedies for breach (citing the Delaware Uniform Trade Secrets Act where relevant), whistleblower notices required by federal law, and execution block.'

async function buildStatuteContextOn() {
  process.env.STATUTE_RETRIEVAL_ENABLED = 'true'
  process.env.STATUTE_RETRIEVAL_USA_DELAWARE = 'true'
  const { buildStatuteContext } = await import('../lib/statute-injection.js?delaware=' + Date.now())
  return await buildStatuteContext('usa_delaware', 'nda')
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
  if (!text) return {}
  const delCMatches = text.match(/\b6\s*Del\.?\s*C\.?\s*§?\s*\d{4}/gi) ?? []
  return {
    length: text.length,
    delC_total: delCMatches.length,
    cites_2001: /\b6\s*Del\.?\s*C\.?\s*§?\s*2001\b/i.test(text),
    cites_2002: /\b6\s*Del\.?\s*C\.?\s*§?\s*2002\b/i.test(text),
    cites_2003: /\b6\s*Del\.?\s*C\.?\s*§?\s*2003\b/i.test(text),
    cites_2004: /\b6\s*Del\.?\s*C\.?\s*§?\s*2004\b/i.test(text),
    mentions_DUTSA: /\bDUTSA\b|delaware\s+uniform\s+trade\s+secrets\s+act/i.test(text),
    mentions_court_of_chancery: /\bcourt\s+of\s+chancery\b/i.test(text),
    cites_DGCL: /\bDGCL\b|delaware\s+general\s+corporation\s+law/i.test(text),
  }
}

function fmtRow(label, on, off) {
  let arrow = '   '
  if (on === off) arrow = '   '
  else if (typeof on === 'number' && typeof off === 'number') arrow = on > off ? ' ↑ ' : ' ↓ '
  else if (typeof on === 'boolean') arrow = (on === true && off === false) ? ' ↑ ' : ' ↓ '
  return `  ${label.padEnd(28)}: ${String(off).padEnd(10)}${arrow}${on}`
}

console.log('\n=== Day 5A Delaware retrieval smoke test ===\n')

console.log('[1/3] Building Delaware statute context (retrieval ON)...')
let statuteContext
try {
  statuteContext = await buildStatuteContextOn()
} catch (err) {
  console.error('  ✗ buildStatuteContext threw:', err.message)
  process.exit(1)
}
if (!statuteContext) {
  console.error('  ✗ buildStatuteContext returned null — Delaware bundle unverified or cache empty')
  process.exit(1)
}
console.log(`  ✓ Delaware context built: ${statuteContext.length} chars`)

const tmpDir = join(ROOT, 'tmp')
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true })

console.log('\n[2/3] Generating Delaware NDA WITH retrieval (Sonnet)...')
let textOn
try {
  const t0 = Date.now()
  textOn = await callAnthropic(BASE_SYSTEM + '\n\n' + statuteContext)
  console.log(`  ✓ ${textOn.length} chars in ${Date.now() - t0}ms`)
  writeFileSync(join(tmpDir, 'nda-delaware-with-retrieval.txt'), textOn)
} catch (err) {
  console.error('  ✗ ON run failed:', err.message)
  process.exit(1)
}

console.log('\n[3/3] Generating Delaware NDA WITHOUT retrieval (Sonnet)...')
let textOff
try {
  const t0 = Date.now()
  textOff = await callAnthropic(BASE_SYSTEM)
  console.log(`  ✓ ${textOff.length} chars in ${Date.now() - t0}ms`)
  writeFileSync(join(tmpDir, 'nda-delaware-without-retrieval.txt'), textOff)
} catch (err) {
  console.error('  ✗ OFF run failed:', err.message)
  process.exit(1)
}

const mOn = metrics(textOn)
const mOff = metrics(textOff)

console.log('\n────────────── A/B comparison (Delaware-specific) ──────────────')
console.log(`  ${'metric'.padEnd(28)}: ${'OFF'.padEnd(10)}   ON`)
console.log(`  ${'-'.repeat(28)}: ${'-'.repeat(10)}   ${'-'.repeat(10)}`)
console.log(fmtRow('total length (chars)', mOn.length, mOff.length))
console.log(fmtRow('6 Del. C. cite count', mOn.delC_total, mOff.delC_total))
console.log(fmtRow('cites § 2001 (definitions)', mOn.cites_2001, mOff.cites_2001))
console.log(fmtRow('cites § 2002 (injunction)', mOn.cites_2002, mOff.cites_2002))
console.log(fmtRow('cites § 2003 (damages)', mOn.cites_2003, mOff.cites_2003))
console.log(fmtRow('cites § 2004 (atty fees)', mOn.cites_2004, mOff.cites_2004))
console.log(fmtRow('mentions DUTSA', mOn.mentions_DUTSA, mOff.mentions_DUTSA))
console.log(fmtRow('mentions Court of Chancery', mOn.mentions_court_of_chancery, mOff.mentions_court_of_chancery))
console.log(fmtRow('cites DGCL', mOn.cites_DGCL, mOff.cites_DGCL))

console.log(`\nFiles written:`)
console.log(`  ${join(tmpDir, 'nda-delaware-with-retrieval.txt')}`)
console.log(`  ${join(tmpDir, 'nda-delaware-without-retrieval.txt')}`)

process.exit(0)
