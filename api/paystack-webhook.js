// api/paystack-webhook.js
// Handles Paystack webhook events for payment confirmation
// Paystack sends events to this endpoint when payment status changes

import { parseBody } from '../lib/parse-body.js'
import { createHash } from 'crypto'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verify webhook signature
  const hash = createHash('sha512')
    .update(JSON.stringify(req.body))
    .update(process.env.PAYSTACK_SECRET_KEY)
    .digest('hex')

  const signature = req.headers['x-paystack-signature']
  if (signature && signature !== hash) {
    console.warn('Paystack webhook: invalid signature')
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const event = req.body

  if (event.event === 'charge.success') {
    const { reference, amount, currency, metadata, customer } = event.data
    const docType = metadata?.docType || ''
    const docName = metadata?.docName || ''

    console.log(`Paystack payment confirmed: ref=${reference} amount=${amount} ${currency} doc=${docName}`)

    // Fire-and-forget receipt email
    if (customer?.email && process.env.RESEND_API_KEY) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Signova <info@getsignova.com>',
          to: [customer.email],
          subject: 'Your Signova document is ready — return anytime to download',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0e0e0e;color:#f0ece4;">
              <div style="margin-bottom:24px;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <div style="width:32px;height:32px;border-radius:8px;background:#c9a84c;color:#0e0e0e;font-size:18px;font-weight:700;text-align:center;line-height:32px;">S</div>
                  <span style="font-size:18px;font-weight:600;">Signova</span>
                </div>
              </div>
              <h2 style="color:#c9a84c;font-size:20px;margin-bottom:8px;">✓ Payment confirmed — your document is ready</h2>
              <p style="color:#9a9690;font-size:14px;line-height:1.7;margin-bottom:24px;">
                Your payment of <strong style="color:#f0ece4;">${(amount / 100).toLocaleString()} ${currency?.toUpperCase() || 'NGN'}</strong> was successful via Paystack.
                Return to Signova to download your clean, watermark-free PDF.
              </p>
              <a href="https://www.getsignova.com" style="display:inline-block;background:#c9a84c;color:#0e0e0e;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">
                Go to Signova to download →
              </a>
              <p style="color:#5a5754;font-size:12px;margin-top:8px;">
                Reference: ${reference}
              </p>
              <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;"/>
              <p style="color:#5a5754;font-size:11px;">
                Signova · Questions? <a href="mailto:info@ebenova.net" style="color:#5a5754;">info@ebenova.net</a>
              </p>
            </div>`,
        }),
      }).catch(() => {})
    }

    // Always return 200 so Paystack stops retrying
    return res.status(200).json({ received: true })
  }

  // Handle other events silently
  return res.status(200).json({ received: true })
}
