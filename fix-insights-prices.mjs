// fix-insights-prices.mjs
// Sets Stripe Insights price IDs via Vercel REST API directly.
// No shell pipe = no \r\n corruption.
//
// Run: node fix-insights-prices.mjs
// Reads token from local Vercel auth file automatically.

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const PROJECT_ID = 'prj_UX5S3MQIEpTyg9Qg3pyBZVRnWJyW'
const TEAM_ID    = 'team_yCsDhwgKGCRS5YBx9K3bVHyK'

const PRICES = [
  { key: 'STRIPE_PRICE_INSIGHTS_STARTER', value: 'price_1THvNrJlikfX3kyVZqMKLymi' },
  { key: 'STRIPE_PRICE_INSIGHTS_GROWTH',  value: 'price_1THvODJlikfX3kyVNhblRBnu' },
  { key: 'STRIPE_PRICE_INSIGHTS_SCALE',   value: 'price_1THvODJlikfX3kyVF6W2fXCf' },
]

// Find Vercel auth token — checks env var first, then common file locations
function getToken() {
  // Accept token via env var (most reliable on Windows)
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN

  const candidates = [
    join(homedir(), 'AppData', 'Roaming', 'vercel', 'auth.json'),
    join(homedir(), 'AppData', 'Local', 'vercel', 'auth.json'),
    join(homedir(), '.vercel', 'auth.json'),
    join(homedir(), '.config', 'vercel', 'auth.json'),
    // npm global path where vercel binary lives
    join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'vercel', 'node_modules', '.cache', 'auth.json'),
  ]
  for (const p of candidates) {
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'))
      if (j.token) return j.token
    } catch {}
  }
  throw new Error('Pass token via: set VERCEL_TOKEN=your_token && node fix-insights-prices.mjs\nGet token from: vercel.com/account/tokens')
}

async function listEnvIds(token) {
  const r = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const d = await r.json()
  return d.envs || []
}

async function deleteEnv(token, envId) {
  await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/env/${envId}?teamId=${TEAM_ID}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
}

async function createEnv(token, key, value) {
  const r = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, type: 'plain', target: ['production'] }),
    }
  )
  return r.json()
}

async function main() {
  const token = getToken()
  console.log(`Token: ${token.slice(0, 8)}...`)

  // Fetch all current env vars
  console.log('\nFetching current env vars...')
  const envs = await listEnvIds(token)
  const insightKeys = new Set(PRICES.map(p => p.key))
  const toDelete = envs.filter(e => insightKeys.has(e.key))

  // Delete existing (possibly corrupted) values
  for (const e of toDelete) {
    console.log(`Deleting ${e.key} (id: ${e.id}, value: "${e.value}")`)
    await deleteEnv(token, e.id)
  }

  // Create clean values
  console.log('\nSetting clean values...')
  for (const p of PRICES) {
    // Verify no whitespace in value
    if (p.value !== p.value.trim()) throw new Error(`Value has whitespace: "${p.value}"`)
    const result = await createEnv(token, p.key, p.value)
    if (result.error) {
      console.error(`  ✗ ${p.key}: ${result.error.message}`)
    } else {
      console.log(`  ✓ ${p.key} = ${p.value}`)
    }
  }

  // Verify
  console.log('\nVerifying...')
  const final = await listEnvIds(token)
  for (const p of PRICES) {
    const found = final.find(e => e.key === p.key)
    if (!found) { console.error(`  ✗ ${p.key} not found`); continue }
    const clean = found.value && !found.value.includes('\r') && !found.value.includes('\n')
    console.log(`  ${clean ? '✓' : '✗ STILL CORRUPTED'} ${p.key} = "${found.value}"`)
  }

  console.log('\nDone. Run: vercel --prod --yes')
}

main().catch(e => { console.error(e.message); process.exit(1) })
