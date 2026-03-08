import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Generator from './pages/Generator'
import Preview from './pages/Preview'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import BlogIndex from './pages/blog/BlogIndex'
import BlogPost from './pages/blog/BlogPost'
import AdminPage from './pages/AdminPage'
import NDALanding from './pages/NDALanding'

export default function App() {
  return (
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
    </Routes>
  )
}
