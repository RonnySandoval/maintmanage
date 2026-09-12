import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import { ThemeQuickToggle } from './ThemeQuickToggle'
import { useAppHistory } from '../hooks/useAppHistory'
import { useAutoBackup } from '../hooks/useAutoBackup'

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
  if (pathname.startsWith('/fichas/nueva')) return 'Nueva ficha'
  if (pathname.includes('/editar')) return 'Editar ficha'
  if (pathname.startsWith('/fichas/')) return 'Ficha'
  if (pathname === '/fichas') {
    const tab = new URLSearchParams(search).get('tab')
    if (tab === 'encargados') return 'Encargados'
    if (tab === 'bloques') return 'Bloques'
  }
  return TITLES[pathname] ?? 'MaintManage'
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
  const location = useLocation()
  const { canBack, canForward, back, forward } = useAppHistory()
  const { banner, busy, saveNow, dismiss } = useAutoBackup()

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">M</span>
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
            <h1>{titleFor(location.pathname, location.search)}</h1>
          </div>
          <ThemeQuickToggle />
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
      </div>
      <nav className="bottom-nav" aria-label="Principal">
        <NavItems />
      </nav>
    </div>
  )
}
