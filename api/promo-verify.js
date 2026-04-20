// api/promo-verify.js
// Verifies a promo token issued by /api/promo-redeem
// Token format (base64url): CODE::timestamp::sig

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token } = req.body
  if (!token) return res.status(400).json({ valid: false, error: 'No token provided' })

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const parts = decoded.split(':')
    if (parts.length < 3) throw new Error('Malformed token')

    const sig = parts.pop()
    const payload = parts.join(':')

    // Token format from promo-redeem: "CODE::timestamp:sig"
    // After popping sig, parts = ["CODE", "", "timestamp"]
    // Timestamp is always the last element; code is always the first
    const code = parts[0]
    const timestampStr = parts[parts.length - 1]

    const timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) throw new Error('Invalid timestamp')

    // Token lifetime: 24 hours.
    // Previous value was 2h, which broke a real UX: user applies code,
    // gets interrupted (kids, work, commute), returns next morning, and
    // the regen / rollback endpoints reject the token. 24h is long enough
    // to span an interrupted session without being abused — the token is
    // bound to a specific code, the rollback is single-use per token, and
    // /api/generate idempotently issues the same premium doc for the same
    // prompt, so extended lifetime doesn't widen any attack surface.
    const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000
    const age = Date.now() - timestamp
    if (age > TOKEN_LIFETIME_MS) {
      return res.status(400).json({ valid: false, error: 'Token expired. Please apply your code again.' })
    }

    const secret = process.env.PROMO_SECRET
    if (!secret) return res.status(500).json({ valid: false, error: 'Server misconfigured.' })
    const { createHmac } = await import('crypto')
    const expectedSig = createHmac('sha256', secret).update(payload).digest('hex')

    if (sig !== expectedSig) {
      return res.status(400).json({ valid: false, error: 'Invalid token.' })
    }

    return res.status(200).json({ valid: true, code })
  } catch (err) {
    console.error('promo-verify error:', err)
    return res.status(400).json({ valid: false, error: 'Could not verify token.' })
  }
}
