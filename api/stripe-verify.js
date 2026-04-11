// api/stripe-verify.js
// Verifies a Stripe Checkout Session was actually paid
// Replaces Polar verify-payment.js

import Stripe from 'stripe'

// Stripe client initialised lazily inside handler to avoid crashing on boot
// when STRIPE_SECRET_KEY is not yet set (e.g. local dev without .env)
async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { sessionId } = await parseBody(req)
  if (!sessionId) {
    return res.status(400).json({ verified: false, error: 'Missing session ID' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not set')
    return res.status(500).json({ verified: false, error: 'Server misconfigured' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Only 'complete' status means payment succeeded
    if (session.payment_status === 'paid') {
      // Fire-and-forget receipt email to buyer
      const buyerEmail = session.customer_email || session.customer_details?.email
      if (buyerEmail && process.env.RESEND_API_KEY) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Signova <info@getsignova.com>',
            to: [buyerEmail],
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
                  Your payment of <strong style="color:#f0ece4;">$4.99</strong> was successful. 
                  Return to Signova to download your clean, watermark-free PDF.
                </p>
                <a href="https://www.getsignova.com" style="display:inline-block;background:#c9a84c;color:#0e0e0e;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">
                  Go to Signova to download →
                </a>
                <p style="color:#5a5754;font-size:12px;margin-top:8px;">
                  Session reference: ${session.id}
                </p>
                <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;"/>
                <p style="color:#5a5754;font-size:11px;">
                  Signova · Questions? <a href="mailto:hello@getsignova.com" style="color:#5a5754;">hello@getsignova.com</a>
                </p>
              </div>`,
          }),
        }).catch(() => {})
      }

      return res.status(200).json({
        verified: true,
        sessionId: session.id,
        amountTotal: session.amount_total,
        customerEmail: buyerEmail,
      })
    }

    console.warn(`Session ${sessionId} has payment_status: ${session.payment_status}`)
    return res.status(400).json({
      verified: false,
      error: `Payment status is "${session.payment_status}", not paid`,
    })
  } catch (err) {
    console.error('Stripe verification error:', err)
    return res.status(500).json({ verified: false, error: 'Verification failed' })
  }
}
