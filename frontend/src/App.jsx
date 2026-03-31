import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import Home from './pages/Home'
import Results from './pages/Results'
import AuditResultsPage from './pages/AuditResultsPage'
import BadgePage from './pages/BadgePage'

export default function App() {
  useTheme()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/results" element={<Results />} />
        <Route path="/audit-results" element={<AuditResultsPage />} />
        <Route path="/badge/:badgeId" element={<BadgePage />} />
      </Routes>
    </BrowserRouter>
  )
}
