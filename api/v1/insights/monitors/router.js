// api/v1/insights/monitors/router.js
// Routes GET → list.js, POST → create.js for /v1/insights/monitors
// Vercel can't route by HTTP method in rewrites alone, so this router handles it.

import listHandler from './list.js'
import createHandler from './create.js'

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    return listHandler(req, res)
  }
  if (req.method === 'POST') {
    return createHandler(req, res)
  }
  res.setHeader('Allow', 'GET, POST, OPTIONS')
  return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST' } })
}
