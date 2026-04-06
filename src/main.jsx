import { StrictMode, lazy, Suspense, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Lazy imports at module level — required by React
const VercelAnalytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })))
const VercelSpeedInsights = lazy(() => import('@vercel/speed-insights/react').then(m => ({ default: m.SpeedInsights })))

// Only load analytics after 3s delay
function AnalyticsWrapper() {
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShouldLoad(true), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!shouldLoad) return null
  return (
    <Suspense fallback={null}>
      <VercelAnalytics />
      <VercelSpeedInsights />
    </Suspense>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <App />
          <AnalyticsWrapper />
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  </StrictMode>,
)
