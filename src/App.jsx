import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Generator from './pages/Generator'
import Preview from './pages/Preview'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/generate/:docType" element={<Generator />} />
      <Route path="/preview" element={<Preview />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
    </Routes>
  )
}
