// lib/cors-middleware.js
// Centralized CORS headers and OPTIONS handling for all API routes.
//
// ALLOWED_ORIGINS is an allowlist of trusted origins. In production this should
// be set via the CORS_ALLOWED_ORIGINS env var (comma-separated list).
// Wildcard '*' is intentionally NOT used on endpoints that handle auth or payments.
//
// Usage in any handler:
//   import { applyCorsHeaders, handleOptions } from '../../lib/cors-middleware.js'
//   export default async function handler(req, res) {
//     applyCorsHeaders(req, res)
//     if (handleOptions(req, res)) return
//     // ... rest of handler

const DEFAULT_ORIGINS = [
  'https://www.getsignova.com',
  'https://getsignova.com',
  'https://www.ebenova.dev',
  'https://ebenova.dev',
  'https://api.ebenova.dev',
]

function getAllowedOrigins() {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  if (envOrigins) return envOrigins.split(',').map(o => o.trim()).filter(Boolean)
  return DEFAULT_ORIGINS
}

export function applyCorsHeaders(req, res) {
  const allowedOrigins = getAllowedOrigins()
  const requestOrigin = req.headers['origin'] || ''

  // Reflect the origin if it is on the allowlist, otherwise omit the header
  // (browser will block it, non-browser API clients that omit Origin are unaffected)
  if (allowedOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}
