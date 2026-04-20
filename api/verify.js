// api/verify.js
// Document provenance verification.
//
// GET  /api/verify?hash=<sha256>          → returns { hash, fingerprint, verify_url }
// POST /api/verify  { text }              → hashes the text, checks embedded provenance,
//                                           reports whether the embedded hash matches
//                                           the recomputed body hash.
//
// No state is stored. Verification is a pure function of the document content
// plus (for POST) the provenance block embedded inside it.

import { parseBody } from '../lib/parse-body.js'
import { logInfo } from '../lib/logger.js'
import {
  hashDocument,
  shortFingerprint,
  verifyEmbeddedProvenance,
  findAuditEntry,
  verifyReceiptSignature,
} from '../lib/doc-hash.js'
import { getRedis } from '../lib/redis.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const hash = String(req.query?.hash || '').trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ error: 'Provide a 64-character SHA-256 hex hash.' })
    }
    return res.status(200).json({
      ok: true,
      hash,
      fingerprint: shortFingerprint(hash),
      algorithm: 'SHA-256',
      verify_url: `https://www.getsignova.com/trust?hash=${hash}`,
      note: 'Hash format is valid. To verify a document matches this hash, POST the text to /api/verify.',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = await parseBody(req)
  const text = typeof body?.text === 'string' ? body.text : ''
  if (!text || text.length < 32) {
    return res.status(400).json({ error: 'Provide a `text` field containing the document.' })
  }
  if (text.length > 200_000) {
    return res.status(413).json({ error: 'Document too large. Maximum 200,000 characters.' })
  }

  const fullHash = hashDocument(text)
  const embedded = verifyEmbeddedProvenance(text)

  const payload = {
    ok: true,
    full_document_hash: fullHash,
    full_document_fingerprint: shortFingerprint(fullHash),
    algorithm: 'SHA-256',
  }

  if (embedded.hasProvenance) {
    payload.embedded = {
      claimed_hash: embedded.claimedHash,
      recomputed_body_hash: embedded.bodyHash,
      matches: embedded.match,
      fingerprint: embedded.claimedHash ? shortFingerprint(embedded.claimedHash) : null,
    }
    payload.tamper_evidence = embedded.match
      ? 'Intact — the embedded hash matches the document body byte-for-byte.'
      : 'Mismatch — the document body has been modified since the hash was stamped.'
  } else {
    payload.embedded = null
    payload.tamper_evidence = 'No Signova provenance block found in this document.'
  }

  // Look up the audit chain entry for this document hash if Redis is
  // configured. This proves the document was registered with Signova at
  // a specific sequence in the tamper-evident log.
  const lookupHash = embedded.hasProvenance && embedded.claimedHash ? embedded.claimedHash : fullHash
  try {
    const redis = getRedis()
    const auditEntry = await findAuditEntry(redis, lookupHash)
    if (auditEntry) {
      payload.audit = {
        sequence: auditEntry.sequence,
        entry_hash: auditEntry.entry_hash,
        prev_hash: auditEntry.prev_hash,
        stored_at: auditEntry.stored_at,
      }
      // If the entry has a signature, verify it against the published pubkey.
      const sig = auditEntry.receipt?.signature
      if (sig?.signature) {
        const { signature, prev_hash, ...signedPayload } = auditEntry.receipt
        const verdict = verifyReceiptSignature(signedPayload, sig.signature)
        payload.signature = {
          algorithm: sig.algorithm,
          key_id: sig.key_id,
          verified: verdict.ok,
          reason: verdict.reason,
        }
      }
      // OTS commitment status is one extra Redis lookup.
      const ots = await redis.get(`signova:ots:${lookupHash}`)
      if (ots) {
        const rec = typeof ots === 'string' ? JSON.parse(ots) : ots
        payload.timestamp = {
          anchored: true,
          calendar: rec.calendar,
          submitted_at: rec.submitted_at,
        }
      } else {
        payload.timestamp = { anchored: false }
      }
    }
  } catch {
    // Redis unavailable — verification still returns the hash comparison.
  }

  logInfo('/verify', {
    has_provenance: embedded.hasProvenance,
    match: embedded.match === true,
    has_audit: !!payload.audit,
    sig_ok: payload.signature?.verified === true,
  })
  return res.status(200).json(payload)
}
