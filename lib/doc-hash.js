// lib/doc-hash.js
// Document provenance: SHA-256 content hashing + structured receipts.
//
// Every generated document gets a deterministic fingerprint. The hash is:
//   - embedded as a machine-readable block at the end of the document
//   - returned in the API response
//   - verifiable at /api/verify
//
// The goal is tamper-evidence: change any character of the document and
// the hash changes. Users and counterparties can verify that what they
// hold is byte-for-byte what Signova generated.

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as edSign,
  verify as edVerify,
} from 'node:crypto'

const ISSUER = 'signova.v1'

// ── Ed25519 signing helpers ─────────────────────────────────────────────
// Keys are stored in env vars as PKCS#8 / SPKI PEM, base64-encoded on one
// line to stay friendly with Vercel's env-var UI. Generate with:
//   node scripts/generate-keys.mjs
//
// SIGNOVA_SIGNING_SK — base64(PKCS#8 Ed25519 private key PEM)
// SIGNOVA_SIGNING_PK — base64(SPKI Ed25519 public key PEM)
// SIGNOVA_SIGNING_KID — short key identifier (e.g. "sig-2026-01")

function getSigningKey() {
  const sk = process.env.SIGNOVA_SIGNING_SK
  if (!sk) return null
  try {
    const pem = Buffer.from(sk, 'base64').toString('utf8')
    return createPrivateKey(pem)
  } catch {
    return null
  }
}

export function getPublicKeyPem() {
  const pk = process.env.SIGNOVA_SIGNING_PK
  if (!pk) return null
  try {
    return Buffer.from(pk, 'base64').toString('utf8').trim()
  } catch {
    return null
  }
}

export function getSigningKeyId() {
  return (process.env.SIGNOVA_SIGNING_KID || 'sig-v1').trim()
}

// Canonical JSON: keys sorted alphabetically, no whitespace.
// Used as the byte sequence we sign / chain-hash, so signatures are portable.
export function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}'
}

export function signReceipt(receiptPayload) {
  const key = getSigningKey()
  if (!key) return null
  const message = Buffer.from(canonicalJson(receiptPayload), 'utf8')
  const sig = edSign(null, message, key)
  return {
    algorithm: 'Ed25519',
    key_id: getSigningKeyId(),
    signature: sig.toString('base64'),
  }
}

export function verifyReceiptSignature(receiptPayload, signatureB64) {
  const pubPem = getPublicKeyPem()
  if (!pubPem) return { ok: false, reason: 'no_public_key_configured' }
  try {
    const key = createPublicKey(pubPem)
    const message = Buffer.from(canonicalJson(receiptPayload), 'utf8')
    const ok = edVerify(null, message, key, Buffer.from(signatureB64, 'base64'))
    return { ok, reason: ok ? 'valid' : 'signature_mismatch' }
  } catch (err) {
    return { ok: false, reason: 'verify_error', error: err.message }
  }
}

// Normalise text before hashing so trivial whitespace differences don't break
// verification. We strip the provenance block itself before re-hashing, so
// the hash stamped IN the document covers the document WITHOUT the block.
export function normaliseForHash(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')   // trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n') // collapse 3+ blank lines
    .trim()
}

export function hashDocument(text) {
  const normalised = normaliseForHash(text)
  return createHash('sha256').update(normalised, 'utf8').digest('hex')
}

// Short human-readable fingerprint (first 16 hex chars, grouped).
// Long enough to be unique across millions of docs, short enough to copy by hand.
export function shortFingerprint(hash) {
  return hash.slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

// Build a structured receipt. `extras` lets callers stamp doc_type etc.
// If a signing key is configured, the receipt's canonical JSON is signed
// with Ed25519 and a `signature` object is attached.
export function buildReceipt(text, extras = {}) {
  const hash = hashDocument(text)
  const issuedAt = new Date().toISOString()
  const nonce = randomBytes(8).toString('hex')
  const payload = {
    issuer: ISSUER,
    algorithm: 'SHA-256',
    hash,
    fingerprint: shortFingerprint(hash),
    issued_at: issuedAt,
    nonce,
    verify_url: `https://www.getsignova.com/trust?hash=${hash}`,
    ...extras,
  }
  const signature = signReceipt(payload)
  return signature ? { ...payload, signature } : payload
}

// Hash a canonical receipt into a 64-char hex — used as the chain link.
export function receiptHash(receipt) {
  const { signature, prev_hash, ...core } = receipt
  return createHash('sha256').update(canonicalJson(core), 'utf8').digest('hex')
}

// Append a receipt to the tamper-evident audit log in Redis.
// Each entry references the hash of the previous entry, forming a chain.
// Any tampered entry invalidates every entry that follows it.
//
// Keys:
//   signova:audit:head        → hash of the latest entry (string)
//   signova:audit:entry:<h>   → JSON { prev_hash, entry_hash, receipt, sequence, stored_at }
export async function appendToAuditLog(redis, receipt) {
  if (!redis) return null
  const prevHash = (await redis.get('signova:audit:head')) || null
  const withPrev = { ...receipt, prev_hash: prevHash }
  const entryHash = receiptHash(withPrev)
  const sequence = Number((await redis.incr('signova:audit:seq')) || 1)
  const entry = {
    sequence,
    prev_hash: prevHash,
    entry_hash: entryHash,
    receipt: withPrev,
    stored_at: new Date().toISOString(),
  }
  // Pipeline: write the entry, update the head, and index by doc hash
  await redis.set(`signova:audit:entry:${entryHash}`, JSON.stringify(entry))
  await redis.set('signova:audit:head', entryHash)
  if (receipt?.hash) {
    await redis.set(`signova:audit:doc:${receipt.hash}`, entryHash)
  }
  return entry
}

// Look up an audit entry by either the entry hash or the document hash.
export async function findAuditEntry(redis, hash) {
  if (!redis || !hash) return null
  // Try direct entry lookup first
  const direct = await redis.get(`signova:audit:entry:${hash}`)
  if (direct) return typeof direct === 'string' ? JSON.parse(direct) : direct
  // Fall back to doc-hash → entry-hash index
  const entryHash = await redis.get(`signova:audit:doc:${hash}`)
  if (!entryHash) return null
  const entry = await redis.get(`signova:audit:entry:${entryHash}`)
  return entry ? (typeof entry === 'string' ? JSON.parse(entry) : entry) : null
}

// Render a provenance block to append to the end of a document.
// The block is deterministic from the hash + issued_at so it can be
// regenerated during verification.
export function renderProvenanceBlock(receipt) {
  const lines = [
    '',
    '---',
    '',
    '**Document Provenance**',
    '',
    `- Issuer: ${receipt.issuer}`,
    `- Algorithm: ${receipt.algorithm}`,
    `- Content hash: \`${receipt.hash}\``,
    `- Fingerprint: \`${receipt.fingerprint}\``,
    `- Issued at: ${receipt.issued_at}`,
  ]
  if (receipt.signature) {
    lines.push(`- Signature: ${receipt.signature.algorithm} · key ${receipt.signature.key_id}`)
  }
  lines.push(`- Verify: ${receipt.verify_url}`)
  lines.push('')
  lines.push('*This fingerprint identifies the exact content of this document.*')
  lines.push('*Any change to the text above produces a different hash.*')
  lines.push('')
  return lines.join('\n')
}

// Given a document that already has a provenance block, strip it and
// re-hash the body. Returns { bodyHash, claimedHash, match }.
export function verifyEmbeddedProvenance(fullText) {
  const marker = '**Document Provenance**'
  const idx = fullText.indexOf(marker)
  if (idx === -1) {
    return { hasProvenance: false }
  }
  // Body is everything before the "---" that precedes the provenance block.
  // Walk back from the marker to the separator line.
  const before = fullText.slice(0, idx)
  const sepIdx = before.lastIndexOf('\n---\n')
  const body = sepIdx === -1 ? before : before.slice(0, sepIdx)
  const bodyHash = hashDocument(body)
  const claimMatch = fullText.slice(idx).match(/Content hash:\s*`([a-f0-9]{64})`/i)
  const claimedHash = claimMatch ? claimMatch[1] : null
  return {
    hasProvenance: true,
    bodyHash,
    claimedHash,
    match: !!claimedHash && claimedHash.toLowerCase() === bodyHash.toLowerCase(),
  }
}
