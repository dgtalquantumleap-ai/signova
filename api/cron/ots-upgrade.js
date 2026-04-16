// api/cron/ots-upgrade.js
// Scheduled job: upgrade pending OpenTimestamps commitments into full Bitcoin
// proofs once the calendar's attestation has been confirmed on-chain.
//
// Vercel calls this on a cron schedule (see vercel.json). Each run scans
// a small batch of commitments and upgrades any that are ready. Upgraded
// commitments get their `commitment_base64` replaced with the fuller proof
// and gain an `upgraded_at` timestamp.
//
// Protected: only accepts requests from Vercel's cron runner by checking
// the Authorization: Bearer <CRON_SECRET> header.

import { getRedis } from '../../lib/redis.js'
import { logInfo, logWarn, logError } from '../../lib/logger.js'
import OpenTimestamps from 'javascript-opentimestamps'

const BATCH_SIZE = 20 // upgrade at most N per invocation to stay within function time budget
const CURSOR_KEY = 'signova:ots:upgrade-cursor'

export default async function handler(req, res) {
  // Authenticate: Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET
  const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '').trim()
  if (!expected || got !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let redis
  try { redis = getRedis() } catch {
    return res.status(503).json({ ok: false, error: 'Redis unavailable' })
  }

  const stats = { scanned: 0, upgraded: 0, still_pending: 0, errors: 0 }
  let cursor = (await redis.get(CURSOR_KEY)) || '0'

  try {
    // Scan the OTS keyspace in chunks.
    const scan = await redis.scan(cursor, { match: 'signova:ots:*', count: BATCH_SIZE })
    const nextCursor = Array.isArray(scan) ? scan[0] : scan.cursor
    const keys = Array.isArray(scan) ? scan[1] : scan.keys

    for (const key of keys || []) {
      stats.scanned++
      try {
        const raw = await redis.get(key)
        if (!raw) continue
        const record = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (record.upgraded_at) continue // already fully anchored

        const oldProof = Buffer.from(record.commitment_base64, 'base64')
        const detached = OpenTimestamps.DetachedTimestampFile.deserialize(oldProof)
        await OpenTimestamps.upgrade(detached)

        // If upgrade succeeded and attestations include a Bitcoin header, persist it.
        const newBuf = Buffer.alloc(detached.serializeToBytes().length)
        detached.serializeToBytes().forEach((b, i) => { newBuf[i] = b })
        const newBase64 = newBuf.toString('base64')

        if (newBase64 !== record.commitment_base64) {
          record.commitment_base64 = newBase64
          record.upgraded_at = new Date().toISOString()
          await redis.set(key, JSON.stringify(record))
          stats.upgraded++
        } else {
          stats.still_pending++
        }
      } catch (err) {
        stats.errors++
        logWarn('/cron/ots-upgrade', { key, message: err.message })
      }
    }

    await redis.set(CURSOR_KEY, String(nextCursor || '0'))
    logInfo('/cron/ots-upgrade', stats)
    res.status(200).json({ ok: true, cursor: nextCursor, ...stats })
  } catch (err) {
    logError('/cron/ots-upgrade', { message: err.message })
    res.status(500).json({ ok: false, error: err.message, ...stats })
  }
}
