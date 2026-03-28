#!/usr/bin/env node
// scripts/provision-key.js
// Provision a new API key against the live API.
//
// Usage:
//   node scripts/provision-key.js --owner you@example.com --tier starter
//   node scripts/provision-key.js --owner dev@test.com --tier free --env test
//
// Requires EBENOVA_ADMIN_SECRET in your environment:
//   $env:EBENOVA_ADMIN_SECRET="your_secret"; node scripts/provision-key.js ...

const API_BASE = process.env.EBENOVA_API_BASE || 'https://api.ebenova.dev'
const ADMIN_SECRET = process.env.EBENOVA_ADMIN_SECRET

if (!ADMIN_SECRET) {
  console.error('\n❌  EBENOVA_ADMIN_SECRET is not set.')
  console.error('    Run: $env:EBENOVA_ADMIN_SECRET="your_secret"; node scripts/provision-key.js ...\n')
  process.exit(1)
}

// Parse CLI args  --key value
const args = process.argv.slice(2)
const get = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const owner = get('--owner')
const tier = get('--tier') || 'free'
const label = get('--label') || ''
const env = get('--env') || 'live'
const monthlyLimit = get('--limit') ? parseInt(get('--limit')) : undefined

if (!owner) {
  console.error('\n❌  --owner (email) is required.')
  console.error('    Usage: node scripts/provision-key.js --owner you@email.com --tier starter\n')
  process.exit(1)
}

const validTiers = ['free', 'starter', 'growth', 'scale', 'enterprise']
if (!validTiers.includes(tier)) {
  console.error(`\n❌  Invalid tier "${tier}". Must be one of: ${validTiers.join(', ')}\n`)
  process.exit(1)
}

console.log(`\n🔑  Provisioning API key...`)
console.log(`    Owner : ${owner}`)
console.log(`    Tier  : ${tier}`)
console.log(`    Env   : ${env}`)
if (label) console.log(`    Label : ${label}`)
if (monthlyLimit) console.log(`    Limit : ${monthlyLimit} docs/month (override)`)
console.log()

const body = { owner, tier, env, label }
if (monthlyLimit) body.monthlyLimit = monthlyLimit

fetch(`${API_BASE}/v1/keys/create`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_SECRET}`,
  },
  body: JSON.stringify(body),
})
  .then(r => r.json())
  .then(data => {
    if (!data.success) {
      console.error('❌  Failed:', data.error?.message || JSON.stringify(data))
      process.exit(1)
    }
    console.log('✅  API key created successfully!\n')
    console.log('┌─────────────────────────────────────────────────────────')
    console.log(`│  API Key    : ${data.api_key}`)
    console.log(`│  Owner      : ${data.owner}`)
    console.log(`│  Tier       : ${data.tier}`)
    console.log(`│  Monthly    : ${data.monthly_limit} documents`)
    if (data.label) console.log(`│  Label      : ${data.label}`)
    console.log(`│  Created    : ${data.created_at}`)
    console.log('└─────────────────────────────────────────────────────────')
    console.log('\n⚠️   Store this key now — it cannot be retrieved again.\n')
  })
  .catch(err => {
    console.error('❌  Request failed:', err.message)
    process.exit(1)
  })
