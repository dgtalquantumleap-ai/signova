// analytics.js — Signova custom event tracking
// Wraps window.gtag safely so it never throws if GA4 hasn't loaded yet
// Usage: import { track } from '../lib/analytics'
//        track('preview_loaded', { doc_type: 'nda' })

export function track(eventName, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        ...params,
        app: 'signova',
      })
    }
  } catch (e) {
    // Silent fail — never break the UI for analytics
  }
}

// Named events — call these directly across the app

// Homepage — document selected from quick-pick or grid
export const trackDocSelected = (docType, source = 'grid') =>
  track('doc_selected', { doc_type: docType, source })

// Generator — user clicked Generate button
export const trackGenerateStarted = (docType) =>
  track('generate_started', { doc_type: docType })

// Generator — document successfully generated
export const trackGenerateCompleted = (docType) =>
  track('generate_completed', { doc_type: docType })

// Preview — page loaded with a document
export const trackPreviewLoaded = (docType) =>
  track('preview_loaded', { doc_type: docType })

// Preview — user clicked Pay by Card
export const trackPaymentAttempted = (docType, method = 'card') =>
  track('payment_attempted', { doc_type: docType, method })

// Preview — payment verified and confirmed (most important event)
export const trackPaymentSuccess = (docType, method = 'card') =>
  track('payment_success', { doc_type: docType, method, value: 4.99, currency: 'USD' })

// Preview — companion doc suggestion clicked
export const trackCompanionClicked = (fromDoc, toDoc) =>
  track('companion_doc_clicked', { from_doc: fromDoc, to_doc: toDoc })

// Preview — promo code applied
export const trackPromoApplied = (docType, code) =>
  track('promo_applied', { doc_type: docType, code })

// WhatsApp — extraction attempted
export const trackWaExtraction = (docType) =>
  track('wa_extraction_attempted', { doc_type: docType })

// WhatsApp — extraction succeeded, continuing to generator
export const trackWaExtractionSuccess = (docType, fieldCount) =>
  track('wa_extraction_success', { doc_type: docType, field_count: fieldCount })

// Blog — mid-article CTA clicked
export const trackBlogCtaClicked = (slug, docType) =>
  track('blog_cta_clicked', { slug, doc_type: docType })
