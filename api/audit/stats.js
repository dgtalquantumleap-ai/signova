// api/audit/stats.js
// Public read-only snapshot of the Signova audit chain state.
//
// GET /api/audit/stats
//   → { ok, sequence, head_hash, latest_stored_at, algorithm }
//
// Safe to expose: reveals only counts and the head hash (which is already
// embedded in every subsequent receipt). No document content, no user data.

import { getRedis } from '../../lib/redis.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let redis
  try { redis = getRedis() } catch {
    return res.status(503).json({ ok: false, error: 'Audit store unavailable' })
  }

  try {
    const [sequenceRaw, headHash] = await Promise.all([
      redis.get('signova:audit:seq'),
      redis.get('signova:audit:head'),
    ])
    const sequence = Number(sequenceRaw || 0)

    let latestStoredAt = null
    if (headHash) {
      const raw = await redis.get(`signova:audit:entry:${headHash}`)
      if (raw) {
        const entry = typeof raw === 'string' ? JSON.parse(raw) : raw
        latestStoredAt = entry?.stored_at || null
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=30')
    res.status(200).json({
      ok: true,
      sequence,
      head_hash: headHash || null,
      latest_stored_at: latestStoredAt,
      algorithm: 'SHA-256 + Ed25519 receipts, hash-linked chain',
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
}
