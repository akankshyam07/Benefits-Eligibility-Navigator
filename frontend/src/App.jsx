import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import LandingPage from './pages/LandingPage'
import NavigatorPage from './pages/NavigatorPage'

const STORAGE_KEY = 'ben_locale'

export default function App() {
  const [locale, setLocale] = useState(() => localStorage.getItem(STORAGE_KEY) || 'en')

  const handleLocaleChange = (next) => {
    setLocale(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-page-gradient text-brand-ink">
        <Header locale={locale} onLocaleChange={handleLocaleChange} />

        <Routes>
          <Route path="/" element={<LandingPage locale={locale} />} />
          <Route path="/navigator" element={<NavigatorPage locale={locale} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
