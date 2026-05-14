// Vercel Edge Middleware — Light theme A/B test
// This runs on Vercel's Edge Runtime for Vite/SPA deployments.
//
// To START the A/B test:
//   1. Set AB_TEST_THEME_ENABLED=true in Vercel project env vars
//   2. Re-deploy (middleware picks up env vars at build time on edge)
//
// To END the test:
//   1. Set AB_TEST_THEME_ENABLED=false (or delete the var) and re-deploy
//   2. Ship the winning theme as default in index.css :root
//
// Measurement: track `theme=light|dark` query param via Vercel Analytics
// events on preview_started and purchase_completed in the app.
//
// IMPORTANT: In Vercel Edge Middleware, returning `undefined` (bare `return`)
// passes through to the origin. Returning `new Response(null, ...)` serves
// an EMPTY body — which causes a blank page. Never use Response as pass-through.

export const config = {
  matcher: '/',
}

export default function middleware(req) {
  // Gate — only run when explicitly enabled
  if (process.env.AB_TEST_THEME_ENABLED !== 'true') {
    return // pass through to origin
  }

  // Skip if visitor already has a theme assigned
  const cookie = req.headers.get('cookie') || ''
  if (cookie.includes('x-signova-theme=')) {
    return // pass through to origin
  }

  // 50/50 random split — set cookie and pass through
  const theme = Math.random() < 0.5 ? 'light' : 'dark'
  const res = new Response(null, { status: 200 })
  res.headers.set(
    'Set-Cookie',
    `x-signova-theme=${theme}; Path=/; Max-Age=2592000; SameSite=Lax`
  )
  return res
}
