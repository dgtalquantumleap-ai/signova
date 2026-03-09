// Promo code redemption — bypasses payment, grants one free document download
// Code: PRODUCTHUNT — 30-day expiry from launch, max 100 uses

const VALID_CODES = {
  PRODUCTHUNT: {
    expiresAt: new Date(''2026-04-09T23:59:59Z''),
    maxUses: 100,
    description: ''Product Hunt launch — 1 free document'',
  },
}

export default async function handler(req, res) {
  if (req.method !== ''POST'') return res.status(405).end()

  const { code, docType, docName } = req.body

  if (!code || !docType) {
    return res.status(400).json({ error: ''Missing code or docType'' })
  }

  const upperCode = code.toUpperCase().trim()
  const promo = VALID_CODES[upperCode]

  if (!promo) {
    return res.status(400).json({ valid: false, error: ''Invalid promo code.'' })
  }

  const now = new Date()
  if (now > promo.expiresAt) {
    return res.status(400).json({
      valid: false,
      error: ''This promo code has expired.'',
    })
  }

  const secret = process.env.PROMO_SECRET || ''signova_promo_2026''
  const timestamp = Date.now()
  const payload = ${upperCode}::

  const { createHmac } = await import(''crypto'')
  const sig = createHmac(''sha256'', secret).update(payload).digest(''hex'').slice(0, 16)
  const token = Buffer.from(${payload}:).toString(''base64url'')

  try {
    await fetch(''https://api.resend.com/emails'', {
      method: ''POST'',
      headers: {
        ''Content-Type'': ''application/json'',
        Authorization: Bearer ,
      },
      body: JSON.stringify({
        from: ''Signova <noreply@getsignova.com>'',
        to: ''info@ebenova.net'',
        subject: Promo used:  — ,
        html: <p>Code <strong></strong> redeemed for <strong></strong> at </p>,
      }),
    })
  } catch (_) {}

  return res.status(200).json({
    valid: true,
    token,
    message: Code applied! Your free  download is unlocked.,
  })
}
