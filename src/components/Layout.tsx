import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { actividadTitulo } from '../lib/actividades'
import { fichaTitulo } from '../lib/fichas'
import { monthLabel } from '../lib/dates'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import { FilterDrawer, FilterDrawerToggle } from './FilterDrawer'
import { NuevoFab } from './NuevoFab'
import { FontScaleToggle } from './FontScaleToggle'
import { StatusWordsToggle } from './ui'
import { AppLogo } from './AppLogo'
import { FilterDrawerProvider } from '../hooks/useFilterDrawer'
import { useAppHistory } from '../hooks/useAppHistory'
import { useAutoBackup } from '../hooks/useAutoBackup'
import { DataProcessOverlay } from './DataProcessOverlay'

const LINKS = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/cronograma', label: 'Cronograma', icon: CalendarDays, end: false },
  { to: '/fichas', label: 'Fichas', icon: ClipboardList, end: false },
  { to: '/historicos', label: 'Histórico', icon: History, end: false },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, end: false },
]

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/cronograma': 'Cronograma',
  '/fichas': 'Fichas',
  '/historicos': 'Histórico',
  '/ajustes': 'Ajustes',
}

function titleFor(pathname: string, search = ''): string {
  if (pathname.startsWith('/ocurrencias/')) return 'Ocurrencia'
  if (pathname.startsWith('/eventos/')) return 'Evento'
  if (pathname.startsWith('/acciones/')) return 'Acción'
  if (pathname.startsWith('/inspecciones/nueva')) return 'Nueva inspección'
  if (pathname.startsWith('/actividades/nueva')) {
    const tipo = new URLSearchParams(search).get('tipo')
    return tipo === 'inspeccion' ? 'Nueva inspección' : 'Nueva actividad'
  }
  if (pathname.startsWith('/actividades/') && pathname.endsWith('/editar')) return 'Editar actividad'
  if (pathname.startsWith('/actividades/')) return 'Actividad'
  if (pathname.startsWith('/fichas/nueva')) return 'Nueva ficha'
  if (pathname.includes('/editar')) return 'Editar ficha'
  if (pathname.startsWith('/fichas/')) return 'Ficha'
  if (pathname === '/fichas') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'actividades') return 'Actividades'
    if (tab === 'encargados') return 'Encargados'
    if (tab === 'bloques') return 'Bloques'
    if (tab === 'documentos') return 'Documentos'
  }
  if (pathname === '/historicos') {
    const hist = new URLSearchParams(search)
    if (hist.get('tab') === 'acciones') {
      return hist.get('fecha') === 'sin' ? 'Sin programar' : 'Correctivas'
    }
    return 'Histórico'
  }
  if (pathname === '/ajustes') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'nombres') return 'Nombres'
    if (tab === 'avisos') return 'Avisos'
    if (tab === 'estados') return 'Estados'
    if (tab === 'acerca') return 'Acerca de'
    return 'Copia de seguridad'
  }
  return TITLES[pathname] ?? 'MaintManage'
}

function PageHeading({ pathname, search }: { pathname: string; search: string }) {
  const occId = pathname.match(/^\/ocurrencias\/([^/]+)/)?.[1]
  const eventoId = pathname.match(/^\/eventos\/([^/]+)/)?.[1]
  const accionId = pathname.match(/^\/acciones\/([^/]+)/)?.[1]
  const occ = useLiveQuery(() => (occId ? db.ocurrencias.get(occId) : undefined), [occId])
  const ficha = useLiveQuery(
    () => (occ?.fichaId ? db.fichas.get(occ.fichaId) : undefined),
    [occ?.fichaId],
  )
  const evento = useLiveQuery(() => (eventoId ? db.eventos.get(eventoId) : undefined), [eventoId])
  const actividad = useLiveQuery(
    () => (evento?.actividadId ? db.actividades.get(evento.actividadId) : undefined),
    [evento?.actividadId],
  )
  const accion = useLiveQuery(() => (accionId ? db.accionesCorrectivas.get(accionId) : undefined), [accionId])
  if (occId && ficha && occ) {
    return `${fichaTitulo(ficha)} · ${monthLabel(occ.fechaProgramada)}`
  }
  if (eventoId && actividad && evento) {
    return `${actividadTitulo(actividad)} · ${monthLabel(evento.fechaProgramada)}`
  }
  if (accionId && accion) {
    return accion.fechaObjetivo ? `${accion.texto} · ${monthLabel(accion.fechaObjetivo)}` : accion.texto
  }
  return titleFor(pathname, search)
}

function NavItems() {
  return (
    <>
      {LINKS.map((link) => {
        const Icon = link.icon
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            replace={link.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={18} />
            {link.label}
          </NavLink>
        )
      })}
    </>
  )
}

export function Layout() {
  return (
    <FilterDrawerProvider>
      <LayoutShell />
    </FilterDrawerProvider>
  )
}

function LayoutShell() {
  const location = useLocation()
  const { canBack, canForward, back, forward } = useAppHistory()
  const { banner, busy, saveNow, dismiss, session, dismissProcess } = useAutoBackup()

  return (
    <div className="shell">
      <DataProcessOverlay session={session} onDismiss={dismissProcess} />
      <aside className="sidebar">
        <Link className="brand" to="/" replace>
          <AppLogo className="brand-mark" />
          MaintManage
        </Link>
        <nav>
          <NavItems />
        </nav>
        <p className="muted" style={{ marginTop: 'auto', padding: '0.75rem', fontSize: '0.78rem' }}>
          Copia automática en Ajustes. Así no se pierden al borrar la app.
        </p>
      </aside>
      <div className="content">
        <header className="topbar">
          <div className="topbar-lead">
            <Link className="topbar-logo" to="/" replace aria-label="Inicio">
              <AppLogo />
            </Link>
            <div className="nav-hist">
              <button
                type="button"
                className="icon-btn"
                aria-label="Atrás"
                disabled={!canBack}
                onClick={back}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Adelante"
                disabled={!canForward}
                onClick={forward}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <h1>
              <PageHeading pathname={location.pathname} search={location.search} />
            </h1>
          </div>
          <div className="topbar-actions">
            <StatusWordsToggle />
            <FilterDrawerToggle />
            <FontScaleToggle />
          </div>
        </header>
        <main className="page">
          {banner ? (
            <div className="backup-banner" role="status">
              <p>{banner}</p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveNow()}>
                  Guardar copia ahora
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={dismiss}>
                  Más tarde
                </button>
              </div>
            </div>
          ) : null}
          <Outlet />
        </main>
        <NuevoFab />
        <FilterDrawer />
      </div>
      <nav className="bottom-nav" aria-label="Principal">
        <NavItems />
      </nav>
    </div>
  )
}
