/* eslint no-unused-vars: off */
import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect } from 'react'

const Landing    = lazy(() => import('./pages/Landing'))
const ApiLanding = lazy(() => import('./pages/ApiLanding'))
const Generator  = lazy(() => import('./pages/Generator'))
const Preview    = lazy(() => import('./pages/Preview'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage  = lazy(() => import('./pages/TermsPage'))
const BlogIndex  = lazy(() => import('./pages/blog/BlogIndex'))
const BlogPost   = lazy(() => import('./pages/blog/BlogPost'))
const AdminPage  = lazy(() => import('./pages/AdminPage'))
const NDALanding = lazy(() => import('./pages/NDALanding'))
const TenancyLanding = lazy(() => import('./pages/TenancyLanding'))
const DocLanding = lazy(() => import('./pages/DocLanding'))
const WhatsApp = lazy(() => import('./pages/WhatsApp'))
const NotFound = lazy(() => import('./pages/NotFound'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const Docs      = lazy(() => import('./pages/Docs'))
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const GetStarted  = lazy(() => import('./pages/GetStarted'))
const PricingPage = lazy(() => import('./pages/PricingPage'))
const ScopeGuard  = lazy(() => import('./pages/ScopeGuard'))
const Vigil             = lazy(() => import('./pages/VigilLanding'))
const Insights          = lazy(() => import('./pages/Insights'))
const InsightsDashboard = lazy(() => import('./pages/InsightsDashboard'))

function SuspenseFallback() {
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2000)
    return () => clearTimeout(t)
  }, [])
  if (timedOut) {
    return (
      <div style={{ minHeight: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#c8c4bc', fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '16px' }}>Page is taking longer than expected. Please refresh.</p>
        <a href="/" style={{ background: '#c9a84c', color: '#0e0e0e', border: 'none', borderRadius: '8px', padding: '14px 28px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>Back to Signova →</a>
      </div>
    )
  }
  return <div style={{ minHeight: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '32px', height: '32px', border: '3px solid #333', borderTopColor: '#c9a84c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>
}

// Serve the correct root page based on which domain is being visited.
// ebenova.dev  → ApiLanding (the API platform homepage)
// getsignova.com / anything else → Landing (the Signova product homepage)
function isEbenovaDomain() {
  const hostname = window.location.hostname
  return hostname === 'ebenova.dev'
    || hostname === 'www.ebenova.dev'
    || hostname === 'api.ebenova.dev'
}

function RootPage() {
  return isEbenovaDomain() ? <ApiLanding /> : <Landing />
}

// /insights + /insights/dashboard belong to ebenova.dev only — show 404 on getsignova.com
function InsightsPage() {
  return isEbenovaDomain() ? <Insights /> : <NotFound />
}

function InsightsDashboardPage() {
  return isEbenovaDomain() ? <InsightsDashboard /> : <NotFound />
}

export default function App() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <Routes>
        <Route path="/" element={<RootPage />} />
        <Route path="/api" element={<ApiLanding />} />
        <Route path="/generate/:docType" element={<Generator />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/nda-generator" element={<NDALanding />} />
        <Route path="/tenancy-agreement-nigeria" element={<TenancyLanding />} />
        <Route path="/whatsapp" element={<WhatsApp />} />
        {/* About + contact pages */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/team" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/get-started" element={<GetStarted />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/vigil" element={<Vigil />} />
        <Route path="/scope-guard" element={<ScopeGuard />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/insights/dashboard" element={<InsightsDashboardPage />} />
        <Route path="/:slug" element={<DocLanding />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
