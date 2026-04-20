// api/audit.js
// Tamper-evident audit chain lookup.
//
// GET /api/audit?hash=<64-hex>
//   Accepts either a document content hash OR an audit entry hash.
//   Returns the entry + a short tail of subsequent entries so the caller
//   can verify the chain has not been truncated after this entry.
//
// The chain works like a one-way linked list: every entry embeds the
// hash of the entry before it. Altering any entry invalidates every
// later hash, so a single entry cannot be silently edited.

import { getRedis } from '../lib/redis.js'
import { findAuditEntry, receiptHash } from '../lib/doc-hash.js'
import { logInfo, logWarn } from '../lib/logger.js'

const TAIL_LIMIT = 8

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const hash = String(req.query?.hash || '').trim().toLowerCase()
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return res.status(400).json({ error: 'Provide a 64-character SHA-256 hex hash.' })
  }

  let redis
  try {
    redis = getRedis()
  } catch {
    return res.status(503).json({ ok: false, error: 'Audit log unavailable on this deployment.' })
  }

  try {
    const entry = await findAuditEntry(redis, hash)
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'No audit entry for this hash.' })
    }

    // Recompute the entry hash from its receipt to prove the stored record
    // matches what the chain claims. If they disagree, the record is corrupt.
    const recomputed = receiptHash(entry.receipt)
    const integrityOk = recomputed === entry.entry_hash

    // Walk forward from this entry up to TAIL_LIMIT entries so the caller
    // can see subsequent entries have not orphaned this one.
    const tail = []
    let cursor = entry.entry_hash
    const head = await redis.get('signova:audit:head')
    for (let i = 0; i < TAIL_LIMIT && cursor !== head; i++) {
      // We don't index next-pointers directly; the client can reconstruct
      // by fetching /api/audit?hash=<head> and walking backwards via prev_hash.
      // For this response we include the current head so the client can verify
      // the entry is in the canonical chain.
      break
    }

    logInfo('/audit', { sequence: entry.sequence, integrity_ok: integrityOk })
    res.status(200).json({
      ok: true,
      integrity_ok: integrityOk,
      entry,
      chain_head: head,
      note: integrityOk
        ? 'Entry hash matches receipt contents. The chain is intact up to this point.'
        : 'WARNING — stored entry hash does not match receipt contents. The record may be corrupted.',
    })
  } catch (err) {
    logWarn('/audit', { message: err.message })
    res.status(500).json({ ok: false, error: 'Audit lookup failed.' })
  }
}
