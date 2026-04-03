import { StrictMode, lazy, Suspense, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'

// Defer Vercel Analytics and SpeedInsights — load after page is interactive
function DeferredAnalytics() {
  const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })))
  const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))

  return (
    <Suspense fallback={null}>
      <Analytics />
      <SpeedInsights />
    </Suspense>
  )
}

// Only load analytics after 3s delay
function AnalyticsWrapper() {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShouldLoad(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!shouldLoad) return null
  return <DeferredAnalytics />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
        <AnalyticsWrapper />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
