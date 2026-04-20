#!/usr/bin/env node
// scripts/smoke.mjs
//
// Post-deploy smoke test. Hits every revenue-critical endpoint end-to-end
// against a real deployment and asserts the response shape we'd lose money
// on if it broke.
//
// Why this exists: the Apr 2026 outage where /v1/billing/checkout returned
// FUNCTION_INVOCATION_FAILED for hours because of a single missing `..` in
// an import. Static audits + npm test + npm run build all passed — only an
// actual HTTP call against the deployed function would have caught it.
//
// Usage:
//   node scripts/smoke.mjs                            # against prod (default)
//   BASE_URL=https://staging.example.com npm run smoke
//   BASE_URL=http://localhost:3000 npm run smoke
//
// Exits 0 on full pass, 1 on any failure. Prints a one-line summary per check
// and a failure section at the end.

const BASE_URL  = (process.env.BASE_URL || 'https://www.ebenova.dev').replace(/\/$/, '')
const API_HOST  = process.env.API_HOST  || 'https://api.ebenova.dev'
const TIMEOUT   = Number(process.env.SMOKE_TIMEOUT_MS || 15000)

// ─── Coloring (no deps) ──────────────────────────────────────────────────
const isTTY = process.stdout.isTTY
const c = {
  red:    s => isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  green:  s => isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  yellow: s => isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  dim:    s => isTTY ? `\x1b[2m${s}\x1b[0m`  : s,
}

const results = [] // { name, ok, ms, detail, error? }

async function check(name, fn) {
  const t0 = Date.now()
  try {
    const detail = await Promise.race([
      fn(),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${TIMEOUT}ms`)), TIMEOUT)),
    ])
    const ms = Date.now() - t0
    results.push({ name, ok: true, ms, detail })
    console.log(`  ${c.green('✓')} ${name} ${c.dim(`(${ms}ms)`)} ${detail ? c.dim('— ' + detail) : ''}`)
  } catch (err) {
    const ms = Date.now() - t0
    results.push({ name, ok: false, ms, error: err.message })
    console.log(`  ${c.red('✗')} ${name} ${c.dim(`(${ms}ms)`)} — ${c.red(err.message)}`)
  }
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  let body
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    body = await res.json().catch(() => ({}))
  } else {
    body = await res.text()
  }
  return { status: res.status, headers: res.headers, body }
}

// ─── Checks ──────────────────────────────────────────────────────────────

async function checkHealth() {
  const { status, body } = await fetchJson(`${API_HOST}/health`)
  if (status !== 200 && status !== 503) {
    throw new Error(`expected 200|503, got ${status}`)
  }
  if (typeof body !== 'object' || !body.status) {
    throw new Error(`bad shape: ${JSON.stringify(body).slice(0, 120)}`)
  }
  return `status=${body.status}`
}

async function checkCheckoutTier(tier) {
  const { status, body } = await fetchJson(`${API_HOST}/v1/billing/checkout`, {
    method: 'POST',
    body: JSON.stringify({ tier, email: 'smoke@example.com' }),
  })
  if (status !== 200) {
    const code = body?.error?.code || `HTTP_${status}`
    const msg  = body?.error?.message ? ` (${body.error.message})` : ''
    throw new Error(`${code}${msg}`)
  }
  if (!body?.success || !body?.checkout_url?.startsWith('https://')) {
    throw new Error(`no checkout_url: ${JSON.stringify(body).slice(0, 120)}`)
  }
  return `checkout_url ✓`
}

// Auth-required endpoints: probe for 401 to prove the route is alive without
// burning real quota. A FUNCTION_INVOCATION_FAILED, 404 HTML, or 500 here
// means the function itself is broken (the bug we're trying to catch).
async function checkAuthGate(path, method = 'POST') {
  const init = { method }
  if (method === 'POST') init.body = JSON.stringify({})
  const { status, body } = await fetchJson(`${API_HOST}${path}`, init)
  if (status === 401 || status === 403) {
    return `auth-gated (${status})`
  }
  // Some endpoints return 400 for missing required fields BEFORE auth — also fine,
  // means the function is alive and routing works.
  if (status === 400 && typeof body === 'object' && body.error?.code) {
    return `validates input (400 ${body.error.code})`
  }
  throw new Error(`expected 401/403/400, got ${status} — ${JSON.stringify(body).slice(0, 120)}`)
}

async function checkLandingPageReachable(path) {
  const res = await fetch(`${BASE_URL}${path}`, { redirect: 'follow' })
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  if (!html.includes('<!doctype html>') && !html.includes('<!DOCTYPE html>')) {
    throw new Error(`not HTML (got ${html.slice(0, 60)}...)`)
  }
  return `${(html.length / 1024).toFixed(1)}kb`
}

async function checkCspAllowsApiHost() {
  const res = await fetch(`${BASE_URL}/insights`, { redirect: 'follow' })
  const csp = res.headers.get('content-security-policy') || ''
  if (!csp) throw new Error('no Content-Security-Policy header')
  // The Apr 2026 outage was CSP blocking api.ebenova.dev from www.ebenova.dev.
  // Assert the connect-src hosts that page actually needs.
  const required = ['api.ebenova.dev', 'ebenova.dev']
  const missing = required.filter(h => !csp.includes(h))
  if (missing.length) throw new Error(`connect-src missing: ${missing.join(', ')}`)
  return `connect-src ✓`
}

async function checkInsightsSubscribe() {
  // Idempotent: same email won't double-add. Uses a smoke-test marker email.
  const { status, body } = await fetchJson(`${API_HOST}/v1/insights/subscribe`, {
    method: 'POST',
    body: JSON.stringify({
      email: 'smoke+ci@ebenova.net',
      plan: 'starter',
    }),
  })
  if (status !== 200) {
    throw new Error(`HTTP ${status} — ${JSON.stringify(body).slice(0, 120)}`)
  }
  if (!body?.success) {
    throw new Error(`success:false — ${JSON.stringify(body).slice(0, 120)}`)
  }
  return body.already_on_waitlist ? 'already-on-waitlist (idempotent ✓)' : 'added to waitlist'
}

// ─── Main ────────────────────────────────────────────────────────────────

console.log(`\n${c.dim('Smoke testing')} ${BASE_URL} ${c.dim('+')} ${API_HOST}\n`)

console.log(c.dim('Infrastructure'))
await check('GET /health',                            checkHealth)
await check('GET / (landing reachable)',              () => checkLandingPageReachable('/'))
await check('GET /insights (insights page reachable)', () => checkLandingPageReachable('/insights'))
await check('CSP allows API host',                    checkCspAllowsApiHost)

console.log(`\n${c.dim('Billing — every checkout tier (the money path)')}`)
for (const tier of ['starter', 'growth', 'scale', 'insights_starter', 'insights_growth', 'insights_scale']) {
  await check(`POST /v1/billing/checkout (${tier})`, () => checkCheckoutTier(tier))
}

console.log(`\n${c.dim('Authenticated endpoints — alive-check (no real auth used)')}`)
await check('POST /v1/vigil/authorize',  () => checkAuthGate('/v1/vigil/authorize'))
await check('GET  /v1/vigil/score',      () => checkAuthGate('/v1/vigil/score',  'GET'))
await check('POST /v1/vigil/report',     () => checkAuthGate('/v1/vigil/report'))
await check('POST /v1/vigil/card',       () => checkAuthGate('/v1/vigil/card'))
await check('POST /v1/vigil/gps',        () => checkAuthGate('/v1/vigil/gps'))
await check('POST /v1/insights/poll',    () => checkAuthGate('/v1/insights/poll'))

console.log(`\n${c.dim('Public POSTs')}`)
await check('POST /v1/insights/subscribe (waitlist)', checkInsightsSubscribe)

// ─── Summary ─────────────────────────────────────────────────────────────

const failed = results.filter(r => !r.ok)
const passed = results.length - failed.length
const totalMs = results.reduce((a, r) => a + r.ms, 0)

console.log(`\n${c.dim('─'.repeat(60))}`)
if (failed.length === 0) {
  console.log(`${c.green('✓ all ' + passed + ' checks passed')} ${c.dim(`in ${totalMs}ms`)}`)
  process.exit(0)
} else {
  console.log(`${c.red('✗ ' + failed.length + ' failed')}, ${c.green(passed + ' passed')} ${c.dim(`in ${totalMs}ms`)}`)
  console.log(`\n${c.red('Failures:')}`)
  for (const f of failed) {
    console.log(`  ${c.red('✗')} ${f.name}`)
    console.log(`      ${c.dim(f.error)}`)
  }
  process.exit(1)
}
