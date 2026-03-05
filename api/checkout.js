export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { docType, docName } = req.body
  const origin = req.headers.origin || 'https://getsignova.com'

  try {
    const response = await fetch('https://api.polar.sh/v1/checkouts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: [process.env.POLAR_PRODUCT_ID],
        success_url: `${origin}/preview?payment=success`,
        metadata: { docType, docName },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Polar API error:', JSON.stringify(err))
      throw new Error(JSON.stringify(err))
    }

    const json = await response.json()
    const checkoutUrl = json.url

    res.status(200).json({ url: checkoutUrl })
  } catch (err) {
    console.error('Polar checkout error:', err)
    res.status(500).json({ error: err.message })
  }
}
