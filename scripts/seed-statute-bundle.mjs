#!/usr/bin/env node
// scripts/seed-statute-bundle.mjs
//
// Seeds the Supabase statute_cache for a (jurisdiction, doc_type) combination
// by running each query in the bundle definition through Olostep and writing
// the response to cache.
//
// Usage:
//   node scripts/seed-statute-bundle.mjs --jurisdiction usa_federal --docType nda
//
// Required env (loaded from the nearest .env.local walking up from this file):
//   OLOSTEP_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Exit codes:
//   0 — every query succeeded
//   1 — one or more queries failed (script continues, prints summary)
//   2 — fatal config / arg error (no work attempted)

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, parse as parsePath } from 'node:path'

// ── Load .env.local — walk up from script dir until found ──────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
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
else console.log('[env] no .env.local found — relying on process.env')

// ── Parse args ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--jurisdiction') out.jurisdiction = argv[++i]
    else if (argv[i] === '--docType') out.docType = argv[++i]
  }
  return out
}
const { jurisdiction, docType } = parseArgs(process.argv.slice(2))
if (!jurisdiction || !docType) {
  console.error('Usage: node scripts/seed-statute-bundle.mjs --jurisdiction <key> --docType <key>')
  process.exit(2)
}

// ── Validate env ───────────────────────────────────────────────────────────
const OLOSTEP_API_KEY = process.env.OLOSTEP_API_KEY
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const missing = []
if (!OLOSTEP_API_KEY) missing.push('OLOSTEP_API_KEY')
if (!SUPABASE_URL) missing.push('SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`)
  process.exit(2)
}

// ── Load bundle definition ─────────────────────────────────────────────────
const { getBundleDefinition } = await import('../lib/statute-bundles.js')
const bundle = getBundleDefinition(jurisdiction, docType)
if (!bundle) {
  console.error(`No bundle defined for jurisdiction="${jurisdiction}" docType="${docType}"`)
  process.exit(2)
}
if (!Array.isArray(bundle) || bundle.length === 0) {
  console.error(`Bundle for ${jurisdiction}/${docType} is empty — nothing to seed`)
  process.exit(2)
}
console.log(`[bundle] ${jurisdiction}/${docType}: ${bundle.length} queries`)

// ── Supabase client ────────────────────────────────────────────────────────
// Node 20 lacks native WebSocket; supabase-js's realtime layer needs `ws`
// passed in explicitly. We don't use realtime, but client construction
// initialises it eagerly.
const { createClient } = await import('@supabase/supabase-js')
const ws = (await import('ws')).default
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Olostep call (mirrors lib/statute-retrieval.js#callOlostep contract) ───
function parseJsonContent(jsonContent) {
  if (typeof jsonContent === 'string') {
    try { return JSON.parse(jsonContent) }
    catch { return { content: jsonContent, sources: [] } }
  }
  return jsonContent ?? { content: '', sources: [] }
}

async function callOlostep(query) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60_000) // 60s for seeding
  try {
    const resp = await fetch('https://api.olostep.com/v1/answers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OLOSTEP_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        task: query,
        json_format: {
          content: '',
          sources: [{ url: '', title: '' }],
        },
      }),
      signal: controller.signal,
    })
    if (resp.status >= 500) throw new Error(`Olostep HTTP ${resp.status}`)
    if (resp.status >= 400) {
      const text = await resp.text().catch(() => '')
      return { error: `HTTP ${resp.status}: ${text.slice(0, 200)}` }
    }
    const data = await resp.json()
    const parsed = parseJsonContent(data?.result?.json_content)
    return {
      content: parsed.content ?? '',
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      answerId: data?.id ?? null,
    }
  } catch (err) {
    return { error: err.message ?? String(err) }
  } finally {
    clearTimeout(timeoutId)
  }
}

// Idempotency check — return existing cache row if fresh (not expired),
// otherwise null. Lets the seeding loop skip queries that are already
// cached without burning Olostep credits.
async function cacheLookup(statuteRef) {
  const { data, error } = await supabase
    .from('statute_cache')
    .select('statute_ref, content, sources_json, expires_at, retrieved_at')
    .eq('jurisdiction', jurisdiction)
    .eq('doc_type', docType)
    .eq('statute_ref', statuteRef)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) return null
  return data
}

async function cacheWrite(statuteRef, query, content, sources, answerId) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('statute_cache').upsert(
    {
      jurisdiction,
      doc_type: docType,
      statute_ref: statuteRef,
      query,
      content,
      sources_json: sources,
      olostep_answer_id: answerId,
      expires_at: expiresAt,
      retrieved_at: new Date().toISOString(),
    },
    { onConflict: 'jurisdiction,doc_type,statute_ref' }
  )
  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
}

// ── Main loop ──────────────────────────────────────────────────────────────
const results = []
let skippedThisRun = 0
for (let i = 0; i < bundle.length; i++) {
  const { statuteRef, query } = bundle[i]
  const idx = `[${i + 1}/${bundle.length}]`
  console.log(`\n${idx} ${statuteRef}`)

  // Idempotency: skip if cached row exists and is not expired.
  const existing = await cacheLookup(statuteRef)
  if (existing) {
    const sources = Array.isArray(existing.sources_json) ? existing.sources_json.length : 0
    console.log(`${idx} SKIP (cached) — ${existing.content?.length ?? 0} chars, ${sources} sources, expires ${existing.expires_at?.slice(0, 10)}`)
    results.push({ statuteRef, status: 'skipped_cached', contentLength: existing.content?.length ?? 0, sourceCount: sources })
    skippedThisRun++
    continue
  }

  console.log(`${idx} query: ${query}`)
  const t0 = Date.now()
  const olo = await callOlostep(query)

  if (olo.error) {
    console.log(`${idx} OLOSTEP FAILED: ${olo.error}`)
    results.push({ statuteRef, status: 'olostep_failed', error: olo.error })
  } else {
    const sourceUrls = (olo.sources ?? []).map(s => s.url ?? s).filter(Boolean)
    console.log(`${idx} content: ${olo.content?.length ?? 0} chars, ${sourceUrls.length} sources, ${Date.now() - t0}ms`)
    if (sourceUrls.length) console.log(`${idx} sources: ${sourceUrls.slice(0, 3).join(' | ')}`)

    try {
      await cacheWrite(statuteRef, query, olo.content, olo.sources, olo.answerId)
      console.log(`${idx} ✓ cached`)
      results.push({ statuteRef, status: 'ok', contentLength: olo.content?.length ?? 0, sourceCount: sourceUrls.length })
    } catch (err) {
      console.log(`${idx} CACHE WRITE FAILED: ${err.message}`)
      results.push({ statuteRef, status: 'cache_write_failed', error: err.message })
    }
  }

  // Rate-limit courtesy: 1s between queries (skip after last).
  if (i < bundle.length - 1) await new Promise(r => setTimeout(r, 1000))
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n──────── SUMMARY ────────')
const ok = results.filter(r => r.status === 'ok')
const skipped = results.filter(r => r.status === 'skipped_cached')
const failed = results.filter(r => r.status !== 'ok' && r.status !== 'skipped_cached')
console.log(`Total: ${results.length}`)
console.log(`Newly cached: ${ok.length}`)
console.log(`Already cached (skipped): ${skipped.length}`)
console.log(`Failed: ${failed.length}`)
for (const r of results) {
  if (r.status === 'ok') {
    console.log(`  ✓ ${r.statuteRef} — ${r.contentLength} chars, ${r.sourceCount} sources`)
  } else if (r.status === 'skipped_cached') {
    console.log(`  · ${r.statuteRef} — already cached (${r.contentLength} chars, ${r.sourceCount} sources)`)
  } else {
    console.log(`  ✗ ${r.statuteRef} — ${r.status}: ${r.error}`)
  }
}
console.log(`\nOlostep credits used this run: ${ok.length + failed.length} (${skipped.length} skipped via idempotent cache lookup)`)

process.exit(failed.length === 0 ? 0 : 1)
