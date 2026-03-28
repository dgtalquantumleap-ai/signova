// api/create-bypass.js
// Generates a single-use bypass code for manual payment verification
// Used by /admin page when a customer pays via bank transfer
// Protected by BYPASS_ADMIN_SECRET env var

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret } = req.body
  const adminSecret = process.env.BYPASS_ADMIN_SECRET

  // If BYPASS_ADMIN_SECRET not configured, block all access
  if (!adminSecret) {
    console.error('BYPASS_ADMIN_SECRET not set — /api/create-bypass is disabled')
    return res.status(503).json({ error: 'Admin feature not configured.' })
  }

  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Invalid admin password.' })
  }

  // Generate a short, readable code: 3 random uppercase words
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous I,O,0,1
  const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  // Log for audit trail
  console.log(`[admin] Bypass code generated: ${code} at ${new Date().toISOString()}`)

  return res.status(200).json({ code })
}
