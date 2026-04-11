/**
 * Geo-IP endpoint for Signova
 * Uses Vercel's built-in geo headers (free, unlimited)
 * Falls back to ipapi.co if not on Vercel
 * 
 * Cache: 1 hour (country doesn't change often)
 */

export const config = {
  runtime: 'edge',
}

// Cache per country in memory (Vercel Edge runtime supports this)
const cache = new Map()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export default async function geoHandler(req) {
  // Determine country from Vercel geo headers (only available on Vercel)
  const vercelGeo = req.headers.get('x-vercel-ip-country')
  const countryKey = vercelGeo || 'unknown'

  // Check cache for this specific country
  const cached = cache.get(countryKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cached.data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  try {
    if (vercelGeo) {
      const data = {
        country_code: vercelGeo,
        country_name: req.headers.get('x-vercel-ip-country-name') || vercelGeo,
        city: req.headers.get('x-vercel-ip-city') || '',
        region: req.headers.get('x-vercel-ip-region') || '',
      }

      cache.set(countryKey, { data, timestamp: Date.now() })

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Fallback to ipapi.co (rate-limited, but cached)
    const forwarded = req.headers.get('x-forwarded-for') || ''
    const ip = forwarded.split(',')[0].trim()
    
    if (ip && ip !== '::1' && !ip.startsWith('127.') && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: { 'Accept': 'application/json' },
      })
      
      if (res.ok) {
        const data = await res.json()
        const fallbackKey = data.country_code || countryKey
        cache.set(fallbackKey, { data, timestamp: Date.now() })

        return new Response(JSON.stringify(data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      }
    }

    // No geo data available (localhost or blocked)
    return new Response(JSON.stringify({ error: 'Geo data unavailable' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Geo lookup failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
