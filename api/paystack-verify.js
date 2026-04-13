// api/paystack-verify.js
// Verifies a Paystack transaction server-side
// Called after redirect from Paystack callback URL

import { parseBody } from '../lib/parse-body.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ verified: false, error: 'Paystack not configured' })
  }

  const { reference } = await parseBody(req)
  if (!reference) {
    return res.status(400).json({ verified: false, error: 'Missing Paystack reference' })
  }

  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    )

    const data = await response.json()

    if (!data.status) {
      return res.status(400).json({
        verified: false,
        error: data.message || 'Verification failed',
      })
    }

    const tx = data.data

    // Paystack statuses: success, failed, abandoned, pending
    if (tx.status !== 'success') {
      console.warn(`Paystack reference ${reference} has status: ${tx.status}`)
      return res.status(400).json({
        verified: false,
        error: `Payment status is "${tx.status}", not success`,
      })
    }

    res.status(200).json({
      verified: true,
      reference: tx.reference,
      amount: tx.amount,
      currency: tx.currency,
      customerEmail: tx.customer?.email,
      metadata: tx.metadata,
    })
  } catch (err) {
    console.error('Paystack verify error:', err)
    res.status(500).json({ verified: false, error: 'Verification failed' })
  }
}
