// api/timestamp.js
// OpenTimestamps anchoring — submit a document hash to a public OTS calendar
// and retrieve the timestamp proof. Calendar servers accept an SHA-256 digest
// and issue a commitment that is periodically aggregated and anchored to the
// Bitcoin blockchain. Bitcoin confirmation typically completes within ~1 hour.
//
// GET /api/timestamp?hash=<64-hex>
//    Returns the stored OTS commitment (if any) + status.
//
// POST /api/timestamp  { hash }
//    Submits the hash to the calendar if not already submitted. Idempotent.
//
// We do NOT bundle the full javascript-opentimestamps library — the calendar
// protocol is a thin HTTP API. The commitment blob can be upgraded later
// client-side with the official OTS tooling for full Bitcoin proof.
//
// Calendar endpoint: https://a.pool.opentimestamps.org

import { getRedis } from '../lib/redis.js'
import { parseBody } from '../lib/parse-body.js'
import { logInfo, logWarn } from '../lib/logger.js'

const CALENDAR_URL = 'https://a.pool.opentimestamps.org'

function redisKey(hash) { return `signova:ots:${hash.toLowerCase()}` }

async function submitToCalendar(hashHex) {
  const digest = Buffer.from(hashHex, 'hex')
  const r = await fetch(`${CALENDAR_URL}/digest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: digest,
  })
  if (!r.ok) throw new Error(`Calendar responded ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  return buf.toString('base64')
}

export default async function handler(req, res) {
  const hash = String(req.method === 'GET' ? req.query?.hash : '').trim().toLowerCase()

  if (req.method === 'GET') {
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'Provide a 64-character SHA-256 hex hash.' })
    }
    try {
      const redis = getRedis()
      const raw = await redis.get(redisKey(hash))
      if (!raw) {
        return res.status(200).json({
          ok: true,
          hash,
          anchored: false,
          note: 'No OpenTimestamps commitment on file. POST to /api/timestamp to create one.',
        })
      }
      const record = typeof raw === 'string' ? JSON.parse(raw) : raw
      return res.status(200).json({
        ok: true,
        hash,
        anchored: true,
        submitted_at: record.submitted_at,
        calendar: record.calendar,
        commitment_base64: record.commitment_base64,
        note: 'Commitment stored. Feed `commitment_base64` into the OpenTimestamps CLI (`ots upgrade`) to obtain the final Bitcoin proof once confirmed.',
      })
    } catch (err) {
      logWarn('/timestamp:GET', { message: err.message })
      return res.status(500).json({ ok: false, error: 'Timestamp lookup failed.' })
    }
  }

  if (req.method === 'POST') {
    const body = await parseBody(req)
    const postHash = String(body?.hash || '').trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(postHash)) {
      return res.status(400).json({ error: 'Provide a 64-character SHA-256 hex hash.' })
    }
    let redis
    try { redis = getRedis() } catch {
      return res.status(503).json({ ok: false, error: 'Timestamp store unavailable.' })
    }
    try {
      const existing = await redis.get(redisKey(postHash))
      if (existing) {
        const record = typeof existing === 'string' ? JSON.parse(existing) : existing
        return res.status(200).json({ ok: true, idempotent: true, ...record })
      }
      const commitment_base64 = await submitToCalendar(postHash)
      const record = {
        hash: postHash,
        calendar: CALENDAR_URL,
        submitted_at: new Date().toISOString(),
        commitment_base64,
      }
      // Keep commitment indefinitely — it is required to upgrade to a full
      // Bitcoin proof later. Small payload (<1kB).
      await redis.set(redisKey(postHash), JSON.stringify(record))
      logInfo('/timestamp:POST', { hash: postHash.slice(0, 16) })
      return res.status(200).json({ ok: true, idempotent: false, ...record })
    } catch (err) {
      logWarn('/timestamp:POST', { message: err.message })
      return res.status(502).json({ ok: false, error: `Calendar submission failed: ${err.message}` })
    }
  }

  res.setHeader('Allow', 'GET, POST')
  return res.status(405).json({ error: 'Method not allowed' })
}
