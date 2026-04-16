// api/pubkey.js
// Returns the Signova Ed25519 public key used to sign document receipts.
// Anyone holding a signed receipt can verify its authenticity against this key
// without contacting us.

import { getPublicKeyPem, getSigningKeyId } from '../lib/doc-hash.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const pem = getPublicKeyPem()
  if (!pem) {
    return res.status(503).json({
      ok: false,
      error: 'No public signing key configured on this deployment.',
    })
  }
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.status(200).json({
    ok: true,
    algorithm: 'Ed25519',
    key_id: getSigningKeyId(),
    public_key_pem: pem,
    note: 'Use this key to verify the `signature` field of any Signova document receipt. The signed payload is the canonical JSON of the receipt excluding the `signature` object itself.',
  })
}
