import { randomBytes } from 'crypto'

const REDIS_URL = 'https://faithful-satyr-80384.upstash.io'
const REDIS_TOKEN = 'gQAAAAAAAToAAAIncDFkYzBhNzRlMjhiMzU0YmQ2OGRhMTYyODgyZmEzZjJkYXAxODAzODQ'

const key = 'sk_live_' + randomBytes(24).toString('hex')
const owner = 'smithery-scan@ebenova.dev'
const tier = 'starter'
const now = new Date().toISOString()
const resetDate = new Date()
resetDate.setMonth(resetDate.getMonth() + 1)
resetDate.setDate(1)

const keyData = {
  key,
  owner,
  tier,
  label: 'Smithery scan key',
  monthly_limit: 100,
  created_at: now,
  usage: { [now.slice(0,7)]: 0 },
  resets_at: resetDate.toISOString(),
}

const redisKey = `apikey:${key}`
const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(redisKey)}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${REDIS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(JSON.stringify(keyData)),
})

const result = await res.json()
if (result.result === 'OK') {
  console.log('\n✅ API key created!\n')
  console.log('Key:', key)
  console.log('\nPaste this into the Smithery scan credentials field.\n')
} else {
  console.error('❌ Failed:', JSON.stringify(result))
}
