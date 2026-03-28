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

  const { docType, docName } = await parseBody(req)
  const origin = req.headers.origin || 'https://getsignova.com'

  try {
    const response = await fetch('https://api.oxapay.com/merchants/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: process.env.OXAPAY_MERCHANT_KEY,
        amount: 4.99,
        currency: 'USD',
        lifeTime: 30, // 30 minutes to complete payment
        feePaidByPayer: 1, // customer covers the network fee
        callbackUrl: `${origin}/api/oxapay-webhook`,
        returnUrl: `${origin}/preview?payment=oxapay_success`,
        description: `Signova — ${docName}`,
        orderId: `${docType}_${Date.now()}`,
      }),
    })

    const json = await response.json()

    // OxaPay returns result: 100 for success
    if (json.result !== 100) {
      console.error('OxaPay checkout error:', JSON.stringify(json))
      throw new Error(json.message || 'Could not create payment invoice.')
    }

    res.status(200).json({
      url: json.payLink,
      trackId: json.trackId,
    })
  } catch (err) {
    console.error('OxaPay checkout error:', err)
    res.status(500).json({ error: err.message })
  }
}
