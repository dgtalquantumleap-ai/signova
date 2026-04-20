// api/admin/index-doc.js
// Retroactively add a document to the Signova audit chain.
//
// Context: past generated documents (before the provenance system went live)
// have no stored hash. If a user still holds the doc, they can submit the
// text here to create an authoritative audit record retroactively. The chain
// records both the original receipt and a flag that this entry was indexed
// after the fact.
//
// POST /api/admin/index-doc
//   headers: Authorization: Bearer <ADMIN_SECRET>
//   body:    { text: "<full document text>", doc_type?: "...", note?: "..." }
//
// Returns the new audit entry. Idempotent: if the hash already has an entry,
// that entry is returned unchanged.

import { parseBody } from '../../lib/parse-body.js'
import { logInfo, logWarn } from '../../lib/logger.js'
import { getRedis } from '../../lib/redis.js'
import {
  buildReceipt,
  appendToAuditLog,
  findAuditEntry,
  hashDocument,
} from '../../lib/doc-hash.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Authenticate against admin secret. This endpoint mutates the audit chain
  // so it must not be public.
  const expected = process.env.ADMIN_SECRET
  const got = (req.headers['authorization'] || '').replace(/^Bearer\s+/, '').trim()
  if (!expected || got !== expected) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const body = await parseBody(req)
  const text = typeof body?.text === 'string' ? body.text : ''
  const docType = typeof body?.doc_type === 'string' ? body.doc_type.slice(0, 80) : null
  const note = typeof body?.note === 'string' ? body.note.slice(0, 280) : null

  if (!text || text.length < 32) {
    return res.status(400).json({ error: 'Provide a `text` field containing the document.' })
  }
  if (text.length > 200_000) {
    return res.status(413).json({ error: 'Document too large. Maximum 200,000 characters.' })
  }

  let redis
  try { redis = getRedis() } catch {
    return res.status(503).json({ ok: false, error: 'Redis unavailable' })
  }

  const docHash = hashDocument(text)
  const existing = await findAuditEntry(redis, docHash)
  if (existing) {
    logInfo('/admin/index-doc', { doc_hash: docHash.slice(0, 16), status: 'already_indexed' })
    return res.status(200).json({ ok: true, idempotent: true, entry: existing })
  }

  const receipt = buildReceipt(text, {
    doc_tier: 'retroactive',
    ...(docType ? { doc_type: docType } : {}),
    ...(note ? { indexed_note: note } : {}),
    indexed_retroactively: true,
  })

  try {
    const entry = await appendToAuditLog(redis, receipt)
    logInfo('/admin/index-doc', { doc_hash: docHash.slice(0, 16), sequence: entry?.sequence })
    res.status(200).json({ ok: true, idempotent: false, receipt, entry })
  } catch (err) {
    logWarn('/admin/index-doc', { message: err.message })
    res.status(500).json({ ok: false, error: err.message })
  }
}
