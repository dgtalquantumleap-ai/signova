// src/lib/feedback-config.js
//
// Central config for the "Report an issue with this document" link
// rendered client-side in Preview.jsx. One place to update the
// Formspree endpoint — no other constants live here yet.
//
// Formspree handles intake entirely. There is no server-side handler.
// When the user clicks the link, Formspree opens its form prefilled
// with the doc_id query parameter so reports arrive pre-identified.

export const FEEDBACK_FORM_URL = 'https://formspree.io/f/xvzdwrjw'

/**
 * Build the feedback URL for a given doc_id (e.g. "SIG-CBDB6556").
 * Safe to call with undefined/null — returns the bare form URL.
 */
export function buildFeedbackUrl(docId) {
  if (!docId || typeof docId !== 'string') return FEEDBACK_FORM_URL
  const sep = FEEDBACK_FORM_URL.includes('?') ? '&' : '?'
  return `${FEEDBACK_FORM_URL}${sep}doc_id=${encodeURIComponent(docId)}`
}
