// api/flutterwave-initialize.js
// Creates a Flutterwave payment for African card payments
// Flutterwave docs: https://developer.flutterwave.com/reference/initialize-a-payment

import { parseBody } from '../lib/parse-body.js'
import { logError } from '../lib/logger.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    return res.status(500).json({ error: 'Flutterwave not configured' })
  }

  const { docType, docName, email, currency: userCurrency } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  // Determine currency and amount based on user location
  const isNigeria = userCurrency === 'NGN'
  const currency = isNigeria ? 'NGN' : 'USD'
  const amount = isNigeria ? 6900 : 4.99

  try {
    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        amount: amount,
        currency: currency,
        redirect_url: `${origin}/preview?payment=flutterwave_success`,
        customer: {
          email: email || 'customer@getsignova.com',
        },
        customizations: {
          title: 'Signova Legal Document',
          description: `AI-generated legal document: ${docName || docType}`,
        },
        meta: {
          docType: docType || '',
          docName: docName || '',
        },
        payment_options: 'card',
      }),
    })

    const data = await response.json()

    if (data.status !== 'success') {
      logError('/flutterwave-initialize', { message: data.message })
      return res.status(500).json({ error: data.message || 'Flutterwave initialization failed' })
    }

    // Flutterwave returns { link: payment_url, ... }
    res.status(200).json({
      url: data.data.link,
      tx_ref: data.data.tx_ref,
    })
  } catch (err) {
    logError('/flutterwave-initialize', { message: err.message, stack: err.stack })
    res.status(500).json({ error: 'Could not initialize Flutterwave payment' })
  }
}
