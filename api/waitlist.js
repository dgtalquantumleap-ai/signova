// api/waitlist.js — saves waitlist email and notifies you via Resend
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Fail silently in production if key not yet set — don't break the UI
    console.warn('RESEND_API_KEY not set — waitlist email not sent for:', email)
    return res.status(200).json({ ok: true })
  }

  try {
    // 1. Notify you immediately
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Signova Waitlist <info@getsignova.com>',
        to: ['info@ebenova.net'],
        subject: `🎉 New Signova Pro waitlist signup: ${email}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="color: #c9a84c; margin-bottom: 8px;">New Unlimited waitlist signup</h2>
            <p style="font-size: 20px; font-weight: bold; color: #111;">${email}</p>
            <p style="color: #666; font-size: 14px; margin-top: 24px;">
              Signed up for the Signova Unlimited ($9.99/mo) waitlist.<br/>
              Reply to this email to reach them directly.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">getsignova.com · Ebenova Solutions</p>
          </div>
        `,
      }),
    })

    // 2. Send confirmation to the user
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Signova <info@getsignova.com>',
        to: [email],
        subject: "You're on the Signova Unlimited waitlist",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0e0e0e; color: #f0ece4;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 32px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: #c9a84c; color: #0e0e0e; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 32px;">S</div>
              <span style="font-size: 20px; font-weight: 600; color: #f0ece4;">Signova</span>
            </div>
            <h2 style="color: #c9a84c; margin-bottom: 16px;">You're on the list.</h2>
            <p style="color: #9a9690; line-height: 1.7; margin-bottom: 24px;">
              Thanks for signing up for <strong style="color: #f0ece4;">Signova Pro</strong> — 
              unlimited document generation, contract monitoring, and scope alerts for $9.99/month.
            </p>
            <p style="color: #9a9690; line-height: 1.7; margin-bottom: 24px;">
              We're building the full Pro experience and will email you the moment it's live.
              You'll get first access and a launch discount as an early signup.
            </p>
            <p style="color: #9a9690; line-height: 1.7; margin-bottom: 32px;">
              In the meantime, you can generate any document for just $4.99 at
              <a href="https://getsignova.com" style="color: #c9a84c;">getsignova.com</a>.
            </p>
            <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 32px 0;" />
            <p style="color: #5a5754; font-size: 12px;">
              Signova · Ebenova Solutions<br/>
              <a href="mailto:hello@getsignova.com" style="color: #5a5754;">hello@getsignova.com</a>
            </p>
          </div>
        `,
      }),
    })

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Resend error:', err)
    // Still return 200 — don't break the UI over an email failure
    res.status(200).json({ ok: true })
  }
}
