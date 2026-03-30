// lib/cors-middleware.js
// Centralized CORS headers and OPTIONS handling for all API routes
// Usage in any handler:
//   import { applyCorsHeaders, handleOptions } from '../../lib/cors-middleware.js'
//   export default async function handler(req, res) {
//     applyCorsHeaders(res)
//     if (handleOptions(req, res)) return
//     // ... rest of handler

export function applyCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
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
