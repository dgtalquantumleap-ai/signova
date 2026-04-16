#!/usr/bin/env node
// scripts/css-mechanical-sweep.mjs
// Safe, reversible mechanical replacements to reduce raw-value drift in page CSS.
//
// Rules:
//   px values that EXACTLY match a defined --space-* token → var(--space-N)
//   px font-size values that EXACTLY match --text-* tokens  → var(--text-…)
//   px border-radius values that EXACTLY match --radius-*   → var(--radius-…)
//
// Rules are "exact match" only — we never approximate. If a value is close
// but not identical to a token (e.g. 17px when the scale has 16px), we
// leave it alone. This keeps visual output byte-identical.
//
// Run:   node scripts/css-mechanical-sweep.mjs
// Dry:   node scripts/css-mechanical-sweep.mjs --dry

import { readFileSync, writeFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSS_DIR = join(ROOT, 'src', 'pages')
const DRY = process.argv.includes('--dry')

// Exact token map. Keep in sync with src/index.css.
const SPACE = { 4: '--space-1', 8: '--space-2', 12: '--space-3', 16: '--space-4', 24: '--space-5', 32: '--space-6', 48: '--space-7', 64: '--space-8', 96: '--space-9' }
const TEXT  = { 12: '--text-xs', 14: '--text-sm', 16: '--text-base', 18: '--text-md', 20: '--text-lg', 24: '--text-xl', 32: '--text-2xl', 48: '--text-3xl', 64: '--text-4xl' }
const RAD   = { 6: '--radius-sm', 12: '--radius', 16: '--radius-lg', 24: '--radius-xl' }

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? collect(join(dir, d.name)) : d.name.endsWith('.css') ? [join(dir, d.name)] : []
  )
}

// Replace standalone Npx inside a property value, but only when the whole
// value is a single N or a simple shorthand like "12px 16px 12px 16px".
// We do NOT touch compound calc() values, inline shadows, gradients etc.
function sweep(content) {
  let out = content
  let pxReplaced = 0, fontReplaced = 0, radiusReplaced = 0

  // Font-size: Npx  →  var(--text-…)
  out = out.replace(/(\bfont-size\s*:\s*)(\d+)px(\s*(?:;|\}|\s*!important))/g, (m, pre, n, post) => {
    const tok = TEXT[Number(n)]
    if (!tok) return m
    fontReplaced++
    return `${pre}var(${tok})${post}`
  })

  // border-radius: Npx; (single value only — skip shorthands with spaces)
  out = out.replace(/(\bborder-radius\s*:\s*)(\d+)px(\s*(?:;|\}))/g, (m, pre, n, post) => {
    const tok = RAD[Number(n)]
    if (!tok) return m
    radiusReplaced++
    return `${pre}var(${tok})${post}`
  })

  // padding/margin/gap/top/right/bottom/left/inset: handle 1–4 value shorthands
  const SHORTHAND_PROPS = ['padding', 'margin', 'gap', 'row-gap', 'column-gap', 'top', 'right', 'bottom', 'left', 'inset']
  const propRe = new RegExp(`(\\b(?:${SHORTHAND_PROPS.join('|')})\\s*:\\s*)([^;{}\\n]+?)(\\s*(?:;|\\}))`, 'g')
  out = out.replace(propRe, (m, pre, value, post) => {
    // Only touch values composed entirely of Npx tokens separated by whitespace.
    if (!/^[\d\s]*\d+px(?:\s+\d+px)*\s*$/.test(value)) return m
    const parts = value.trim().split(/\s+/)
    const swapped = parts.map(p => {
      const n = Number(p.replace('px', ''))
      const tok = SPACE[n]
      if (!tok) return p
      pxReplaced++
      return `var(${tok})`
    })
    return `${pre}${swapped.join(' ')}${post}`
  })

  return { out, stats: { pxReplaced, fontReplaced, radiusReplaced } }
}

const files = collect(CSS_DIR)
let totals = { pxReplaced: 0, fontReplaced: 0, radiusReplaced: 0, filesChanged: 0 }

for (const f of files) {
  const orig = readFileSync(f, 'utf8')
  const { out, stats } = sweep(orig)
  if (out !== orig) {
    totals.filesChanged++
    totals.pxReplaced += stats.pxReplaced
    totals.fontReplaced += stats.fontReplaced
    totals.radiusReplaced += stats.radiusReplaced
    if (!DRY) writeFileSync(f, out)
    const rel = f.slice(ROOT.length + 1).replace(/\\/g, '/')
    console.log(`${DRY ? '[dry]' : '[ok]'} ${rel} — px:${stats.pxReplaced} font:${stats.fontReplaced} radius:${stats.radiusReplaced}`)
  }
}

console.log(`\n${DRY ? 'Would change' : 'Changed'} ${totals.filesChanged} files: ${totals.pxReplaced} px + ${totals.fontReplaced} font-size + ${totals.radiusReplaced} radius values tokenised.`)
