import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Generator from './pages/Generator'
import Preview from './pages/Preview'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/generate/:docType" element={<Generator />} />
      <Route path="/preview" element={<Preview />} />
    </Routes>
  )
}
