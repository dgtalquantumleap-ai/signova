import { parseBody } from '../lib/parse-body.js'
import { logError } from '../lib/logger.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { trackId } = await parseBody(req)

  if (!trackId) return res.status(400).json({ error: 'Missing trackId' })

  try {
    const response = await fetch('https://api.oxapay.com/merchants/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: process.env.OXAPAY_MERCHANT_KEY,
        trackId,
      }),
    })

    const json = await response.json()

    if (json.result !== 100) {
      return res.status(400).json({ verified: false, error: json.message })
    }

    // OxaPay statuses: Waiting, Paid, Confirming, Expired, Failed
    const paid = json.status === 'Paid' || json.status === 'Confirming'

    if (paid) {
      // Validate amount — OxaPay reports amount in the order currency (USD)
      const MIN_AMOUNT_USD = 4.0 // $4.00 floor (slightly below $4.99 to allow for minor rounding)
      const paidAmount = parseFloat(json.payAmount || json.amount || '0')
      if (paidAmount < MIN_AMOUNT_USD) {
        return res.status(402).json({
          verified: false,
          error: 'Payment amount insufficient.',
        })
      }
    }

    res.status(200).json({
      verified: paid,
      status: json.status,
      amount: json.amount,
      currency: json.currency,
    })
  } catch (err) {
    logError('OxaPay verify error:', err)
    res.status(500).json({ verified: false, error: err.message })
  }
}
