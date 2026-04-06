// lib/parse-body.js
// Shared body-parsing middleware for all Vercel serverless API routes.
// Vercel's edge runtime may or may not pre-parse JSON depending on configuration;
// this utility handles both cases transparently.
//
// Usage:
//   import { parseBody } from '../../lib/parse-body.js'
//   const body = await parseBody(req)

/**
 * Parse the request body as JSON.
 * Returns the parsed object if body is already an object (Vercel middleware),
 * otherwise reads the raw stream and parses it.
 * Returns {} on empty or unparseable body.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
 */
export async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}
