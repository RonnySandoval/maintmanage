import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, FileText, NotebookPen, Plus, Users, Wrench } from 'lucide-react'
import { useOverlayPresence } from '../hooks/useOverlayPresence'

type FabMenu = 'root' | 'inspeccion' | 'documento'

const IDLE_MS = 10_000

function menuLabel(menu: FabMenu): string {
  if (menu === 'inspeccion') return 'Nueva inspección'
  if (menu === 'documento') return 'Nuevo documento'
  return 'Crear'
}

export function NuevoFab() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<FabMenu>('root')
  const [visible, setVisible] = useState(true)
  const openRef = useRef(false)
  const timerRef = useRef<number>(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const { mounted: menuMounted, shown: menuShown, onTransitionEnd } = useOverlayPresence(open)
  openRef.current = open

  const onFormPage = /\/(nueva|editar)(\/|$)/.test(location.pathname)

  function reveal() {
    setVisible(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      if (!openRef.current) setVisible(false)
    }, IDLE_MS)
  }

  useEffect(() => {
    reveal()
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    const onActivity = () => reveal()
    const page = document.querySelector('main.page')
    window.addEventListener('pointerdown', onActivity, opts)
    window.addEventListener('keydown', onActivity, opts)
    window.addEventListener('scroll', onActivity, opts)
    window.addEventListener('wheel', onActivity, opts)
    window.addEventListener('touchmove', onActivity, opts)
    page?.addEventListener('scroll', onActivity, opts)
    const onVis = () => {
      if (document.visibilityState === 'visible') reveal()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearTimeout(timerRef.current)
      window.removeEventListener('pointerdown', onActivity, opts)
      window.removeEventListener('keydown', onActivity, opts)
      window.removeEventListener('scroll', onActivity, opts)
      window.removeEventListener('wheel', onActivity, opts)
      window.removeEventListener('touchmove', onActivity, opts)
      page?.removeEventListener('scroll', onActivity, opts)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    reveal()
    setOpen(false)
    setMenu('root')
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!menuMounted) setMenu('root')
  }, [menuMounted])

  useEffect(() => {
    if (!open) return
    function onDoc(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  if (onFormPage) return null

  return (
    <>
      {menuMounted ? (
        <button
          type="button"
          className={`nuevo-fab-backdrop${menuShown ? ' is-open' : ''}`}
          aria-label="Cerrar menú"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div
        ref={rootRef}
        className={`nuevo-fab${visible || open || menuMounted ? '' : ' is-hidden'}`}
        aria-hidden={!visible && !open && !menuMounted}
      >
        {menuMounted ? (
          <div
            className={`nuevo-fab-menu${menuShown ? ' is-open' : ''}`}
            role="menu"
            aria-label={menuLabel(menu)}
            onTransitionEnd={onTransitionEnd}
          >
            {menu === 'inspeccion' ? (
              <>
                <p className="nuevo-fab-caption">Inspección</p>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/inspecciones/nueva"
                  onClick={() => setOpen(false)}
                >
                  <ClipboardList size={14} />
                  De una ficha
                </Link>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/actividades/nueva?tipo=inspeccion"
                  onClick={() => setOpen(false)}
                >
                  <ClipboardCheck size={14} />
                  Sin ficha
                </Link>
              </>
            ) : menu === 'documento' ? (
              <>
                <p className="nuevo-fab-caption">Documento</p>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/fichas?tab=documentos&nuevo=1&conFicha=1"
                  onClick={() => setOpen(false)}
                >
                  <ClipboardList size={14} />
                  De una ficha
                </Link>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/fichas?tab=documentos&nuevo=1"
                  onClick={() => setOpen(false)}
                >
                  <FileText size={14} />
                  Sin ficha
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/actividades/nueva"
                  onClick={() => setOpen(false)}
                >
                  <Wrench size={14} />
                  Actividad
                </Link>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/fichas/nueva"
                  onClick={() => setOpen(false)}
                >
                  <ClipboardList size={14} />
                  Ficha
                </Link>
                <button
                  type="button"
                  className="nuevo-fab-item"
                  role="menuitem"
                  onClick={() => setMenu('inspeccion')}
                >
                  <ClipboardCheck size={14} />
                  Inspección
                </button>
                <button
                  type="button"
                  className="nuevo-fab-item"
                  role="menuitem"
                  onClick={() => setMenu('documento')}
                >
                  <FileText size={14} />
                  Documento
                </button>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/fichas?tab=encargados&nuevo=1"
                  onClick={() => setOpen(false)}
                >
                  <Users size={14} />
                  Encargado
                </Link>
                <Link
                  className="nuevo-fab-item"
                  role="menuitem"
                  to="/notas?nueva=1"
                  onClick={() => setOpen(false)}
                >
                  <NotebookPen size={14} />
                  Nota
                </Link>
              </>
            )}
          </div>
        ) : null}
        <button
          type="button"
          className={`nuevo-fab-btn${open ? ' is-open' : ''}`}
          aria-label="Nuevo"
          title="Nuevo"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => {
            setOpen((was) => !was)
            reveal()
          }}
        >
          <Plus size={22} />
        </button>
      </div>
    </>
  )
}
