// api/scope-guard-waitlist.js
// POST /api/scope-guard-waitlist
// Captures Scope Guard waitlist signups via Resend

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let body = req.body
  if (!body || typeof body === 'string') {
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', chunk => { data += chunk })
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
      body = raw ? JSON.parse(raw) : {}
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' })
    }
  }

  const { email } = body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — scope guard signup not sent for:', email)
    return res.status(200).json({ ok: true })
  }

  try {
    // 1. Notify Olumide
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Signova <info@getsignova.com>',
        to: ['info@ebenova.net'],
        subject: `🛡️ Scope Guard waitlist: ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#c9a84c;margin-bottom:8px;">New Scope Guard waitlist signup</h2>
            <p style="font-size:20px;font-weight:bold;color:#111;">${email}</p>
            <p style="color:#666;font-size:14px;margin-top:16px;">
              Signed up for early access to Scope Guard.<br/>
              They want the 50% discount for 3 months ($9.99/mo).
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
            <p style="color:#999;font-size:12px;">getsignova.com · Ebenova Solutions</p>
          </div>
        `,
      }),
    })

    // 2. Confirmation to user
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Signova <info@getsignova.com>',
        to: [email],
        subject: "You're on the Scope Guard waitlist — 50% off when we launch",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0e0e0e;color:#f0ece4;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
              <div style="width:32px;height:32px;border-radius:8px;background:#c9a84c;color:#0e0e0e;font-size:18px;font-weight:700;display:flex;align-items:center;justify-content:center;">S</div>
              <span style="font-size:20px;font-weight:600;color:#f0ece4;">Signova</span>
            </div>
            <h2 style="color:#c9a84c;margin-bottom:16px;">You're on the list. 🛡️</h2>
            <p style="color:#9a9690;line-height:1.7;margin-bottom:20px;">
              Thanks for signing up for <strong style="color:#f0ece4;">Signova Scope Guard</strong> early access.
            </p>
            <p style="color:#9a9690;line-height:1.7;margin-bottom:20px;">
              Scope Guard detects when client requests violate your contract and auto-drafts professional 
              responses — change orders, pushback emails, and contract references. Launching as part of Signova Pro.
            </p>
            <p style="color:#9a9690;line-height:1.7;margin-bottom:32px;">
              As an early signup you'll get <strong style="color:#f0ece4;">50% off for 3 months</strong> 
              ($9.99/mo instead of $19.99/mo). We'll email you the moment it's live.
            </p>
            <div style="background:#161616;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:32px;">
              <p style="color:#9a9690;font-size:14px;margin-bottom:12px;">In the meantime, generate legal documents at:</p>
              <a href="https://www.getsignova.com/scope-guard" style="color:#c9a84c;font-weight:600;">getsignova.com/scope-guard</a>
            </div>
            <hr style="border:none;border-top:1px solid #2a2a2a;margin:32px 0;"/>
            <p style="color:#5a5754;font-size:12px;">
              Signova · Ebenova Solutions<br/>
              <a href="mailto:info@getsignova.com" style="color:#5a5754;">info@getsignova.com</a>
            </p>
          </div>
        `,
      }),
    })

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Scope Guard waitlist Resend error:', err)
    return res.status(200).json({ ok: true }) // non-fatal
  }
}
