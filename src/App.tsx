import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Splash } from './components/Splash'
import { ThemeProvider } from './hooks/useTheme'
import { FontScaleProvider } from './hooks/useFontScale'
import { StatusLabelsProvider } from './hooks/useStatusLabels'
import { SearchBarProvider } from './hooks/useSearchBar'
import { AccionFechasProvider } from './hooks/useAccionFechas'
import { ensureHorizon } from './db/occurrences'
import { notifyIfNeeded } from './lib/notifications'
import { AccionDetailPage } from './pages/AccionDetail'
import { ActividadDetailPage } from './pages/ActividadDetail'
import { ActividadFormPage } from './pages/ActividadForm'
import { AjustesPage } from './pages/Ajustes'
import { CronogramaPage } from './pages/Cronograma'
import { DashboardPage } from './pages/Dashboard'
import { EventoDetailPage } from './pages/EventoDetail'
import { FichaDetailPage } from './pages/FichaDetail'
import { FichaFormPage } from './pages/FichaForm'
import { FichasPage } from './pages/Fichas'
import { HistoricosPage } from './pages/Historicos'
import { InspeccionFichaFormPage } from './pages/InspeccionFichaForm'
import { NotasPage } from './pages/Notas'
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
      <FontScaleProvider>
      <StatusLabelsProvider>
      <SearchBarProvider>
      <AccionFechasProvider>
        <Splash />
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
            <Route path="inspecciones/nueva" element={<InspeccionFichaFormPage />} />
            <Route path="actividades" element={<Navigate to="/fichas?tab=actividades" replace />} />
            <Route path="actividades/nueva" element={<ActividadFormPage />} />
            <Route path="actividades/:id/editar" element={<ActividadFormPage />} />
            <Route path="actividades/:id" element={<ActividadDetailPage />} />
            <Route path="eventos/:id" element={<EventoDetailPage />} />
            <Route path="acciones/:id" element={<AccionDetailPage />} />
            <Route path="historicos" element={<HistoricosPage />} />
            <Route path="mensajes" element={<NotasPage />} />
            <Route path="notas" element={<NotasPage />} />
            <Route path="bloques" element={<Navigate to="/fichas?tab=bloques" replace />} />
            <Route path="maestros" element={<Navigate to="/fichas?tab=bloques" replace />} />
            <Route path="ajustes" element={<AjustesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </HashRouter>
      </AccionFechasProvider>
      </SearchBarProvider>
      </StatusLabelsProvider>
      </FontScaleProvider>
    </ThemeProvider>
  )
}
