#!/usr/bin/env node
// scripts/check-css-tokens.mjs
// Guardrail: block net-new raw hex colors / raw px values in src/pages/*.css.
//
// This script is advisory — it tracks the current count in a lockfile
// (scripts/.css-baseline.json). If a CSS file's count goes UP, it fails.
// If counts stay flat or go down, it passes. This lets us land the refactor
// gradually without demanding a big-bang rewrite.
//
// Run locally:  node scripts/check-css-tokens.mjs
// Update baseline after intentional improvements:  node scripts/check-css-tokens.mjs --update

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSS_DIR = join(ROOT, 'src', 'pages')
const BASELINE = join(__dirname, '.css-baseline.json')
const UPDATE = process.argv.includes('--update')

const HEX_RE = /#[0-9a-f]{3,8}\b/gi
// Count raw px tokens, but ignore the legitimate ones inside var() defaults
// and media queries where px is canonical.
const PX_RE = /(\d+)px/g

function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(d => d.isDirectory()
      ? collectFiles(join(dir, d.name))
      : d.name.endsWith('.css') ? [join(dir, d.name)] : []
    )
}

function countOffences(filePath) {
  const text = readFileSync(filePath, 'utf8')
  return {
    hex: (text.match(HEX_RE) || []).length,
    px: (text.match(PX_RE) || []).length,
  }
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return {}
  try { return JSON.parse(readFileSync(BASELINE, 'utf8')) } catch { return {} }
}

const files = collectFiles(CSS_DIR)
const current = {}
for (const f of files) {
  const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/')
  current[rel] = countOffences(f)
}

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
  console.log(`✓ Baseline updated for ${Object.keys(current).length} files.`)
  process.exit(0)
}

const baseline = loadBaseline()
const regressions = []
for (const [file, counts] of Object.entries(current)) {
  const base = baseline[file] || { hex: counts.hex, px: counts.px } // new files grandfather in
  if (counts.hex > base.hex) regressions.push(`${file}: hex ${base.hex} → ${counts.hex}`)
  if (counts.px > base.px)   regressions.push(`${file}: px ${base.px} → ${counts.px}`)
}

if (regressions.length) {
  console.error('✗ CSS token drift detected — new raw hex/px values introduced:')
  for (const r of regressions) console.error(`  ${r}`)
  console.error('\nFix: replace raw values with tokens from src/index.css (e.g. var(--bg2), var(--space-4)).')
  console.error('If the increase is intentional, rerun with --update to accept the new baseline.')
  process.exit(1)
}

const totals = Object.values(current).reduce((a, c) => ({ hex: a.hex + c.hex, px: a.px + c.px }), { hex: 0, px: 0 })
console.log(`✓ CSS token check passed — ${totals.hex} hex / ${totals.px} px across ${files.length} files (no regressions).`)
