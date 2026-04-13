// api/paystack-initialize.js
// Creates a Paystack transaction for Nigerian Naira payments
// Paystack docs: https://paystack.com/docs/api/transaction/#initialize

import { parseBody } from '../lib/parse-body.js'
import { logError } from '../lib/logger.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return res.status(500).json({ error: 'Paystack not configured' })
  }

  const { docType, docName, email } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  // Price in kobo (NGN smallest unit) — ₦6,900 = 690000 kobo
  const amountKobo = 690000

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email || 'customer@getsignova.com', // Fallback — ideally from user input
        amount: amountKobo,
        currency: 'NGN',
        callback_url: `${origin}/preview?payment=paystack_success`,
        cancel_url: `${origin}/preview?payment=cancelled`,
        metadata: JSON.stringify({
          docType: docType || '',
          docName: docName || '',
          origin: 'getsignova.com',
        }),
      }),
    })

    const data = await response.json()

    if (!data.status) {
      logError('/paystack-initialize', { message: data.message })
      return res.status(500).json({ error: data.message || 'Paystack initialization failed' })
    }

    // Paystack returns { authorization_url, reference, access_code }
    res.status(200).json({
      url: data.data.authorization_url,
      reference: data.data.reference,
      accessCode: data.data.access_code,
    })
  } catch (err) {
    logError('/paystack-initialize', { message: err.message, stack: err.stack })
    res.status(500).json({ error: 'Could not initialize Paystack transaction' })
  }
}
