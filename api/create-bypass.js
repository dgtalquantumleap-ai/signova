// api/create-bypass.js
// Generates a single-use bypass code for manual payment verification
// Used by /admin page when a customer pays via bank transfer
// Protected by BYPASS_ADMIN_SECRET env var
// Codes are stored in Redis with 24h TTL and marked used on redemption

import { parseBody } from '../lib/parse-body.js'
import { logError, logInfo } from '../lib/logger.js'

const BYPASS_TTL_SECONDS = 86400 // 24 hours

async function storeBypassCode(code) {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return // graceful degradation in local dev
  try {
    await fetch(`${url}/set/bypass:${code}/1/ex/${BYPASS_TTL_SECONDS}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (err) {
    logError('/create-bypass', { message: 'Failed to store bypass code in Redis', error: err.message })
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body = await parseBody(req)
  const { secret } = body
  const adminSecret = process.env.BYPASS_ADMIN_SECRET

  if (!adminSecret) {
    logError('/create-bypass', { message: 'BYPASS_ADMIN_SECRET not set — endpoint disabled' })
    return res.status(503).json({ error: 'Admin feature not configured.' })
  }

  if (!secret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Invalid admin password.' })
  }

  // Probe mode — just verify auth without generating a code
  if (body?.probe) {
    return res.status(200).json({ ok: true })
  }

  // Generate a short, readable 8-character code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous I,O,0,1
  const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')

  // Store in Redis with 24h TTL for single-use enforcement
  await storeBypassCode(code)

  logInfo('/create-bypass', { message: `Bypass code generated`, expiresIn: '24h' })

  return res.status(200).json({ code, expiresIn: '24h' })
}
