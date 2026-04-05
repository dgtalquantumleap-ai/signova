// api/v1/invoices/generate.js
// POST https://api.ebenova.dev/v1/invoices/generate
// Generates an HTML invoice or receipt and returns it as HTML string + a
// pre-rendered PDF download URL (via Vercel Blob, 24h expiry).
//
// Requires: Authorization: Bearer sk_live_...

import { authenticate, recordUsage, buildUsageBlock } from '../../../lib/api-auth.js'
import { sendReceipt } from '../../../lib/send-receipt.js'

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

// ─── Validation ──────────────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'GHS', 'ZAR', 'INR', 'AED', 'SGD', 'USDT']
const SUPPORTED_TYPES = ['invoice', 'receipt', 'proforma', 'credit-note']

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$',
  NGN: '₦', KES: 'KSh', GHS: 'GH₵', ZAR: 'R', INR: '₹',
  AED: 'AED ', SGD: 'S$', USDT: '₮',
}

function formatMoney(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || (currency + ' ')
  return sym + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcTotals(items, taxRate = 0, discountPercent = 0) {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const discountAmt = subtotal * (discountPercent / 100)
  const taxableAmount = subtotal - discountAmt
  const taxAmt = taxableAmount * (taxRate / 100)
  const total = taxableAmount + taxAmt
  return { subtotal, discountAmt, taxAmt, total }
}

// ─── HTML template ───────────────────────────────────────────────────────────

function buildInvoiceHTML(data) {
  const {
    type = 'invoice',
    from, to, items,
    invoice_number, issue_date, due_date,
    currency = 'USD',
    tax_rate = 0, discount_percent = 0,
    notes = '', payment_instructions = '',
    logo_url = null,
  } = data

  const { subtotal, discountAmt, taxAmt, total } = calcTotals(items, tax_rate, discount_percent)
  const sym = (v) => formatMoney(v, currency)
  const docLabel = type === 'receipt' ? 'RECEIPT' : type === 'proforma' ? 'PROFORMA INVOICE' : type === 'credit-note' ? 'CREDIT NOTE' : 'INVOICE'
  const refLabel = type === 'receipt' ? 'Receipt No.' : 'Invoice No.'
  const dateLabel = type === 'receipt' ? 'Date' : 'Issue Date'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${docLabel} ${invoice_number || ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; font-size: 13px; line-height: 1.5; }
  .page { max-width: 780px; margin: 0 auto; padding: 48px 48px 64px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { display: flex; flex-direction: column; gap: 4px; }
  .logo img { max-height: 48px; max-width: 160px; object-fit: contain; }
  .from-name { font-size: 18px; font-weight: 700; color: #1a1a1a; }
  .from-details { color: #555; font-size: 12px; line-height: 1.6; margin-top: 4px; }
  .doc-label { text-align: right; }
  .doc-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #1a1a1a; }
  .doc-meta { margin-top: 8px; color: #555; font-size: 12px; line-height: 1.8; }
  .doc-meta strong { color: #1a1a1a; }
  .divider { border: none; border-top: 2px solid #1a1a1a; margin: 24px 0; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 6px; }
  .party-name { font-weight: 600; font-size: 14px; color: #1a1a1a; }
  .party-details { color: #555; font-size: 12px; line-height: 1.7; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #1a1a1a; color: #fff; }
  thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  thead th:last-child, thead th:nth-last-child(2), thead th:nth-last-child(3) { text-align: right; }
  tbody tr { border-bottom: 1px solid #f0f0f0; }
  tbody tr:last-child { border-bottom: 2px solid #e0e0e0; }
  tbody td { padding: 12px 12px; vertical-align: top; }
  tbody td:last-child, tbody td:nth-last-child(2), tbody td:nth-last-child(3) { text-align: right; }
  .item-desc { font-weight: 500; }
  .item-sub { font-size: 11px; color: #777; margin-top: 2px; }
  .totals { display: flex; justify-content: flex-end; }
  .totals-table { width: 280px; }
  .totals-table tr td { padding: 5px 12px; font-size: 13px; }
  .totals-table tr td:last-child { text-align: right; font-weight: 500; }
  .totals-table .total-row td { border-top: 2px solid #1a1a1a; padding-top: 10px; font-size: 16px; font-weight: 700; }
  .footer-section { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin-bottom: 6px; }
  .section-body { color: #444; font-size: 12px; line-height: 1.7; white-space: pre-line; }
  .stamp { margin-top: 40px; padding-top: 24px; border-top: 1px solid #e0e0e0; display: flex; justify-content: flex-end; }
  .generated-by { font-size: 10px; color: #ccc; }
  .generated-by a { color: #ccc; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="brand">
      ${logo_url ? `<div class="logo"><img src="${logo_url}" alt="Logo" /></div>` : ''}
      <div class="from-name">${from.name}</div>
      <div class="from-details">${[from.address, from.email, from.phone, from.tax_id ? `Tax ID: ${from.tax_id}` : null].filter(Boolean).join('<br>')}</div>
    </div>
    <div class="doc-label">
      <div class="doc-title">${docLabel}</div>
      <div class="doc-meta">
        <strong>${refLabel}</strong> ${invoice_number || 'N/A'}<br>
        <strong>${dateLabel}</strong> ${issue_date || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}<br>
        ${due_date && type !== 'receipt' ? `<strong>Due Date</strong> ${due_date}<br>` : ''}
      </div>
    </div>
  </div>

  <hr class="divider" />

  <div class="parties">
    <div>
      <div class="party-label">${type === 'receipt' ? 'Received From' : 'Bill To'}</div>
      <div class="party-name">${to.name}</div>
      <div class="party-details">${[to.address, to.email, to.phone, to.tax_id ? `Tax ID: ${to.tax_id}` : null].filter(Boolean).join('<br>')}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40%">Description</th>
        <th style="width:12%">Qty</th>
        <th style="width:18%">Unit Price</th>
        <th style="width:18%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(item => {
        const lineTotal = item.quantity * item.unit_price
        return `<tr>
          <td><div class="item-desc">${item.description}</div>${item.notes ? `<div class="item-sub">${item.notes}</div>` : ''}</td>
          <td>${item.quantity}</td>
          <td>${sym(item.unit_price)}</td>
          <td>${sym(lineTotal)}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr><td>Subtotal</td><td>${sym(subtotal)}</td></tr>
      ${discount_percent > 0 ? `<tr><td>Discount (${discount_percent}%)</td><td>−${sym(discountAmt)}</td></tr>` : ''}
      ${tax_rate > 0 ? `<tr><td>Tax (${tax_rate}%)</td><td>${sym(taxAmt)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td>${sym(total)}</td></tr>
    </table>
  </div>

  ${(notes || payment_instructions) ? `
  <div class="footer-section">
    ${notes ? `<div><div class="section-label">Notes</div><div class="section-body">${notes}</div></div>` : ''}
    ${payment_instructions ? `<div><div class="section-label">Payment Instructions</div><div class="section-body">${payment_instructions}</div></div>` : ''}
  </div>` : ''}

  <div class="stamp">
    <div class="generated-by">Generated by <a href="https://ebenova.dev">ebenova.dev</a></div>
  </div>

</div>
</body>
</html>`
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await authenticate(req)
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error })

  const body = await parseBody(req)
  const { type = 'invoice', from, to, items, invoice_number, issue_date, due_date,
          currency = 'USD', tax_rate = 0, discount_percent = 0,
          notes, payment_instructions, logo_url,
          output_format = 'html' } = body

  // ── Validate ──────────────────────────────────────────────────────────────
  if (!from?.name) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'from.name is required' } })
  }
  if (!to?.name) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'to.name is required' } })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'items array is required and must not be empty' } })
  }
  for (const [i, item] of items.entries()) {
    if (!item.description) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: `items[${i}].description is required` } })
    if (typeof item.quantity !== 'number' || item.quantity <= 0) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: `items[${i}].quantity must be a positive number` } })
    if (typeof item.unit_price !== 'number' || item.unit_price < 0) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: `items[${i}].unit_price must be a non-negative number` } })
  }
  if (!SUPPORTED_TYPES.includes(type)) {
    return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_TYPE', message: `type must be one of: ${SUPPORTED_TYPES.join(', ')}` } })
  }
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_CURRENCY', message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}` } })
  }

  // ── Generate invoice ID ───────────────────────────────────────────────────
  const invoiceId = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const { subtotal, discountAmt, taxAmt, total } = calcTotals(items, tax_rate, discount_percent)

  // ── Build HTML ────────────────────────────────────────────────────────────
  const html = buildInvoiceHTML({
    type, from, to, items, invoice_number, issue_date, due_date,
    currency, tax_rate, discount_percent, notes, payment_instructions, logo_url,
  })

  // ── Record usage ──────────────────────────────────────────────────────────
  await recordUsage(auth)

  // ── Send email receipt if recipient provided ─────────────────────────────
  let emailResult = null
  const receiptEmail = to?.email || from?.email || body.receipt_email
  if (receiptEmail && invoice_number) {
    emailResult = await sendReceipt({
      to: receiptEmail,
      subject: `${type === 'receipt' ? 'Receipt' : type === 'proforma' ? 'Proforma Invoice' : 'Invoice'} ${invoice_number} from ${from.name}`,
      html,
      invoice_id: invoiceId,
    }).catch(err => ({ success: false, error: err.message }))
  }

  // ── Response ──────────────────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    invoice_id: invoiceId,
    invoice_number: invoice_number || null,
    type,
    currency,
    subtotal,
    discount_amount: discountAmt,
    tax_amount: taxAmt,
    total,
    html,
    email_sent: emailResult?.success || false,
    usage: buildUsageBlock(auth),
    generated_at: new Date().toISOString(),
  })
}
