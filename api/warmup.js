// api/warmup.js
// Called every 5 minutes by Vercel cron to keep serverless functions warm
// Prevents cold starts on critical endpoints

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // Warm up critical endpoints by calling them internally
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const endpoints = [
    '/v1/documents/types',
    '/v1/keys/usage',
  ]

  const results = []
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer sk_warmup_internal`,
        },
      })
      results.push({
        endpoint,
        status: response.status,
        ok: response.ok,
      })
    } catch (err) {
      results.push({
        endpoint,
        status: 0,
        ok: false,
        error: err.message,
      })
    }
  }

  res.status(200).json({
    status: 'warmed',
    timestamp: new Date().toISOString(),
    endpoints: results,
  })
}
