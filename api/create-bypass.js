// api/create-bypass.js
// Generates a cryptographically signed bypass code — no Redis required.
// The code encodes today's date so it expires at midnight UTC automatically.
// Verification is done in redeem-bypass.js by recomputing the HMAC.

import { createHmac } from 'crypto'

// Encode a number as a compact uppercase alphanumeric string
function encodeBase32(num) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 chars, no 0/O/1/I
  let result = ''
  let n = Math.abs(num)
  for (let i = 0; i < 5; i++) {
    result = chars[n % 32] + result
    n = Math.floor(n / 32)
  }
  return result
}

function generateCode(secret) {
  // Day token — changes every UTC day so codes expire at midnight
  const dayToken = Math.floor(Date.now() / 86400000)
  // HMAC of the day token with the admin secret — unique and unguessable
  const hmac = createHmac('sha256', secret)
    .update(String(dayToken))
    .digest()
  // Take first 4 bytes as a number and encode as 5 base-32 chars
  const num = hmac.readUInt32BE(0)
  return 'SIG-' + encodeBase32(num)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret } = req.body
  const adminSecret = process.env.BYPASS_ADMIN_SECRET

  if (!adminSecret) {
    console.error('[Bypass] BYPASS_ADMIN_SECRET not set in environment')
    return res.status(500).json({ error: 'Server misconfigured — contact support.' })
  }

  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Incorrect password.' })
  }

  const code = generateCode(adminSecret)
  console.log(`[Bypass] Generated code: ${code}`)

  return res.status(200).json({
    code,
    expiresAt: 'Midnight UTC tonight',
    instructions: `Send this code to your customer: ${code}`,
  })
}
