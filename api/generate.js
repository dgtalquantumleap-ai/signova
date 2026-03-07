// api/generate.js
// PAID ONLY — Uses Anthropic Claude for premium quality documents
// Verifies Polar payment server-side before generating

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, checkoutId } = req.body
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' })

  // Verify payment with Polar API — no more trusting client-side flags
  if (!checkoutId) {
    return res.status(403).json({
      error: 'Payment verification required. Use /api/generate-preview for free previews.',
    })
  }

  const polarToken = process.env.POLAR_ACCESS_TOKEN
  if (!polarToken) {
    return res.status(500).json({ error: 'Server misconfigured — missing Polar token' })
  }

  try {
    // Verify the checkout is actually paid
    const checkoutRes = await fetch(`https://api.polar.sh/v1/checkouts/${checkoutId}`, {
      headers: {
        'Authorization': `Bearer ${polarToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!checkoutRes.ok) {
      console.error('Polar checkout lookup failed:', checkoutRes.status)
      return res.status(403).json({ error: 'Invalid checkout. Payment could not be verified.' })
    }

    const checkout = await checkoutRes.json()

    if (checkout.status !== 'succeeded' && checkout.status !== 'confirmed') {
      console.warn(`Checkout ${checkoutId} status: ${checkout.status}`)
      return res.status(403).json({
        error: `Payment not completed (status: ${checkout.status}). Please complete payment first.`,
      })
    }
  } catch (verifyErr) {
    console.error('Payment verification failed:', verifyErr)
    return res.status(500).json({ error: 'Payment verification failed. Please try again.' })
  }

  // Payment verified — generate premium document with Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'Server misconfigured — missing Anthropic key' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system:
          'You are an expert legal document drafter with deep knowledge of international law. Generate comprehensive, professional legal documents tailored precisely to the user details provided. Use formal legal language, clear numbered sections, and include all standard clauses. This is a premium paid document — make it exceptional. Never add disclaimers, footnotes, notes, or suggestions to consult a lawyer at the end of the document. The document ends cleanly after the signature block with no additional commentary.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return res
        .status(response.status)
        .json({ error: err.error?.message || 'Generation failed' })
    }

    const data = await response.json()
    const text = data.content[0]?.text || ''
    res.status(200).json({ text, isPremium: true })
  } catch (err) {
    console.error('Generate error:', err)
    res.status(500).json({ error: 'Generation failed. Please try again.' })
  }
}
