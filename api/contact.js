// api/contact.js — contact form submissions, routed to info@ebenova.net via Resend
import { escapeHtml, escapeHtmlTrunc } from '../lib/sanitize.js'
import { parseBody } from '../lib/parse-body.js'
import { logWarn, logError } from '../lib/logger.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  let body
  try {
    body = await parseBody(req)
  } catch {
    return res.status(400).json({ error: 'Invalid request' })
  }

  const { name, email, subject, message } = body
  if (!email || !email.includes('@') || !message?.trim()) {
    return res.status(400).json({ error: 'Name, email and message are required.' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logWarn('/contact', { message: 'RESEND_API_KEY not set — contact form not sent' })
    return res.status(200).json({ ok: true })
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Signova Contact <info@getsignova.com>',
        to: ['info@ebenova.net'],
        reply_to: email,
        subject: `Signova contact: ${escapeHtmlTrunc(subject, 100) || 'No subject'} — ${escapeHtmlTrunc(name || email, 100)}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;">
            <h2 style="color:#c9a84c;margin-bottom:8px;">New contact form submission</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#666;width:80px;">Name</td><td style="padding:8px 0;font-weight:600;color:#111;">${escapeHtml(name) || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;font-weight:600;color:#111;"><a href="mailto:${escapeHtml(email)}" style="color:#c9a84c;">${escapeHtml(email)}</a></td></tr>
              <tr><td style="padding:8px 0;color:#666;">Subject</td><td style="padding:8px 0;color:#111;">${escapeHtml(subject) || '—'}</td></tr>
            </table>
            <div style="background:#f9f9f9;border-left:3px solid #c9a84c;padding:16px 20px;border-radius:4px;">
              <p style="margin:0;color:#111;line-height:1.7;white-space:pre-wrap;">${escapeHtmlTrunc(message, 5000)}</p>
            </div>
            <p style="color:#999;font-size:12px;margin-top:24px;">Reply directly to this email to reach ${escapeHtml(name || email)}.</p>
          </div>
        `,
      }),
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    logError('/contact', { message: err.message, stack: err.stack })
    res.status(200).json({ ok: true })
  }
}
