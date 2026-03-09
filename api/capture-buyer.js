// api/capture-buyer.js — post-purchase email capture
// Stores buyer email and sends them the Scope Guard checklist
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, docName } = req.body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — buyer email not sent for:', email)
    return res.status(200).json({ ok: true })
  }

  try {
    // 1. Notify founder of buyer email
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Signova Buyers <info@getsignova.com>',
        to: ['info@ebenova.net'],
        subject: `💰 Buyer email captured: ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#c9a84c;">New buyer email captured</h2>
            <p style="font-size:20px;font-weight:bold;color:#111;">${email}</p>
            <p style="color:#666;font-size:14px;">
              Document purchased: <strong>${docName || 'Unknown'}</strong><br/>
              This person is a paying customer. They're your hottest Pro lead.
            </p>
          </div>
        `,
      }),
    })

    // 2. Send buyer the Scope Guard checklist (value-add email)
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Signova <info@getsignova.com>',
        to: [email],
        subject: `Your free checklist: 5 ways to protect your ${docName || 'document'} after signing`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0e0e0e;color:#f0ece4;">
            <div style="margin-bottom:28px;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:32px;height:32px;border-radius:8px;background:#c9a84c;color:#0e0e0e;font-size:18px;font-weight:700;text-align:center;line-height:32px;">S</div>
                <span style="font-size:18px;font-weight:600;">Signova</span>
              </div>
            </div>

            <h2 style="color:#c9a84c;font-size:20px;margin-bottom:8px;">
              5 things to do after signing your document
            </h2>
            <p style="color:#9a9690;font-size:14px;line-height:1.7;margin-bottom:28px;">
              Your document is ready — here's how to make sure it actually protects you.
            </p>

            <div style="background:#161616;border-radius:10px;padding:20px 24px;margin-bottom:12px;">
              <p style="margin:0;color:#c9a84c;font-weight:700;font-size:13px;">✓ Step 1</p>
              <p style="margin:6px 0 0;color:#f0ece4;font-size:14px;line-height:1.6;">
                <strong>Get both signatures before any work starts.</strong> An unsigned contract protects nobody. Don't start until you have a countersigned copy.
              </p>
            </div>

            <div style="background:#161616;border-radius:10px;padding:20px 24px;margin-bottom:12px;">
              <p style="margin:0;color:#c9a84c;font-weight:700;font-size:13px;">✓ Step 2</p>
              <p style="margin:6px 0 0;color:#f0ece4;font-size:14px;line-height:1.6;">
                <strong>Send scope changes in writing, always.</strong> If a client asks for extra work verbally, reply by email: "Just to confirm, this is outside our original agreement — I'll send a separate quote."
              </p>
            </div>

            <div style="background:#161616;border-radius:10px;padding:20px 24px;margin-bottom:12px;">
              <p style="margin:0;color:#c9a84c;font-weight:700;font-size:13px;">✓ Step 3</p>
              <p style="margin:6px 0 0;color:#f0ece4;font-size:14px;line-height:1.6;">
                <strong>Save the original brief.</strong> Screenshot or copy every instruction the client gave you before you started. This is your evidence if they claim you didn't deliver.
              </p>
            </div>

            <div style="background:#161616;border-radius:10px;padding:20px 24px;margin-bottom:12px;">
              <p style="margin:0;color:#c9a84c;font-weight:700;font-size:13px;">✓ Step 4</p>
              <p style="margin:6px 0 0;color:#f0ece4;font-size:14px;line-height:1.6;">
                <strong>Send progress updates proactively.</strong> A quick "here's where we are" email kills 90% of revision requests before they happen. Silence breeds assumptions.
              </p>
            </div>

            <div style="background:#161616;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
              <p style="margin:0;color:#c9a84c;font-weight:700;font-size:13px;">✓ Step 5</p>
              <p style="margin:6px 0 0;color:#f0ece4;font-size:14px;line-height:1.6;">
                <strong>Invoice on delivery, not after approval.</strong> "Upon client approval" is a trap — it lets clients delay indefinitely. Invoice when you deliver. Your contract should say so.
              </p>
            </div>

            <div style="background:#1a1500;border:1px solid #c9a84c33;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
              <p style="margin:0 0 8px;color:#c9a84c;font-weight:700;font-size:13px;">Coming soon to Signova Pro</p>
              <p style="margin:0;color:#9a9690;font-size:13px;line-height:1.6;">
                Paste any client message and instantly know if it violates your contract — plus get a ready-to-send professional response. We'll email you when it launches.
              </p>
            </div>

            <p style="color:#9a9690;font-size:13px;line-height:1.7;">
              Need another document? Head back to
              <a href="https://getsignova.com" style="color:#c9a84c;">getsignova.com</a> anytime.
            </p>

            <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0;" />
            <p style="color:#5a5754;font-size:11px;">
              Signova · Ebenova Solutions ·
              <a href="mailto:hello@getsignova.com" style="color:#5a5754;">hello@getsignova.com</a>
            </p>
          </div>
        `,
      }),
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Buyer capture error:', err)
    res.status(200).json({ ok: true })
  }
}
