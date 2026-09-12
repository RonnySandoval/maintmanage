import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClipboardCheck, ClipboardList, Plus, Users, Wrench } from 'lucide-react'

type FabMenu = 'root' | 'inspeccion'

const IDLE_MS = 10_000

export function NuevoFab() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState<FabMenu>('root')
  const [visible, setVisible] = useState(true)
  const openRef = useRef(false)
  const timerRef = useRef<number>(0)
  const rootRef = useRef<HTMLDivElement>(null)
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
    if (!open) setMenu('root')
  }, [open])

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
    <div
      ref={rootRef}
      className={`nuevo-fab${visible || open ? '' : ' is-hidden'}`}
      aria-hidden={!visible && !open}
    >
      {open ? (
        <div
          className="nuevo-fab-menu"
          role="menu"
          aria-label={menu === 'inspeccion' ? 'Nueva inspección' : 'Crear'}
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
                <ClipboardList size={16} />
                De una ficha
              </Link>
              <Link
                className="nuevo-fab-item"
                role="menuitem"
                to="/actividades/nueva?tipo=inspeccion"
                onClick={() => setOpen(false)}
              >
                <ClipboardCheck size={16} />
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
                <Wrench size={16} />
                Actividad
              </Link>
              <Link
                className="nuevo-fab-item"
                role="menuitem"
                to="/fichas/nueva"
                onClick={() => setOpen(false)}
              >
                <ClipboardList size={16} />
                Ficha
              </Link>
              <button
                type="button"
                className="nuevo-fab-item"
                role="menuitem"
                onClick={() => setMenu('inspeccion')}
              >
                <ClipboardCheck size={16} />
                Inspección
              </button>
              <Link
                className="nuevo-fab-item"
                role="menuitem"
                to="/fichas?tab=encargados&nuevo=1"
                onClick={() => setOpen(false)}
              >
                <Users size={16} />
                Encargado
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
  )
}
