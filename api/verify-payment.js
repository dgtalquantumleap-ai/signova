// api/verify-payment.js
// Verifies a Polar checkout was actually paid by calling their API server-side.
// This prevents users from faking ?payment=success in the URL.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { checkoutId } = req.body
  if (!checkoutId) {
    return res.status(400).json({ verified: false, error: 'Missing checkout ID' })
  }

  const accessToken = process.env.POLAR_ACCESS_TOKEN
  if (!accessToken) {
    console.error('POLAR_ACCESS_TOKEN not set')
    return res.status(500).json({ verified: false, error: 'Server misconfigured' })
  }

  try {
    // Look up the checkout session on Polar to confirm it was paid
    const response = await fetch(`https://api.polar.sh/v1/checkouts/${checkoutId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('Polar checkout lookup failed:', response.status)
      return res.status(400).json({ verified: false, error: 'Checkout not found' })
    }

    const checkout = await response.json()

    // Polar checkout statuses: 'open', 'expired', 'confirmed', 'succeeded', 'failed'
    // Only 'succeeded' means the payment actually went through
    if (checkout.status === 'succeeded' || checkout.status === 'confirmed') {
      // Fire-and-forget receipt email to buyer
      const buyerEmail = checkout.customer_email || checkout.email
      if (buyerEmail && process.env.RESEND_API_KEY) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: 'Signova <info@getsignova.com>',
            to: [buyerEmail],
            subject: 'Your Signova document is ready — return anytime to download',
            html: `
              <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0e0e0e;color:#f0ece4;">
                <div style="margin-bottom:24px;"><div style="display:inline-flex;align-items:center;gap:10px;"><div style="width:32px;height:32px;border-radius:8px;background:#c9a84c;color:#0e0e0e;font-size:18px;font-weight:700;text-align:center;line-height:32px;">S</div><span style="font-size:18px;font-weight:600;">Signova</span></div></div>
                <h2 style="color:#c9a84c;font-size:20px;margin-bottom:8px;">✓ Payment confirmed — your document is ready</h2>
                <p style="color:#9a9690;font-size:14px;line-height:1.7;margin-bottom:24px;">Your payment of <strong style="color:#f0ece4;">$4.99</strong> was successful. Return to Signova to download your clean, watermark-free PDF.</p>
                <a href="https://www.getsignova.com" style="display:inline-block;background:#c9a84c;color:#0e0e0e;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">Go to Signova to download →</a>
                <p style="color:#5a5754;font-size:12px;margin-top:8px;">Checkout reference: ${checkout.id}</p>
                <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;"/>
                <p style="color:#5a5754;font-size:11px;">Signova · Questions? <a href="mailto:hello@getsignova.com" style="color:#5a5754;">hello@getsignova.com</a></p>
              </div>`,
          }),
        }).catch(() => {})
      }
      return res.status(200).json({
        verified: true,
        checkoutId: checkout.id,
        productId: checkout.product_id,
      })
    }

    console.warn(`Checkout ${checkoutId} has status: ${checkout.status}`)
    return res.status(400).json({
      verified: false,
      error: `Checkout status is "${checkout.status}", not paid`,
    })
  } catch (err) {
    console.error('Payment verification error:', err)
    return res.status(500).json({ verified: false, error: 'Verification failed' })
  }
}
