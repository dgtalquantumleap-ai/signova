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
    if (checkout.status === 'succeeded') {
      return res.status(200).json({
        verified: true,
        checkoutId: checkout.id,
        productId: checkout.product_id,
      })
    }

    // 'confirmed' means payment is processing but not yet settled — treat as success
    // since Polar redirects to success_url at this stage
    if (checkout.status === 'confirmed') {
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
