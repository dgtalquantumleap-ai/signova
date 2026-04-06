// lib/sanitize.js
// Server-side HTML escaping for user-supplied content that gets embedded in HTML templates.
// Use this on any field inserted into an email body, HTML response, or rendered template.

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
}

/**
 * Escape HTML special characters in a string.
 * Safe to use inside HTML attribute values and text content.
 * @param {unknown} value - Any value; non-strings are coerced via String().
 * @returns {string} HTML-escaped string.
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"'`]/g, ch => ESCAPE_MAP[ch])
}

/**
 * Escape and truncate a string for use in HTML.
 * Useful for user-supplied subject lines, names, etc.
 * @param {unknown} value
 * @param {number} [maxLength=500]
 * @returns {string}
 */
export function escapeHtmlTrunc(value, maxLength = 500) {
  if (value === null || value === undefined) return ''
  return escapeHtml(String(value).slice(0, maxLength))
}
