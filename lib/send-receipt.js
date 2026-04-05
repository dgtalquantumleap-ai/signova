// lib/send-receipt.js
// Sends an invoice/receipt HTML via Resend email.
//
// Usage:
//   await sendReceipt({
//     to: 'client@example.com',
//     subject: 'Invoice INV-001 from Alexey Volkov',
//     html: '<!DOCTYPE html>...',
//     invoiceId: 'inv_abc123',
//   })

export async function sendReceipt({ to, subject, html, invoiceId }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_ADDRESS || 'Ebenova <receipts@ebenova.dev>'

  if (!apiKey) {
    console.warn('[send-receipt] RESEND_API_KEY not set — skipping email delivery')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        tags: [
          { name: 'type', value: 'receipt' },
          ...(invoiceId ? [{ name: 'invoice_id', value: invoiceId }] : []),
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[send-receipt] Resend API error:', JSON.stringify(err))
      return { success: false, error: err.message || 'Failed to send receipt' }
    }

    const data = await res.json()
    return { success: true, emailId: data.id }
  } catch (err) {
    console.error('[send-receipt] Fetch error:', err.message)
    return { success: false, error: err.message }
  }
}
