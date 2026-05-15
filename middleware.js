// Vercel Edge Middleware
// Handles two concerns:
//   1. Light theme A/B test (original)
//   2. Bot prerendering — detects crawlers and proxies to Prerender.io
//      so Googlebot, Bingbot, social scrapers see fully-rendered HTML
//      instead of a blank React shell.
//
// ─── PRERENDERING SETUP ────────────────────────────────────────────────────
// 1. Sign up free at https://prerender.io (750 URLs/month free tier)
// 2. Get your token from https://prerender.io/dashboard
// 3. Add to Vercel project env vars:
//      PRERENDER_TOKEN=your_token_here
// 4. Deploy — bots will now receive fully rendered HTML
//
// To verify it's working:
//   curl -A "Googlebot" https://www.getsignova.com/nda-generator
//   Should return full HTML with meta tags, not a blank div#root
//
// ─── A/B TEST SETUP ────────────────────────────────────────────────────────
// Set AB_TEST_THEME_ENABLED=true in Vercel env vars to enable theme A/B test.

export const config = {
  matcher: [
    '/',
    '/nda-generator',
    '/tenancy-agreement-nigeria',
    '/privacy-policy-generator',
    '/terms-of-service-generator',
    '/freelance-contract-generator',
    '/(.*)-generator',
    '/blog/:path*',
    '/generate/:path*',
    '/scope-guard',
    '/about',
    '/pricing',
    '/whatsapp',
  ],
}

// Known search engine and social crawler user-agent patterns
const BOT_AGENTS = [
  'googlebot',
  'google-inspectiontool',
  'bingbot',
  'yandex',
  'baiduspider',
  'facebookexternalhit',
  'twitterbot',
  'whatsapp',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'applebot',
  'duckduckbot',
  'sogou',
  'exabot',
  'ia_archiver',
  'rogerbot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',
  'dotbot',
  'prerender',
]

function isBot(userAgent) {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_AGENTS.some(bot => ua.includes(bot))
}

export default function middleware(req) {
  const url = new URL(req.url)
  const ua = req.headers.get('user-agent') || ''

  // ── 1. Bot prerendering ──────────────────────────────────────────────────
  const token = process.env.PRERENDER_TOKEN
  if (token && isBot(ua)) {
    // Skip already-prerendered requests to avoid infinite loops
    if (req.headers.get('x-prerender-status')) {
      return // pass through
    }
    const prerenderUrl = `https://service.prerender.io/${req.url}`
    return fetch(prerenderUrl, {
      headers: {
        'X-Prerender-Token': token,
        'User-Agent': ua,
      },
    })
  }

  // ── 2. A/B theme test ────────────────────────────────────────────────────
  // Only applies to homepage
  if (url.pathname !== '/') return

  if (process.env.AB_TEST_THEME_ENABLED !== 'true') {
    return // pass through to origin
  }

  const cookie = req.headers.get('cookie') || ''
  if (cookie.includes('x-signova-theme=')) {
    return // pass through to origin
  }

  const theme = Math.random() < 0.5 ? 'light' : 'dark'
  const res = new Response(null, { status: 200 })
  res.headers.set(
    'Set-Cookie',
    `x-signova-theme=${theme}; Path=/; Max-Age=2592000; SameSite=Lax`
  )
  return res
}
