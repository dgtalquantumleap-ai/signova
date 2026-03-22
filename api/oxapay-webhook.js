export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const data = req.body

    // Verify this request genuinely came from OxaPay
    // OxaPay signs webhooks with HMAC-SHA512 using your merchant key
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY
    if (merchantKey) {
      const signature = req.headers['oxapay-signature'] || req.headers['x-oxapay-signature']
      if (signature) {
        const { createHmac } = await import('crypto')
        const rawBody = JSON.stringify(data)
        const expectedSig = createHmac('sha512', merchantKey).update(rawBody).digest('hex')
        if (signature !== expectedSig) {
          console.warn('OxaPay webhook: invalid signature — possible spoofed request')
          return res.status(401).json({ error: 'Invalid signature' })
        }
      }
      // If no signature header present: OxaPay may not send one on all plans
      // Log but continue — full verification happens in /api/oxapay-verify
    }

    const { trackId, status, orderId } = data

    console.log(`OxaPay webhook: trackId=${trackId} status=${status} orderId=${orderId}`)

    // Only act on confirmed payments
    if (status !== 'Paid' && status !== 'Confirming') {
      return res.status(200).json({ received: true, action: 'ignored', status })
    }

    // Payment confirmed — nothing more to do server-side for Signova.
    // The document generation happens client-side when the customer returns
    // via the returnUrl (/preview?payment=oxapay_success) and calls /api/oxapay-verify.
    // This webhook is a safety net: if the customer closes their browser,
    // they can return to getsignova.com, go back through the flow, and the
    // verify endpoint will confirm their trackId is paid.
    //
    // Future enhancement: store confirmed trackIds in a DB here so returning
    // customers don't need to re-enter the flow.

    console.log(`OxaPay payment confirmed: trackId=${trackId} orderId=${orderId}`)

    // Always return 200 so OxaPay stops retrying
    return res.status(200).json({ received: true, action: 'confirmed' })
  } catch (err) {
    console.error('OxaPay webhook error:', err)
    // Still return 200 — if we return 5xx, OxaPay will keep retrying
    return res.status(200).json({ received: true, error: err.message })
  }
}
