// Preview page — v2 PDF renderer with blurred locked section
import DOMPurify from 'dompurify'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { Helmet } from 'react-helmet-async'
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
  const [promoToken, setPromoToken] = useState(null)
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoMsg, setPromoMsg] = useState('')
  const [promoError, setPromoError] = useState('')
  const [promoOpen, setPromoOpen] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [promoEmail, setPromoEmail] = useState('')
  // eslint-disable-next-line no-unused-vars
  const [promoEmailSubmitted, setPromoEmailSubmitted] = useState(false)
  const [promoEmailLoading, setPromoEmailLoading] = useState(false)
  const [pendingPromoUnlock, setPendingPromoUnlock] = useState(false)
  const contentRef = useRef(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('signova_doc')
    if (!raw) { navigate('/'); return }
    const parsed = JSON.parse(raw)
    setDoc(parsed)
    trackPreviewLoaded(parsed.docType)
    window.scrollTo(0, 0)
  }, [])

  // Show pre-purchase capture after 20 seconds — user is warm but hasn't paid
  useEffect(() => {
    if (paid) return
    const t = setTimeout(() => setShowPreCapture(true), 20000)
    return () => clearTimeout(t)
  }, [paid])

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

    // Mobile browsers (iOS Safari) often block window.open in async context
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      // Fallback: download as HTML file
      const blob = new Blob([fullHtml], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.docName.replace(/\s+/g, '_')}_Signova.html`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    printWindow.document.write(fullHtml)
    printWindow.document.close()
    // Small delay to ensure styles are applied before print dialog opens
    setTimeout(() => printWindow.print(), 500)
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
          email: buyerEmail || '',
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

  const handlePromoApply = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    setPromoError('')
    setPromoMsg('')
    try {
      const res = await fetch('/api/promo-redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode, docType: doc?.docType, docName: doc?.docName }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setPromoError(data.error || 'Invalid promo code.')
      } else {
        // Verify the token server-side before unlocking — prevents client-side bypass
        const verifyRes = await fetch('/api/promo-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: data.token }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyRes.ok || !verifyData.valid) {
          setPromoError(verifyData.error || 'Code could not be verified. Please try again.')
        } else {
          setPromoToken(data.token)
          setPromoMsg(data.message)
          trackPromoApplied(doc?.docType, promoCode)
          setPaid(true)

          // ── Trigger Claude Sonnet regeneration for premium quality ──
          // The user unlocked via promo — regenerate with Anthropic instead of Llama preview
          try {
            const storedDoc = sessionStorage.getItem('signova_doc')
            if (storedDoc) {
              const parsed = JSON.parse(storedDoc)
              if (parsed.prompt) {
                setPromoMsg('Unlocked! Regenerating premium version…')
                const regenRes = await fetch('/api/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: parsed.prompt,
                    promoToken: data.token,
                  }),
                })
                if (regenRes.ok) {
                  const regenData = await regenRes.json()
                  if (regenData.text) {
                    setDoc(prev => ({ ...prev, content: regenData.text }))
                    // Update sessionStorage with premium content
                    sessionStorage.setItem('signova_doc', JSON.stringify({
                      ...parsed,
                      content: regenData.text,
                      isPremium: true,
                    }))
                    setPromoMsg('✓ Premium document ready — powered by Claude Sonnet')
                  }
                } else {
                  // Regeneration failed — user still has unlocked preview, don't revert
                  if (DEV) console.error('Promo regeneration failed:', regenRes.status)
                  setPromoMsg(data.message + ' (preview version — regeneration unavailable)')
                }
              }
            }
          } catch (regenErr) {
            // Graceful fallback: user keeps unlocked preview, log the error
            if (DEV) console.error('Promo regeneration error:', regenErr)
            setPromoMsg(data.message + ' (preview version)')
          }
        }
      }
    } catch {
      setPromoError('Could not apply code. Please try again.')
    } finally {
      setPromoLoading(false)
    }
  }

  const handlePromoEmailCapture = async () => {
    if (!promoEmail || !promoEmail.includes('@')) return
    setPromoEmailLoading(true)
    try {
      await fetch('/api/capture-buyer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: promoEmail,
          docName: doc?.docName,
          source: 'promo',
          promoCode: promoCode,
        }),
      })
    } catch {
      // Ignore capture errors
    }
    setPromoEmailSubmitted(true)
    setPromoEmailLoading(false)
    setPendingPromoUnlock(false)
    setPaid(true)
  }

  const handlePromoSkipEmail = () => {
    // Allow skip but still unlock — we tried to capture
    setPendingPromoUnlock(false)
    setPaid(true)
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
              🔒 Preview — showing first 40% of your document
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
                      <div className="locked-icon">🔒</div>
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
              <span className="proof-badge">🎯</span>
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
                      📧 Not ready to pay?
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
                  💱 {effectiveCurrency.code === 'USD' ? '$4.99 USD' : `${effectiveCurrency.symbol}${effectiveCurrency.amount.toLocaleString()} ${effectiveCurrency.code}`}
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
            {/* Promo code — hidden behind toggle so it doesn't distract the pay button */}
            {!paid && (
              <div className="promo-box">
                {!promoOpen ? (
                  <button className="promo-toggle" onClick={() => setPromoOpen(true)}>
                    Have a promo code?
                  </button>
                ) : (
                  <>
                    <div className="promo-row">
                      <input
                        className="promo-input"
                        type="text"
                        placeholder="Promo code"
                        value={promoCode}
                        autoFocus
                        onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); setPromoMsg('') }}
                        onKeyDown={e => e.key === 'Enter' && handlePromoApply()}
                      />
                      <button className="promo-btn" onClick={handlePromoApply} disabled={promoLoading}>
                        {promoLoading ? '…' : 'Apply'}
                      </button>
                    </div>
                    {promoMsg && <div className="promo-success">{promoMsg}</div>}
                    {promoError && <div className="promo-error">{promoError}</div>}
                  </>
                )}
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
                {/* Post-purchase email capture */}
                {!emailSubmitted ? (
                  <div className="buyer-capture">
                    <p className="buyer-capture-label">
                      📋 Get your free checklist
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
                    <button
                      className="btn-pay-full btn-pay-secondary"
                      onClick={handlePaystackCheckout}
                      disabled={paying}
                    >
                      {paying
                        ? <><span className="spinner-sm" /> Processing…</>
                        : <>💳 Pay {effectiveCurrency.symbol}{effectiveCurrency.amount.toLocaleString()} with Nigerian Card →</>
                      }
                    </button>
                    <p className="usdt-sub">GTBank · Access · FirstBank · UBA · Kuda · All Nigerian debit cards</p>
                    <div className="usdt-divider"><span>or pay with crypto</span></div>
                    <button
                      className="btn-usdt btn-usdt-primary"
                      onClick={handleUsdtCheckout}
                      disabled={payingUsdt}
                    >
                      {payingUsdt
                        ? <><span className="spinner-sm" /> Preparing invoice…</>
                        : <>⬡ Pay {effectiveCurrency.symbol}{effectiveCurrency.amount.toLocaleString()} in USDT / Crypto →</>}
                    </button>
                    <p className="usdt-sub">USDT · USDC · TRC20 · BEP20 · Works with Binance, Myaza & all African crypto wallets</p>
                    <div className="usdt-divider"><span>or try international card</span></div>
                    <button className="btn-pay-full btn-pay-secondary" onClick={handleDownload} disabled={paying}>
                      {paying
                        ? <><span className="spinner-sm" /> Processing…</>
                        : <>🌍 Pay $4.99 USD by Card →</>
                      }
                    </button>
                    <div className="trust-badge">🔒 SSL encrypted · Secure checkout · Instant delivery</div>
                    <p className="trust-line">🔒 Secure checkout · Instant delivery · No account needed</p>
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
                    <p className="trust-line">🔒 SSL secure · No account · Instant PDF · 30-day refund</p>
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
              'privacy-policy': { id: 'terms-of-service', label: 'Terms of Service', icon: '📋', reason: 'Every app needs both.' },
              'terms-of-service': { id: 'privacy-policy', label: 'Privacy Policy', icon: '🔒', reason: 'Required alongside Terms of Service.' },
              'nda': { id: 'freelance-contract', label: 'Freelance Contract', icon: '✍️', reason: 'Protect scope and payment too.' },
              'freelance-contract': { id: 'nda', label: 'NDA', icon: '🤝', reason: 'Protect your ideas before the project.' },
              'tenancy-agreement': { id: 'quit-notice', label: 'Quit Notice', icon: '📦', reason: 'Ready if you ever need it.' },
              'loan-agreement': { id: 'payment-terms-agreement', label: 'Payment Terms', icon: '💳', reason: 'Document the repayment schedule too.' },
              'business-partnership': { id: 'nda', label: 'NDA', icon: '🤝', reason: 'Protect confidential info before you start.' },
              'consulting-agreement': { id: 'nda', label: 'NDA', icon: '🤝', reason: 'Standard companion for consulting work.' },
              'employment-offer-letter': { id: 'non-compete-agreement', label: 'Non-Compete', icon: '🚫', reason: 'Protect your business from day one.' },
            }
            const c = companions[doc.docType]
            if (!c) return null
            return (
              <div className="sidebar-companion">
                <p className="companion-reason">📎 You'll also need</p>
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
