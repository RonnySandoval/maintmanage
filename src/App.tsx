import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ThemeProvider } from './hooks/useTheme'
import { ensureHorizon } from './db/occurrences'
import { notifyIfNeeded } from './lib/notifications'
import { AjustesPage } from './pages/Ajustes'
import { CronogramaPage } from './pages/Cronograma'
import { DashboardPage } from './pages/Dashboard'
import { FichaDetailPage } from './pages/FichaDetail'
import { FichaFormPage } from './pages/FichaForm'
import { FichasPage } from './pages/Fichas'
import { HistoricosPage } from './pages/Historicos'
import { OcurrenciaDetailPage } from './pages/OcurrenciaDetail'

export default function App() {
  useEffect(() => {
    let cancelled = false
    void (async () => {
      await ensureHorizon()
      if (!cancelled) await notifyIfNeeded()
    })()
    const onVis = () => {
      if (document.visibilityState === 'visible') void notifyIfNeeded()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="cronograma" element={<CronogramaPage />} />
            <Route path="fichas" element={<FichasPage />} />
            <Route path="fichas/nueva" element={<FichaFormPage />} />
            <Route path="fichas/:id/editar" element={<FichaFormPage />} />
            <Route path="fichas/:id" element={<FichaDetailPage />} />
            <Route path="ocurrencias/:id" element={<OcurrenciaDetailPage />} />
            <Route path="historicos" element={<HistoricosPage />} />
            <Route path="bloques" element={<Navigate to="/fichas?tab=bloques" replace />} />
            <Route path="maestros" element={<Navigate to="/fichas?tab=bloques" replace />} />
            <Route path="ajustes" element={<AjustesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  )
}
