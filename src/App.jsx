import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'

const Landing    = lazy(() => import('./pages/Landing'))
const Generator  = lazy(() => import('./pages/Generator'))
const Preview    = lazy(() => import('./pages/Preview'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage  = lazy(() => import('./pages/TermsPage'))
const BlogIndex  = lazy(() => import('./pages/blog/BlogIndex'))
const BlogPost   = lazy(() => import('./pages/blog/BlogPost'))
const AdminPage  = lazy(() => import('./pages/AdminPage'))
const NDALanding = lazy(() => import('./pages/NDALanding'))
const DocLanding = lazy(() => import('./pages/DocLanding'))
const WhatsApp = lazy(() => import('./pages/WhatsApp'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/generate/:docType" element={<Generator />} />
        <Route path="/preview" element={<Preview />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/nda-generator" element={<NDALanding />} />
        <Route path="/whatsapp" element={<WhatsApp />} />
        {/* Common URLs people type — redirect to relevant sections */}
        <Route path="/about" element={<Landing />} />
        <Route path="/contact" element={<Landing />} />
        <Route path="/team" element={<Landing />} />
        <Route path="/pricing" element={<Landing />} />
        <Route path="/:slug" element={<DocLanding />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
