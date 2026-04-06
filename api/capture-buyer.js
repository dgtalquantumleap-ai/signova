// api/capture-buyer.js — email capture (pre-purchase preview leads + post-purchase buyers)
import { parseBody } from '../lib/parse-body.js'
import { logWarn, logError, logInfo } from '../lib/logger.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, docName, source, promoCode } = req.body
  // source: 'preview' = not yet paid, 'purchase' = just paid (default), 'promo' = used promo code
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logWarn('/capture-buyer', { message: 'RESEND_API_KEY not set', email })
    return res.status(200).json({ ok: true })
  }

  const isPreview = source === 'preview'
  const isPromo = source === 'promo'

  try {
    // 1. Notify founder
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Signova <info@getsignova.com>',
        to: ['info@ebenova.net'],
        subject: isPromo
          ? `🌟 Promo lead captured [${promoCode}]: ${email}`
          : isPreview
          ? `📧 Preview lead captured: ${email}`
          : `💰 Buyer email captured: ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="color:#c9a84c;">${isPromo ? `Promo lead — code: ${promoCode}` : isPreview ? 'New preview lead' : 'New buyer email captured'}</h2>
            <p style="font-size:20px;font-weight:bold;color:#111;">${email}</p>
            <p style="color:#666;font-size:14px;">
              Document: <strong>${docName || 'Unknown'}</strong><br/>
              ${isPromo ? `Used promo code ${promoCode}. Free user — market Signova Pro + Scope Guard to them.` : isPreview ? 'This person previewed but did not pay. Follow up opportunity.' : "This person is a paying customer. They're your hottest Pro lead."}
            </p>
          </div>
        `,
      }),
    })

    // 2. Send user email based on source
    if (isPromo) {
      // Promo user: send the same checklist as buyers + Scope Guard teaser
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Signova <info@getsignova.com>',
          to: [email],
          subject: `Your free ${docName || 'document'} is ready — plus 5 tips to protect it`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0e0e0e;color:#f0ece4;">
              <div style="margin-bottom:24px;"><div style="display:inline-flex;align-items:center;gap:10px;"><div style="width:32px;height:32px;border-radius:8px;background:#c9a84c;color:#0e0e0e;font-size:18px;font-weight:700;text-align:center;line-height:32px;">S</div><span style="font-size:18px;font-weight:600;">Signova</span></div></div>
              <h2 style="color:#c9a84c;font-size:20px;margin-bottom:8px;">Your document is downloaded. Here's how to make it stick.</h2>
              <p style="color:#9a9690;font-size:14px;line-height:1.7;margin-bottom:20px;">You used a community code to get your <strong style="color:#f0ece4;">${docName || 'document'}</strong> for free. Here's what to do next.</p>
              <div style="background:#161616;border-radius:10px;padding:16px 20px;margin-bottom:10px;"><p style="margin:0 0 4px;color:#c9a84c;font-weight:700;font-size:12px;">✓ Step 1</p><p style="margin:0;color:#f0ece4;font-size:13px;line-height:1.6;"><strong>Get both signatures before any work starts.</strong> An unsigned contract protects nobody.</p></div>
              <div style="background:#161616;border-radius:10px;padding:16px 20px;margin-bottom:10px;"><p style="margin:0 0 4px;color:#c9a84c;font-weight:700;font-size:12px;">✓ Step 2</p><p style="margin:0;color:#f0ece4;font-size:13px;line-height:1.6;"><strong>Send scope changes in writing, always.</strong> If a client asks for extra work verbally, reply by email first.</p></div>
              <div style="background:#161616;border-radius:10px;padding:16px 20px;margin-bottom:10px;"><p style="margin:0 0 4px;color:#c9a84c;font-weight:700;font-size:12px;">✓ Step 3</p><p style="margin:0;color:#f0ece4;font-size:13px;line-height:1.6;"><strong>Save the original brief.</strong> Screenshot every instruction before you start — that's your evidence.</p></div>
              <div style="background:#1a1500;border:1px solid #c9a84c33;border-radius:10px;padding:16px 20px;margin-bottom:24px;"><p style="margin:0 0 6px;color:#c9a84c;font-weight:700;font-size:12px;">Coming soon — Signova Pro</p><p style="margin:0;color:#9a9690;font-size:12px;line-height:1.5;">Paste any client message and instantly know if it violates your contract — plus a ready-to-send professional response. We'll email you when it launches.</p></div>
              <p style="color:#9a9690;font-size:13px;">Need another document? <a href="https://getsignova.com" style="color:#c9a84c;">getsignova.com</a></p>
              <hr style="border:none;border-top:1px solid #2a2a2a;margin:24px 0;"/>
              <p style="color:#5a5754;font-size:11px;">Signova · Ebenova Solutions · <a href="mailto:hello@getsignova.com" style="color:#5a5754;">hello@getsignova.com</a></p>
            </div>
          `,
        }),
      })
      return res.status(200).json({ ok: true })
    }

    if (isPreview) {
      // Pre-purchase: "Your document is waiting" nudge email
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Signova <info@getsignova.com>',
          to: [email],
          subject: `Your ${docName || 'document'} is ready — complete your download`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#0e0e0e;color:#f0ece4;">
              <div style="margin-bottom:28px;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <div style="width:32px;height:32px;border-radius:8px;background:#c9a84c;color:#0e0e0e;font-size:18px;font-weight:700;text-align:center;line-height:32px;">S</div>
                  <span style="font-size:18px;font-weight:600;">Signova</span>
                </div>
              </div>
              <h2 style="color:#c9a84c;font-size:20px;margin-bottom:8px;">Your document is still waiting</h2>
              <p style="color:#9a9690;font-size:14px;line-height:1.7;margin-bottom:24px;">
                You generated a <strong style="color:#f0ece4;">${docName || 'document'}</strong> on Signova and previewed it. It only needs one more step.
              </p>
              <div style="background:#1a1500;border:1px solid #c9a84c55;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
                <p style="margin:0 0 6px;color:#c9a84c;font-weight:700;font-size:13px;">One payment. Yours forever.</p>
                <p style="margin:0;color:#9a9690;font-size:13px;line-height:1.6;">Pay $4.99 (or ₦7,400) once and download a clean, watermark-free PDF immediately. No account. No subscription. No auto-charge.</p>
              </div>
              <a href="https://www.getsignova.com" style="display:inline-block;background:#c9a84c;color:#0e0e0e;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;margin-bottom:24px;">Complete my download →</a>
              <p style="color:#9a9690;font-size:13px;line-height:1.7;">
                Your document will regenerate fresh when you return. Takes under 30 seconds.
              </p>
              <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0;" />
              <p style="color:#5a5754;font-size:11px;">Signova · Ebenova Solutions · <a href="mailto:hello@getsignova.com" style="color:#5a5754;">hello@getsignova.com</a></p>
            </div>
          `,
        }),
      })
      return res.status(200).json({ ok: true })
    }

    // Post-purchase: send the Scope Guard checklist (value-add email)
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
    logError('/capture-buyer', { message: err.message, stack: err.stack })
    res.status(200).json({ ok: true })
  }
}
