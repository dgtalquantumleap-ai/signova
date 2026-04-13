// api/flutterwave-verify.js
// Verifies a Flutterwave transaction server-side
// Called after redirect from Flutterwave callback URL

import { parseBody } from '../lib/parse-body.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return res.status(500).json({ verified: false, error: 'Flutterwave not configured' })
  }

  const { tx_ref } = await parseBody(req)
  if (!tx_ref) {
    return res.status(400).json({ verified: false, error: 'Missing Flutterwave tx_ref' })
  }

  try {
    // Flutterwave doesn't have a direct verify endpoint — we list transactions by tx_ref
    // Use the transactions API to find our transaction
    const response = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${tx_ref}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    )

    const data = await response.json()

    if (data.status !== 'success' || !data.data) {
      return res.status(400).json({
        verified: false,
        error: data.message || 'Transaction not found',
      })
    }

    const tx = data.data

    // Flutterwave statuses: successful, failed, cancelled, pending
    if (tx.status !== 'successful') {
      console.warn(`Flutterwave tx_ref ${tx_ref} has status: ${tx.status}`)
      return res.status(400).json({
        verified: false,
        error: `Payment status is "${tx.status}", not successful`,
      })
    }

    res.status(200).json({
      verified: true,
      tx_ref: tx.tx_ref,
      transaction_id: tx.id,
      amount: tx.amount,
      currency: tx.currency,
      customerEmail: tx.customer?.email,
      metadata: tx.meta,
    })
  } catch (err) {
    console.error('Flutterwave verify error:', err)
    res.status(500).json({ verified: false, error: 'Verification failed' })
  }
}
