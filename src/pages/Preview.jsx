// Preview page — v2 PDF renderer with blurred locked section
import DOMPurify from 'dompurify'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Lock, Target, EnvelopeSimple, CurrencyCircleDollar, ClipboardText,
  CreditCard, Globe, Handshake, Package, Prohibit, Paperclip, PenNib,
} from '@phosphor-icons/react'

const CICON = { size: 18, weight: 'duotone', color: 'currentColor' }
import {
  trackPreviewLoaded,
  trackPaymentAttempted,
  trackPaymentSuccess,
  trackCompanionClicked,
  trackPromoApplied,
  trackDownloadClicked,
} from '../lib/analytics'
import './Preview.css'

const DEV = import.meta.env.DEV

// Geo detect — same sessionStorage key used by Landing.jsx
const CURRENCY_MAP_PREVIEW = {
  NG: { symbol: '₦', amount: 6900, code: 'NGN' },
  GH: { symbol: 'GH₵', amount: 75, code: 'GHS' },
  KE: { symbol: 'KSh', amount: 650, code: 'KES' },
  ZA: { symbol: 'R', amount: 93, code: 'ZAR' },
  IN: { symbol: '₹', amount: 418, code: 'INR' },
  GB: { symbol: '£', amount: 3.95, code: 'GBP' },
  DE: { symbol: '€', amount: 4.60, code: 'EUR' },
  FR: { symbol: '€', amount: 4.60, code: 'EUR' },
  US: { symbol: '$', amount: 4.99, code: 'USD' },
  CN: { symbol: '¥', amount: 36, code: 'CNY' },
  HK: { symbol: 'HK$', amount: 39, code: 'HKD' },
  JP: { symbol: '¥', amount: 750, code: 'JPY' },
  KR: { symbol: '₩', amount: 6900, code: 'KRW' },
  TH: { symbol: '฿', amount: 175, code: 'THB' },
  TR: { symbol: '₺', amount: 175, code: 'TRY' },
  PL: { symbol: 'zł', amount: 20, code: 'PLN' },
  SE: { symbol: 'kr', amount: 52, code: 'SEK' },
}
const DEFAULT_CURRENCY_PREVIEW = { symbol: '$', amount: 4.99, code: 'USD' }

function useGeoCurrency() {
  const [isNG, setIsNG] = useState(false)
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY_PREVIEW)

  useEffect(() => {
    // Key must match Landing.jsx which writes 'sig_geo'
    const cached = sessionStorage.getItem('sig_geo')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        // sig_geo stores { currency: { code, symbol, amount, local }, countryCode: 'NG' }
        setIsNG(parsed.countryCode === 'NG' || parsed.currency?.code === 'NGN')
        if (parsed.currency) setCurrency(parsed.currency)
      } catch {
        // Ignore JSON parse errors for cached data
      }
      return
    }
    // Use our own API endpoint which leverages Vercel geo headers (free, unlimited)
    fetch('/api/geo')
      .then(r => r.json())
      .then(d => {
        if (d.country_code) {
          setIsNG(d.country_code === 'NG')
          const cur = CURRENCY_MAP_PREVIEW[d.country_code] || DEFAULT_CURRENCY_PREVIEW
          setCurrency(cur)
        }
      })
      .catch(() => {})
  }, [])
  return { isNG, currency }
}

// Simplified currency options for checkout dropdown
const CHECKOUT_CURRENCY_OPTIONS = [
  { code: 'USD', symbol: '$', amount: 4.99, label: 'USD — $4.99' },
  { code: 'NGN', symbol: '₦', amount: 6900, label: 'NGN — ₦6,900 /doc' },
  { code: 'GBP', symbol: '£', amount: 3.95, label: 'GBP — £3.95 /doc' },
  { code: 'EUR', symbol: '€', amount: 4.60, label: 'EUR — €4.60 /doc' },
  { code: 'GHS', symbol: 'GH₵', amount: 75, label: 'GHS — GH₵75 /doc' },
]




export default function Preview() {
  const navigate = useNavigate()
  const { isNG: isNigeria, currency: geoCurrency } = useGeoCurrency()
  const [activeCurrency, setActiveCurrency] = useState(null) // null = use geo
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const effectiveCurrency = activeCurrency || geoCurrency
  const [doc, setDoc] = useState(null)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [payingUsdt, setPayingUsdt] = useState(false)
  const [buyerEmail, setBuyerEmail] = useState('')
  // Shown inline when Paystack checkout needs an email we don't have yet
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [showIntlCard, setShowIntlCard] = useState(false)
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [preEmail, setPreEmail] = useState('')
  const [preEmailSubmitted, setPreEmailSubmitted] = useState(false)
  const [preEmailLoading, setPreEmailLoading] = useState(false)
  const [lockedEmail, setLockedEmail] = useState('')
  const [lockedEmailSubmitted, setLockedEmailSubmitted] = useState(false)
  const [lockedEmailLoading, setLockedEmailLoading] = useState(false)
  const [showPreCapture, setShowPreCapture] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')
  const [promoError, setPromoError] = useState('')
  const [promoOpen, setPromoOpen] = useState(false)
  // Held across the full promo-redeem → /api/generate regen cycle so the
  // "Regenerate premium version" retry button can re-submit with the same
  // verified HMAC token without asking the user to enter the code again.
  const [premiumRegenFailed, setPremiumRegenFailed] = useState(false)
  const [premiumRegenLoading, setPremiumRegenLoading] = useState(false)
  const [lastPromoTokenForRegen, setLastPromoTokenForRegen] = useState(null)
  const contentRef = useRef(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('signova_doc')
    if (!raw) { navigate('/'); return }
    const parsed = JSON.parse(raw)
    setDoc(parsed)
    trackPreviewLoaded(parsed.docType)
    window.scrollTo(0, 0)

    // Promo code carry-through: accept ?promo=XXX in the URL (or picked up
    // from sessionStorage if the upstream /generate step saved it) so
    // targeted share-links like getsignova.com/nda-generator?promo=ROSEMARY
    // auto-populate the promo field. User can still edit / remove before
    // clicking Apply — we don't auto-apply, to keep the action explicit.
    try {
      const params = new URLSearchParams(window.location.search)
      const urlPromo = params.get('promo') || params.get('code')
      const storedPromo = sessionStorage.getItem('signova_promo')
      const pre = (urlPromo || storedPromo || '').toUpperCase().trim()
      if (pre) {
        setPromoCode(pre)
        sessionStorage.setItem('signova_promo', pre)
      }
    } catch { /* ignore malformed URL */ }
  }, [])

  // Pre-purchase email popup removed — it interrupted users mid-decision
  // (20s after landing on Preview) and measurably increased bounce.
  // The state + JSX is retained (referenced by setShowPreCapture below)
  // but never activates, so the popup never renders.

  const handlePreCapture = async () => {
    if (!preEmail || !preEmail.includes('@')) return
    setPreEmailLoading(true)
    try {
      await fetch('/api/capture-buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: preEmail, docName: doc?.docName, source: 'preview' }),
      })
    } catch {
      // Ignore capture errors
    }
    setPreEmailSubmitted(true)
    setPreEmailLoading(false)
  }

  const handleLockedEmailCapture = async () => {
    if (!lockedEmail || !lockedEmail.includes('@')) return
    setLockedEmailLoading(true)
    try {
      await fetch('/api/capture-buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lockedEmail, docName: doc?.docName, source: 'locked_overlay' }),
      })
    } catch {
      // Ignore capture errors
    }
    setLockedEmailSubmitted(true)
    setLockedEmailLoading(false)
  }

  const handleDownload = async () => {
    if (paid) { downloadPDF(); return }
    setPaying(true)
    setError('')
    trackPaymentAttempted(doc?.docType, 'card')
    const payingTimer = setTimeout(() => setPaying(false), 8000)
    try {
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType: doc.docType, docName: doc.docName }),
      })
      if (!res.ok) throw new Error('Could not start checkout. Please try again.')
      const { url } = await res.json()
      clearTimeout(payingTimer)
      window.location.href = url
    } catch (e) {
      clearTimeout(payingTimer)
      setError(e.message)
      setPaying(false)
    }
  }

  const markdownToHtml = (md) => {
    // Process line by line for proper heading and paragraph handling
    const lines = md.split('\n')
    let html = ''
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      // Bold
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Headings — strip # prefix and render as styled headings
      if (line.startsWith('#### ')) { html += `<h4>${line.slice(5)}</h4>`; continue }
      if (line.startsWith('### '))  { html += `<h3>${line.slice(4)}</h3>`; continue }
      if (line.startsWith('## '))   { html += `<h2>${line.slice(3)}</h2>`; continue }
      if (line.startsWith('# '))    { html += `<h1>${line.slice(2)}</h1>`; continue }
      // Horizontal rule
      if (line.trim() === '---' || line.trim() === '***') { html += '<hr>'; continue }
      // Empty line → spacer
      if (!line.trim()) { html += '<div class="spacer"></div>'; continue }
      // Regular paragraph
      html += `<p>${line}</p>`
    }
    return html
  }

  const downloadPDF = async () => {
    const content = doc.content
    const htmlBody = markdownToHtml(content)

    const docStyles = `
      body { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.8; color: #111; max-width: 680px; margin: 48px auto; padding: 0 48px; }
      h1 { font-size: 16pt; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; margin: 32px 0 16px; }
      h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 28px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
      h3 { font-size: 11pt; font-weight: bold; margin: 20px 0 6px; }
      h4 { font-size: 11pt; font-weight: bold; font-style: italic; margin: 16px 0 4px; }
      p  { margin: 0 0 10px; text-align: justify; }
      hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
      .spacer { height: 8px; }
      strong { font-weight: bold; }
      .doc-header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #111; }
      .doc-header h1 { border: none; margin: 0; }
      .doc-header .subtitle { font-size: 9pt; color: #555; margin-top: 4px; }
      .footer { margin-top: 60px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 8pt; color: #888; text-align: center; }
      @media print {
        body { margin: 0; padding: 32px 48px; }
        h2 { page-break-after: avoid; }
        p  { orphans: 3; widows: 3; }
      }
    `

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${doc.docName} — Signova</title>
  <style>${docStyles}</style>
</head>
<body>
  <div class="doc-header">
    <h1>${doc.docName}</h1>
    <div class="subtitle">Generated by Signova · getsignova.com</div>
  </div>
  ${htmlBody}
  <div class="footer">
    This document was generated by Signova (getsignova.com) · For legal advice, consult a qualified attorney.
  </div>
</body>
</html>`

    // Fire-and-forget download analytics so support can verify that a user
    // who redeemed / paid actually reached the download step.
    try {
      fetch('/api/track-download', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType: doc.docType, docName: doc.docName }),
      }).catch(() => {})
    } catch { /* never block the download on telemetry */ }

    // Download strategy (replaces the hidden-iframe approach from PR #17):
    //
    // PR #17 attempted to use a hidden iframe + iframe.contentWindow.print()
    // to avoid mobile popup blockers. Problem discovered post-ship: most
    // browsers, when print() is called on a 0x0 iframe, fall back to
    // printing the PARENT WINDOW (the entire Signova Preview page, with its
    // React shell and sidebar) instead of the iframe's content. Users got
    // a PDF of the page, not the document — even the content was missing
    // from the save because the doc-content div renders empty while regen
    // is in flight.
    //
    // This version: use window.open (works reliably on desktop because this
    // call happens synchronously inside the onClick handler — user-gesture
    // origin means the popup is not blocked). If window.open returns null
    // (mobile popup blocker actually fires, or pop-ups disabled), fall back
    // to downloading the full HTML as a .html file the user can open +
    // Share → Print → Save as PDF. That fallback is uglier UX but at least
    // gives the user the actual document content, not the Signova page.
    const printWindow = window.open('', '_blank', 'noopener=no,noreferrer=no')

    if (!printWindow) {
      // Popup was blocked (mobile Safari / strict desktop settings).
      // Download as HTML so the user keeps the actual document content.
      const blob = new Blob([fullHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.docName.replace(/\s+/g, '_')}_Signova.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }

    // Write the full HTML into the new tab and trigger print once loaded.
    // Using document.write + close is the standard pattern here; srcdoc is
    // not available on window.open (that's an iframe-only attribute).
    printWindow.document.open()
    printWindow.document.write(fullHtml)
    printWindow.document.close()

    // Wait for the new window to finish parsing + font loading before
    // firing print(). Using onload (fires once DOM is ready) + a small
    // setTimeout cushion (so webfonts land before print preview captures
    // the page) is the pragmatic pattern that works across Chrome/Safari/
    // Firefox. The cushion was previously 500ms (too tight for slow mobile
    // connections); bumped to 1000ms.
    const triggerPrint = () => {
      try {
        printWindow.focus()
        printWindow.print()
      } catch (err) {
        if (DEV) console.error('Print failed:', err)
      }
    }

    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 1000)
    } else {
      printWindow.onload = () => setTimeout(triggerPrint, 1000)
    }
  }

  const handleEmailCapture = async () => {
    if (!buyerEmail || !buyerEmail.includes('@')) return
    setEmailLoading(true)
    try {
      await fetch('/api/capture-buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: buyerEmail, docName: doc?.docName }),
      })
    } catch {
      // Ignore capture errors
    }
    setEmailSubmitted(true)
    setEmailLoading(false)
  }

  const handleUsdtCheckout = async () => {
    setPayingUsdt(true)
    setError('')
    trackPaymentAttempted(doc?.docType, 'usdt')
    const usdtTimer = setTimeout(() => setPayingUsdt(false), 8000)
    try {
      const res = await fetch('/api/oxapay-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType: doc.docType, docName: doc.docName }),
      })
      if (!res.ok) throw new Error('Could not start USDT payment. Please try again.')
      const { url, trackId } = await res.json()
      sessionStorage.setItem('oxapay_trackId', trackId)
      clearTimeout(usdtTimer)
      window.location.href = url
    } catch (e) {
      clearTimeout(usdtTimer)
      setError(e.message)
      setPayingUsdt(false)
    }
  }

  const handlePaystackCheckout = async () => {
    // Collect email before redirect. Paystack pre-fills its checkout with
    // whatever we send; if we send a placeholder the user sees a confusing
    // 'invalid' page they can't fix. Show the inline buyer-email input
    // (same box used post-purchase) and wait for the user to fill it.
    const trimmedEmail = (buyerEmail || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter your email below first — Paystack sends your receipt there.')
      setShowEmailPrompt(true)
      return
    }
    setPaying(true)
    setError('')
    trackPaymentAttempted(doc?.docType, 'paystack')
    const paystackTimer = setTimeout(() => setPaying(false), 8000)
    try {
      const res = await fetch('/api/paystack-initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: doc.docType,
          docName: doc.docName,
          email: trimmedEmail,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Could not start Paystack payment. Please try again.')
      }
      const { url, reference } = await res.json()
      sessionStorage.setItem('paystack_reference', reference)
      clearTimeout(paystackTimer)
      window.location.href = url
    } catch (e) {
      clearTimeout(paystackTimer)
      setError(e.message)
      setPaying(false)
    }
  }

  // Runs the "regenerate premium version with Claude Sonnet" step. Split out
  // of handlePromoApply so the manual retry button can reuse the same token
  // without asking the user to re-enter the promo code.
  // Returns true on success, false on failure. Never throws.
  const runPremiumRegen = async (token) => {
    setPremiumRegenLoading(true)
    try {
      const storedDoc = sessionStorage.getItem('signova_doc')
      if (!storedDoc) return false
      const parsed = JSON.parse(storedDoc)
      if (!parsed.prompt) return false

      setPromoMsg('Unlocked! Regenerating premium version…')
      const regenRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: parsed.prompt, promoToken: token }),
      })
      if (!regenRes.ok) {
        if (DEV) console.error('Promo regeneration failed:', regenRes.status)
        return false
      }
      const regenData = await regenRes.json()
      if (!regenData.text) return false

      setDoc(prev => ({ ...prev, content: regenData.text }))
      sessionStorage.setItem('signova_doc', JSON.stringify({
        ...parsed,
        content: regenData.text,
        isPremium: true,
      }))
      setPromoMsg('✓ Premium document ready — powered by Claude Sonnet')
      setPremiumRegenFailed(false)
      return true
    } catch (regenErr) {
      if (DEV) console.error('Promo regeneration error:', regenErr)
      return false
    } finally {
      setPremiumRegenLoading(false)
    }
  }

  const handlePromoApply = async () => {
    // Normalize at the input boundary one more time — belt-and-suspenders
    // against browser autofill / paste events that can bypass the onChange
    // handler and leave React state out of sync with the DOM input.
    const normalized = promoCode.trim().toUpperCase()
    if (!normalized) {
      // Previously returned silently — customer reported 'not responding'
      // when the input appeared empty (autofill, premature Apply click, etc.)
      setPromoError('Please enter a promo code.')
      return
    }
    if (!doc) {
      // Race on first mount / cleared sessionStorage — server would have
      // returned "Missing docType" with an opaque error. Surface a useful
      // message instead of letting the user stare at "Invalid promo code."
      setPromoError('Document not loaded yet. Please reload the page and try again.')
      return
    }
    setPromoLoading(true)
    setPromoError('')
    setPromoMsg('')
    try {
      const res = await fetch('/api/promo-redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalized, docType: doc.docType, docName: doc.docName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.valid) {
        setPromoError(data.error || `Could not apply code (status ${res.status}).`)
        return
      }
      // Verify the token server-side before unlocking — prevents client-side bypass
      const verifyRes = await fetch('/api/promo-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token }),
      })
      const verifyData = await verifyRes.json().catch(() => ({}))
      if (!verifyRes.ok || !verifyData.valid) {
        setPromoError(verifyData.error || 'Code could not be verified. Please try again.')
        return
      }

      setLastPromoTokenForRegen(data.token)
      setPromoMsg(data.message)
      trackPromoApplied(doc.docType, normalized)
      setPaid(true)

      // Regenerate premium Claude Sonnet version. If it fails, auto-retry
      // ONCE before surfacing the manual "Regenerate premium version →"
      // button — handles transient Anthropic 5xx / Railway restart blips
      // that used to leave the user with a Llama preview download.
      let ok = await runPremiumRegen(data.token)
      if (!ok) {
        if (DEV) console.warn('Premium regen failed on first attempt; auto-retrying once')
        // Brief backoff — give the upstream a moment to recover before retry
        await new Promise(resolve => setTimeout(resolve, 1500))
        ok = await runPremiumRegen(data.token)
      }
      if (!ok) {
        setPremiumRegenFailed(true)
        setPromoMsg(`${data.message} (preview version — tap Regenerate below for the premium Claude Sonnet version)`)
        // Refund the promo counter slot so another user can still claim
        // the code — previously every failed regen permanently burned a
        // maxUses slot. Rollback is single-use per token server-side, so
        // if the user successfully manual-retries later, they still get
        // the doc (counter stays at its refunded value — small accounting
        // give, worth it for the refund-on-failure UX).
        try {
          fetch('/api/promo-rollback', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: data.token }),
          }).catch(() => {})
        } catch { /* never block on rollback */ }
      }
    } catch (err) {
      if (DEV) console.error('Promo apply failed:', err)
      // Previously: generic "Could not apply code. Please try again." —
      // hid every distinct error (network, parse, 5xx) behind one message.
      // Now we tell the user whether it's a network issue vs a server issue
      // so they (and support) know what to try next.
      const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false
      setPromoError(offline
        ? 'You appear to be offline. Check your connection and try again.'
        : 'We couldn\u2019t reach the promo server. Please try again, or email info@ebenova.net if this keeps happening.')
    } finally {
      setPromoLoading(false)
    }
  }

  const handleRegenRetry = async () => {
    if (!lastPromoTokenForRegen) return
    setPromoError('')
    const ok = await runPremiumRegen(lastPromoTokenForRegen)
    if (!ok) {
      setPremiumRegenFailed(true)
      setPromoMsg(prev => prev.includes('Regenerate')
        ? prev
        : 'Couldn\u2019t regenerate. You can try again, or download the preview version now — email info@ebenova.net if you need the premium version.')
    }
  }

  // Check if returning from Polar payment success
  // Verify the payment server-side, then regenerate with Anthropic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // Handle Paystack return
    if (params.get('payment') === 'paystack_success') {
      const reference = sessionStorage.getItem('paystack_reference')
      if (!reference) {
        setError('Payment reference missing. If you paid, please contact info@ebenova.net.')
        return
      }
      const raw = sessionStorage.getItem('signova_doc')
      if (!raw) return
      const savedDoc = JSON.parse(raw)
      setVerifying(true)
      const verifyPaystack = async () => {
        try {
          const verifyRes = await fetch('/api/paystack-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reference }),
          })
          const verifyData = await verifyRes.json()
          if (!verifyRes.ok || !verifyData.verified) {
            setError('Payment not confirmed. If you just paid, wait a moment and refresh. Need help? Email info@ebenova.net.')
            setVerifying(false)
            return
          }
          // Payment verified — regenerate with Anthropic
          if (savedDoc.prompt) {
            try {
              const genRes = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: savedDoc.prompt }),
              })
              if (genRes.ok) {
                const genData = await genRes.json()
                if (genData.text) {
                  const upgraded = { ...savedDoc, content: genData.text, isPremium: true }
                  sessionStorage.setItem('signova_doc', JSON.stringify(upgraded))
                  setDoc(upgraded)
                }
              }
            } catch (genErr) {
              DEV && console.error('Premium regen error:', genErr)
            }
          }
          sessionStorage.removeItem('paystack_reference')
          setTimeout(() => trackPaymentSuccess(savedDoc.docType, 'paystack'), 1500)
          setPaid(true)
          window.history.replaceState({}, '', '/preview')
        } catch (err) {
          DEV && console.error('Paystack verify error:', err)
          setError('Something went wrong verifying your payment. Please contact info@ebenova.net.')
        } finally {
          setVerifying(false)
        }
      }
      verifyPaystack()
      return
    }

    // Handle OxaPay (USDT) return
    if (params.get('payment') === 'oxapay_success') {
      const trackId = sessionStorage.getItem('oxapay_trackId')
      if (!trackId) {
        setError('Payment reference missing. If you paid, please contact info@ebenova.net.')
        return
      }
      const raw = sessionStorage.getItem('signova_doc')
      if (!raw) return
      const savedDoc = JSON.parse(raw)
      setVerifying(true)
      const verifyOxaPay = async () => {
      try {
        const verifyRes = await fetch('/api/oxapay-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackId }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyRes.ok || !verifyData.verified) {
          setError('Payment not confirmed yet. If you just paid, wait a moment and refresh. Need help? Email info@ebenova.net.')
          setVerifying(false)
          return
        }
        // Payment verified — regenerate with Anthropic
        if (savedDoc.prompt) {
          try {
            const genRes = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: savedDoc.prompt, oxapayTrackId: trackId }),
            })
            if (genRes.ok) {
              const genData = await genRes.json()
              if (genData.text) {
                const upgraded = { ...savedDoc, content: genData.text, isPremium: true, trackId }
                sessionStorage.setItem('signova_doc', JSON.stringify(upgraded))
                setDoc(upgraded)
              }
            }
          } catch (genErr) {
            DEV && console.error('Premium regen error:', genErr)
          }
        }
        sessionStorage.removeItem('oxapay_trackId')
        setTimeout(() => trackPaymentSuccess(savedDoc.docType, 'usdt'), 1500)
        setPaid(true)
        window.history.replaceState({}, '', '/preview')
      } catch (err) {
        DEV && console.error('OxaPay verify error:', err)
        setError('Something went wrong verifying your USDT payment. Please contact info@ebenova.net.')
      } finally {
        setVerifying(false)
      }
      }
      verifyOxaPay()
      return
    }

    if (params.get('payment') !== 'success') return

    const sessionId = params.get('session_id')
    if (!sessionId) {
      DEV && console.error('No session_id in return URL')
      setError('Payment could not be verified — missing checkout reference. Please contact info@ebenova.net.')
      return
    }

    const raw = sessionStorage.getItem('signova_doc')
    if (!raw) return
    const savedDoc = JSON.parse(raw)

    setVerifying(true)

    const verifyAndRegenerate = async () => {
      try {
        // Step 1: Verify payment server-side
        const verifyRes = await fetch('/api/stripe-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })

        const verifyData = await verifyRes.json()

        if (!verifyRes.ok || !verifyData.verified) {
          DEV && console.error('Payment verification failed:', verifyData)
          setError('Payment could not be verified. If you were charged, please contact info@ebenova.net with your checkout reference.')
          setVerifying(false)
          return
        }

        // Step 2: Payment verified — regenerate with Anthropic (premium)
        if (savedDoc.prompt) {
          try {
            const genRes = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: savedDoc.prompt, sessionId }),
            })

            if (genRes.ok) {
              const genData = await genRes.json()
              if (genData.text) {
                const upgraded = { ...savedDoc, content: genData.text, isPremium: true, sessionId }
                sessionStorage.setItem('signova_doc', JSON.stringify(upgraded))
                setDoc(upgraded)
              }
            } else {
              DEV && console.warn('Premium regeneration failed, using preview version')
            }
          } catch (genErr) {
            DEV && console.error('Premium regeneration error:', genErr)
            // Still mark as paid — they paid, let them download the preview version
          }
        }

        setTimeout(() => trackPaymentSuccess(savedDoc.docType, 'card'), 1500)
        setPaid(true)
        window.history.replaceState({}, '', '/preview')
      } catch (err) {
        DEV && console.error('Verification error:', err)
        setError('Something went wrong verifying your payment. Please contact info@ebenova.net.')
      } finally {
        setVerifying(false)
      }
    }

    verifyAndRegenerate()
  }, [])

  if (!doc) return (
    <div className="preview-loading">
      <div className="spinner-large" />
      <p>Loading your document…</p>
    </div>
  )

  if (verifying) return (
    <div className="preview-loading">
      <div className="spinner-large" />
      <p>Verifying your payment…</p>
    </div>
  )

  const lines = doc.content.split('\n')
  
  // Show only 40% of lines in preview, blur the rest
  const previewCutoff = paid ? lines.length : Math.floor(lines.length * 0.4)
  const visibleLines = lines.slice(0, previewCutoff)
  const hiddenLines = paid ? [] : lines.slice(previewCutoff)
  const hiddenSectionCount = hiddenLines.filter(l => l.startsWith('## ')).length

  return (
    <div className="preview-page">
      <Helmet>
        <title>Document Preview | Signova</title>
        <meta name="description" content="Preview your AI-generated legal document before downloading." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Nav */}
      <div className="preview-nav">
        <button className="gen-back" onClick={() => navigate('/')}>← Back to home</button>
        <div className="logo">
          <span className="logo-mark">S</span>
          <span className="logo-text">Signova</span>
        </div>
        <div className="preview-nav-right">
          {paid ? (
            <button className="btn-download" onClick={() => { trackDownloadClicked(doc.docType); downloadPDF() }}>
              ⬇ Download PDF
            </button>
          ) : (
            <button className="btn-pay" onClick={handleDownload} disabled={paying}>
              {paying ? <><span className="spinner-sm" /> Processing…</> : <>Download PDF — {effectiveCurrency.code === 'USD' ? '$4.99' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()}`}</>}
            </button>
          )}
        </div>
      </div>

      <div className="preview-layout">
        {/* Document */}
        <div className="preview-doc-wrap">
          {!paid && (
            <div className="preview-watermark-bar">
              <Lock size={14} weight="regular" style={{ verticalAlign: '-2px', marginRight: 6 }} />Preview — showing first 40% of your document
            </div>
          )}
          {paid && (
            <div className="preview-paid-bar">
              ✓ Payment confirmed — your document is ready to download
            </div>
          )}

          <div className={`preview-doc ${!paid ? 'watermarked' : ''}`} ref={contentRef}>
            <div className="doc-content">
              {/* Visible portion */}
              {visibleLines.map((line, i) => {
                if (!line.trim()) return <br key={i} />
                const formatted = DOMPurify.sanitize(line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'), { ALLOWED_TAGS: ['strong', 'em', 'br'], ALLOWED_ATTR: [] })
                if (line.startsWith('# ')) return <h1 key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted.slice(2)) }} />
                if (line.startsWith('## ')) return <h2 key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted.slice(3)) }} />
                if (line.startsWith('### ')) return <h3 key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted.slice(4)) }} />
                return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />
              })}
              
              {/* Blurred/hidden portion with unlock CTA */}
              {!paid && hiddenLines.length > 0 && (
                <div className="preview-locked-section">
                  <div className="locked-blur">
                    {hiddenLines.slice(0, 15).map((line, i) => {
                      if (!line.trim()) return <br key={`blur-${i}`} />
                      const formatted = DOMPurify.sanitize(line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'), { ALLOWED_TAGS: ['strong', 'em', 'br'], ALLOWED_ATTR: [] })
                      if (line.startsWith('## ')) return <h2 key={`blur-${i}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted.slice(3)) }} />
                      if (line.startsWith('### ')) return <h3 key={`blur-${i}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatted.slice(4)) }} />
                      return <p key={`blur-${i}`} dangerouslySetInnerHTML={{ __html: formatted }} />
                    })}
                  </div>
                  <div className="locked-overlay">
                    <div className="locked-content">
                      <div className="locked-icon"><Lock size={32} weight="duotone" /></div>
                      <h3 className="locked-title">
                        {hiddenSectionCount > 0 
                          ? `${hiddenSectionCount} more section${hiddenSectionCount > 1 ? 's' : ''} hidden`
                          : 'Document continues below'
                        }
                      </h3>
                      <p className="locked-desc">
                        The hidden sections contain the obligations, payment terms, termination clauses, dispute resolution, governing law, and the signature block — the parts that actually protect you.
                      </p>
                      <button 
                        className="locked-cta" 
                        onClick={handleDownload}
                        disabled={paying}
                      >
                        {paying
                          ? <><span className="spinner-sm" /> Processing…</>
                          : <>Unlock Full Document — {effectiveCurrency.code === 'USD' ? '$4.99' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()}`}</>
                        }
                      </button>
                      <p className="locked-guarantee">30-day money-back guarantee · Instant download</p>
                      <div className="locked-email-alt">
                        {lockedEmailSubmitted ? (
                          <p className="locked-email-done">✓ Link saved — check your inbox</p>
                        ) : (
                          <>
                            <p className="locked-email-label">Not ready to pay? Save a link to come back.</p>
                            <div className="locked-email-row">
                              <input
                                type="email"
                                className="locked-email-input"
                                placeholder="your@email.com"
                                value={lockedEmail}
                                onChange={e => setLockedEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLockedEmailCapture()}
                              />
                              <button
                                className="locked-email-btn"
                                onClick={handleLockedEmailCapture}
                                disabled={lockedEmailLoading || !lockedEmail.includes('@')}
                              >
                                {lockedEmailLoading ? '…' : 'Save →'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="preview-sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">Your {doc.docName} is ready</h3>

            {/* First paying customer — honest signal */}
            <div className="sidebar-social-proof">
              <span className="proof-badge"><Target size={18} weight="duotone" /></span>
              <p className="proof-text">First paying customer — March 2026. Early access open.</p>
            </div>

            {/* Email capture — prominent, before payment CTA */}
            {!paid && (
              <div className="sidebar-email-capture">
                {lockedEmailSubmitted ? (
                  <div className="email-capture-done">
                    ✓ Link saved — check your inbox
                  </div>
                ) : (
                  <>
                    <p className="email-capture-label">
                      <EnvelopeSimple size={16} weight="regular" style={{ verticalAlign: '-3px', marginRight: 6 }} />Not ready to pay?
                    </p>
                    <p className="email-capture-sub">
                      Get a link to this preview sent to your inbox. Come back anytime.
                    </p>
                    <div className="email-capture-row">
                      <input
                        type="email"
                        className="email-capture-input"
                        placeholder="your@email.com"
                        value={lockedEmail}
                        onChange={e => setLockedEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLockedEmailCapture()}
                      />
                      <button
                        className="email-capture-btn"
                        onClick={handleLockedEmailCapture}
                        disabled={lockedEmailLoading || !lockedEmail.includes('@')}
                      >
                        {lockedEmailLoading ? '…' : 'Send →'}
                      </button>
                    </div>
                    <p className="email-capture-privacy">No spam. Unsubscribe anytime.</p>
                  </>
                )}
              </div>
            )}

            {/* Currency toggle */}
            {!paid && (
              <div className="sidebar-currency-toggle" style={{ position: 'relative', marginBottom: '12px' }}>
                <button
                  className="sidebar-currency-btn"
                  onClick={() => setCurrencyOpen(o => !o)}
                  aria-label="Change currency"
                  title="Change currency"
                >
                  <CurrencyCircleDollar size={16} weight="regular" style={{ verticalAlign: '-3px', marginRight: 6 }} />{effectiveCurrency.code === 'USD' ? '$4.99 USD' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()} ${effectiveCurrency.code}`}
                </button>
                {currencyOpen && (
                  <div className="sidebar-currency-dropdown">
                    {CHECKOUT_CURRENCY_OPTIONS.map(opt => (
                      <button
                        key={opt.code}
                        className={`sidebar-currency-option ${effectiveCurrency.code === opt.code ? 'active' : ''}`}
                        onClick={() => {
                          if (opt.code === geoCurrency.code) {
                            setActiveCurrency(null)
                          } else {
                            setActiveCurrency({ code: opt.code, symbol: opt.symbol, amount: opt.amount })
                          }
                          setCurrencyOpen(false)
                        }}
                      >
                        {opt.label}
                        {opt.code === geoCurrency.code && !activeCurrency && <span className="currency-auto-badge">Auto</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="sidebar-price">
              <span className="price-big">
                {effectiveCurrency.code === 'USD' ? '$4.99' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()}`}
              </span>
              <span className="price-label">
                {effectiveCurrency.code === 'USD'
                  ? 'one-time · instant download'
                  : `≈ $4.99 · one-time · instant download`}
              </span>
            </div>

            {/* Guarantee — prominent, not buried */}
            <div className="sidebar-guarantee">
              <span className="guarantee-icon">✓</span>
              <span>30-day money-back guarantee — no questions asked</span>
            </div>
            {error && <div className="sidebar-error">{error}</div>}
            {/* Promo code — always visible, above payment buttons, so users
                who arrive with a code can't miss it. Real customer (ROSEMARY
                code) clicked the payment button instead of finding the
                hidden toggle, then got confused by Paystack's 'invalid
                link' / 'incomplete email' errors on the wrong flow.
                Showing the input by default adds minor visual weight for
                non-promo users but eliminates the miss-the-toggle failure. */}
            {!paid && (
              <div className="promo-box promo-box-visible">
                <label className="promo-label">
                  Have a promo code?
                </label>
                <div className="promo-row">
                  <input
                    className="promo-input"
                    type="text"
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={e => { setPromoCode(e.target.value.toUpperCase().trimStart()); setPromoError(''); setPromoMsg('') }}
                    onKeyDown={e => e.key === 'Enter' && handlePromoApply()}
                  />
                  <button className="promo-btn" onClick={handlePromoApply} disabled={promoLoading}>
                    {promoLoading ? '…' : 'Apply'}
                  </button>
                </div>
                {promoMsg && <div className="promo-success">{promoMsg}</div>}
                {promoError && <div className="promo-error">{promoError}</div>}
              </div>
            )}
            {/* Promo success message — shown briefly before paid state takes over */}
            {promoMsg && !paid && (
              <div className="promo-success">{promoMsg}</div>
            )}

            {/* Pre-purchase email capture — appears after 20s for non-paying visitors */}
            {!paid && showPreCapture && (
              <div className="pre-capture-box">
                {preEmailSubmitted ? (
                  <div className="pre-capture-done">
                    ✓ Saved — check your inbox for a link to return
                  </div>
                ) : (
                  <>
                    <p className="pre-capture-label">Not ready to pay?</p>
                    <p className="pre-capture-sub">
                      Enter your email and we'll send you a link to come back to this document.
                    </p>
                    <input
                      className="pre-capture-input"
                      type="email"
                      placeholder="your@email.com"
                      value={preEmail}
                      onChange={e => setPreEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handlePreCapture()}
                    />
                    <button
                      className="pre-capture-btn"
                      onClick={handlePreCapture}
                      disabled={preEmailLoading || !preEmail.includes('@')}
                    >
                      {preEmailLoading ? 'Saving…' : 'Save my document →'}
                    </button>
                  </>
                )}
              </div>
            )}

            {paid ? (
              <>
                <button className="btn-download-full" onClick={() => { trackDownloadClicked(doc.docType); downloadPDF() }}>
                  ⬇ Download clean PDF — ready now
                </button>
                {/* Regen retry — shown only when the Claude Sonnet upgrade
                    failed after a promo unlock. Previously the user silently
                    got the Llama preview version and downloaded it thinking
                    it was the premium document. */}
                {premiumRegenFailed && lastPromoTokenForRegen && (
                  <button
                    className="btn-regen-retry"
                    onClick={handleRegenRetry}
                    disabled={premiumRegenLoading}
                  >
                    {premiumRegenLoading
                      ? <><span className="spinner-sm" /> Regenerating premium version…</>
                      : <>✨ Regenerate premium version →</>}
                  </button>
                )}
                {/* Post-purchase email capture */}
                {!emailSubmitted ? (
                  <div className="buyer-capture">
                    <p className="buyer-capture-label">
                      <ClipboardText size={16} weight="regular" style={{ verticalAlign: '-3px', marginRight: 6 }} />Get your free checklist
                    </p>
                    <p className="buyer-capture-sub">
                      5 ways to protect your document after signing — sent to your inbox instantly.
                    </p>
                    <input
                      className="buyer-capture-input"
                      type="email"
                      placeholder="your@email.com"
                      value={buyerEmail}
                      onChange={e => setBuyerEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleEmailCapture()}
                    />
                    <button
                      className="buyer-capture-btn"
                      onClick={handleEmailCapture}
                      disabled={emailLoading || !buyerEmail.includes('@')}
                    >
                      {emailLoading ? 'Sending…' : 'Send me the checklist →'}
                    </button>
                    <p className="buyer-capture-privacy">No spam. Unsubscribe anytime.</p>
                  </div>
                ) : (
                  <div className="buyer-capture-done">
                    ✓ Checklist sent — check your inbox
                  </div>
                )}
              </>
            ) : (
              <>
                {isNigeria ? (
                  // Nigeria: Paystack (local card) first, then crypto, then international card
                  <>
                    {/* Inline email prompt — Paystack requires a real email for the receipt.
                        Only shown when user clicks Paystack without having entered email yet. */}
                    {showEmailPrompt && (
                      <div className="email-prompt-inline">
                        <label className="email-prompt-label">Enter your email for the receipt:</label>
                        <input
                          className="email-prompt-input"
                          type="email"
                          placeholder="your@email.com"
                          value={buyerEmail}
                          onChange={e => setBuyerEmail(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim())) {
                              setShowEmailPrompt(false)
                              setError('')
                              handlePaystackCheckout()
                            }
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                    {/* PRIMARY — Paystack Nigerian card. Gold CTA, can't miss.
                        Nigerian users are here to pay with their Nigerian card
                        the overwhelming majority of the time; give it the biggest
                        visual weight. */}
                    <button
                      className="btn-pay-full"
                      onClick={handlePaystackCheckout}
                      disabled={paying}
                    >
                      {paying
                        ? <><span className="spinner-sm" /> Processing…</>
                        : <><CreditCard size={16} weight="regular" style={{ verticalAlign: '-3px', marginRight: 6 }} />Pay {effectiveCurrency.symbol}{effectiveCurrency.amount.toLocaleString()} with Nigerian Card →</>
                      }
                    </button>
                    <p className="trust-line"><Lock size={12} weight="regular" style={{ verticalAlign: '-1px', marginRight: 4 }} />GTBank · Access · FirstBank · UBA · Kuda · All Nigerian debit cards · Instant delivery</p>

                    {/* SECONDARY — USDT/crypto. Subtle button, same weight as the
                        non-Nigerian USDT option for consistency. */}
                    <div className="sidebar-usdt">
                      <div className="usdt-divider"><span>or pay with crypto</span></div>
                      <button
                        className="btn-usdt"
                        onClick={handleUsdtCheckout}
                        disabled={payingUsdt}
                      >
                        {payingUsdt
                          ? <><span className="spinner-sm" /> Preparing invoice…</>
                          : <>⬡ Pay {effectiveCurrency.symbol}{effectiveCurrency.amount.toLocaleString()} in USDT / Crypto →</>}
                      </button>
                      <p className="usdt-sub">USDT · USDC · TRC20 · BEP20 · Binance, Myaza & all African crypto wallets</p>
                    </div>

                    {/* TERTIARY — International card, hidden behind a disclosure.
                        Useful fallback when Paystack rejects a virtual card etc.,
                        but adds decision paralysis if shown by default. */}
                    {!showIntlCard ? (
                      <button
                        type="button"
                        className="intl-card-toggle"
                        onClick={() => setShowIntlCard(true)}
                      >
                        Having trouble? Try international card →
                      </button>
                    ) : (
                      <>
                        <button className="btn-pay-full btn-pay-secondary" onClick={handleDownload} disabled={paying}>
                          {paying
                            ? <><span className="spinner-sm" /> Processing…</>
                            : <><Globe size={16} weight="regular" style={{ verticalAlign: '-3px', marginRight: 6 }} />Pay $4.99 USD by International Card →</>
                          }
                        </button>
                        <p className="trust-line">Charged in USD · Works with Visa, Mastercard, Amex</p>
                      </>
                    )}
                  </>
                ) : (
                  // Everyone else: card first, crypto below
                  <>
                    <button className="btn-pay-full" onClick={handleDownload} disabled={paying}>
                      {paying
                        ? <><span className="spinner-sm" /> Processing…</>
                        : <>Download full document — {effectiveCurrency.code === 'USD' ? '$4.99' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()}`} →</>
                      }
                    </button>
                    <p className="trust-line"><Lock size={12} weight="regular" style={{ verticalAlign: '-1px', marginRight: 4 }} />SSL secure · No account · Instant PDF · 30-day refund</p>
                    <div className="sidebar-usdt">
                      <div className="usdt-divider"><span>or pay with crypto</span></div>
                      <button
                        className="btn-usdt"
                        onClick={handleUsdtCheckout}
                        disabled={payingUsdt}
                      >
                        {payingUsdt
                          ? <><span className="spinner-sm" /> Preparing invoice…</>
                          : <>⬡ Pay {effectiveCurrency.code === 'USD' ? '$4.99' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()}`} in USDT / Crypto →</>}
                      </button>
                      <p className="usdt-sub">USDT · USDC · TRC20 · BEP20 · Works with Myaza, Binance & all African crypto wallets · Instant confirmation</p>
                    </div>
                  </>
                )}
              </>
            )}
            <ul className="sidebar-perks">
              <li>✓ Clean PDF, no watermark</li>
              <li>✓ Instant download</li>
              <li>✓ Yours to keep forever</li>
            </ul>
          </div>

          {/* Companion doc — context-aware suggestion */}
          {doc && (() => {
            const companions = {
              'privacy-policy': { id: 'terms-of-service', label: 'Terms of Service', icon: <ClipboardText {...CICON} />, reason: 'Every app needs both.' },
              'terms-of-service': { id: 'privacy-policy', label: 'Privacy Policy', icon: <Lock {...CICON} />, reason: 'Required alongside Terms of Service.' },
              'nda': { id: 'freelance-contract', label: 'Freelance Contract', icon: <PenNib {...CICON} />, reason: 'Protect scope and payment too.' },
              'freelance-contract': { id: 'nda', label: 'NDA', icon: <Handshake {...CICON} />, reason: 'Protect your ideas before the project.' },
              'tenancy-agreement': { id: 'quit-notice', label: 'Quit Notice', icon: <Package {...CICON} />, reason: 'Ready if you ever need it.' },
              'loan-agreement': { id: 'payment-terms-agreement', label: 'Payment Terms', icon: <CreditCard {...CICON} />, reason: 'Document the repayment schedule too.' },
              'business-partnership': { id: 'nda', label: 'NDA', icon: <Handshake {...CICON} />, reason: 'Protect confidential info before you start.' },
              'consulting-agreement': { id: 'nda', label: 'NDA', icon: <Handshake {...CICON} />, reason: 'Standard companion for consulting work.' },
              'employment-offer-letter': { id: 'non-compete-agreement', label: 'Non-Compete', icon: <Prohibit {...CICON} />, reason: 'Protect your business from day one.' },
            }
            const c = companions[doc.docType]
            if (!c) return null
            return (
              <div className="sidebar-companion">
                <p className="companion-reason"><Paperclip size={14} weight="regular" style={{ verticalAlign: '-2px', marginRight: 4 }} />You'll also need</p>
                <button className="companion-btn" onClick={() => { trackCompanionClicked(doc.docType, c.id); navigate(`/generate/${c.id}`) }}>
                  <span className="companion-icon">{c.icon}</span>
                  <span>
                    <strong>{c.label}</strong>
                    <span className="companion-sub">{c.reason}</span>
                  </span>
                  <span className="companion-arrow">→</span>
                </button>
              </div>
            )
          })()}

          <div className="sidebar-need-more">
            <p>Building multiple products?</p>
            <strong>Unlimited plan — $9.99/month</strong>
            <p className="need-more-sub">Agencies & freelancers generating docs for clients.</p>
            <button className="btn-unlimited" onClick={() => { navigate('/'); setTimeout(() => { document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }) }, 100) }}>
              View unlimited plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
