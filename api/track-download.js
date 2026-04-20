// api/track-download.js
// Fire-and-forget download telemetry. Writes a counter + recent-events list
// to Upstash so support can verify that a paying / promo-redeeming user
// actually reached the download step. This is specifically motivated by the
// "Rosemary paid but didn't download" style of support ticket — where
// without this endpoint there is no record of whether the download button
// was ever clicked.
//
// Intentionally minimal:
//   - No auth: the endpoint can't unlock anything, it only logs
//   - No PII: we never accept or store email / IP / user-agent
//   - Never blocks the client: always returns 200, even on failure

import { logError } from '../lib/logger.js'

function sanitize(str, max = 80) {
  if (typeof str !== 'string') return ''
  return str.replace(/[^\w\s.\-/]/g, '').slice(0, max)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    // Telemetry shouldn't crash production if Redis is unconfigured in a
    // preview env. Swallow and return ok.
    return res.status(200).json({ ok: true, logged: false })
  }

  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {}
    const docType = sanitize(body.docType, 40) || 'unknown'
    const docName = sanitize(body.docName, 80) || 'unknown'

    // Daily bucket — low-cost counter we can graph in the dashboard later
    const day = new Date().toISOString().slice(0, 10)
    const counterKey = `download:daily:${day}`
    const docKey = `download:doctype:${docType}:${day}`

    // Fire both in parallel. Don't await errors — just swallow.
    await Promise.all([
      fetch(`${url}/incr/${encodeURIComponent(counterKey)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null),
      fetch(`${url}/incr/${encodeURIComponent(docKey)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null),
      // 60-day TTL on daily buckets — keep rolling window without unbounded growth
      fetch(`${url}/expire/${encodeURIComponent(counterKey)}/5184000`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null),
      fetch(`${url}/expire/${encodeURIComponent(docKey)}/5184000`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null),
    ])

    return res.status(200).json({ ok: true, docType, docName })
  } catch (err) {
    logError('/track-download', { message: err?.message || 'unknown error' })
    // Still return 200 — telemetry must never affect UX
    return res.status(200).json({ ok: true, logged: false })
  }
}
