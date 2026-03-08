// api/create-bypass.js
// Password-protected admin endpoint — you call this after a WhatsApp payment is confirmed.
// Returns a single-use bypass code that the customer can enter on the preview page.
//
// Usage:
//   POST https://getsignova.com/api/create-bypass
//   Body: { "secret": "YOUR_BYPASS_ADMIN_SECRET" }
//   Response: { "code": "SIG-7X9K2" }
//
// The code is stored in Upstash Redis with a 24-hour TTL and is deleted after one use.

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusion
  let code = 'SIG-'
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret } = req.body
  const adminSecret = process.env.BYPASS_ADMIN_SECRET

  if (!adminSecret) {
    console.error('BYPASS_ADMIN_SECRET not set in environment')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Unauthorised' })
  }

  // Store in Upstash Redis — same instance used for rate limiting
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: 'Redis not configured' })
  }

  try {
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url: redisUrl, token: redisToken })

    // Generate a unique code (retry if collision, extremely unlikely)
    let code
    let attempts = 0
    do {
      code = generateCode()
      attempts++
      if (attempts > 10) throw new Error('Could not generate unique code')
    } while (await redis.exists(`bypass:${code}`))

    // Store with 24-hour TTL
    // Value 'unused' — will be set to 'used' on redemption
    await redis.set(`bypass:${code}`, 'unused', { ex: 86400 })

    console.log(`[Bypass] Created code: ${code}`)

    return res.status(200).json({
      code,
      expiresIn: '24 hours',
      instructions: `WhatsApp this code to your customer: ${code}. They enter it on the preview page to unlock their download.`,
    })
  } catch (err) {
    console.error('create-bypass error:', err)
    return res.status(500).json({ error: 'Failed to create bypass code' })
  }
}
