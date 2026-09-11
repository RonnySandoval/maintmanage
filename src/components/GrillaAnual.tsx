import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import type { AccionCorrectiva, Bloque, Encargado, EstadoOcurrencia, Ficha, Ocurrencia } from '../db/types'
import { frecuenciaLabel, tipoAccionOf } from '../db/types'
import { fichaTitulo } from '../lib/fichas'
import { labelEstado, SIMBOLO_CORRECTIVA, simboloEstado } from '../lib/simbolos'
import {
  monthsVisible,
  spanFromWidth,
  spanFromZoom,
  useGridSpan,
  windowStartForMonth,
  zoomFromSpan,
  type ZoomLevel,
} from '../hooks/useGridSpan'
import { FichaTitle } from './FichaTitle'
import { LeyendaSimbolos } from './ui'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const TRIMESTRES = [
  { id: 'T1', label: '1.er trim.', months: [0, 1, 2] },
  { id: 'T2', label: '2.º trim.', months: [3, 4, 5] },
  { id: 'T3', label: '3.er trim.', months: [6, 7, 8] },
  { id: 'T4', label: '4.º trim.', months: [9, 10, 11] },
]

const PRIORIDAD: Record<EstadoOcurrencia, number> = {
  vencida: 0,
  proxima: 1,
  pendiente: 2,
  ejecutada: 3,
}

function pickOcc(list: Ocurrencia[]): Ocurrencia | undefined {
  return [...list].sort((a, b) => PRIORIDAD[a.estado] - PRIORIDAD[b.estado])[0]
}

function monthClass(month: number, start: number, currentMonth: number): string {
  const parts: string[] = []
  if (month % 3 === 0 && month !== start) parts.push('q-gap')
  if (month === currentMonth) parts.push('is-current')
  return parts.join(' ')
}

function pinchDistance(touches: TouchList): number {
  const a = touches[0]
  const b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

export function GrillaAnual({
  year,
  fichas,
  bloques,
  encargados,
  ocurrencias,
  acciones,
}: {
  year: number
  fichas: Ficha[]
  bloques: Bloque[]
  encargados: Encargado[]
  ocurrencias: Ocurrencia[]
  acciones: AccionCorrectiva[]
}) {
  const autoSpan = useGridSpan()
  const [manualZoom, setManualZoom] = useState<ZoomLevel | null>(null)
  const zoom = manualZoom ?? zoomFromSpan(autoSpan)
  const span = spanFromZoom(zoom)
  const visible = monthsVisible(span)
  const maxStart = 12 - visible
  const today = new Date()
  const currentMonth = year === today.getFullYear() ? today.getMonth() : -1
  const [start, setStart] = useState(() =>
    windowStartForMonth(
      today.getMonth(),
      monthsVisible(typeof window === 'undefined' ? 'quarter' : spanFromWidth(window.innerWidth)),
    ),
  )
  const wrapRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef({ dist: 0, locked: false })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  useEffect(() => {
    setStart((current) => Math.min(Math.max(0, Math.floor(current / 3) * 3), maxStart))
  }, [maxStart])

  function setZoom(next: ZoomLevel) {
    setManualZoom(next)
  }

  function zoomIn() {
    setManualZoom((current) => {
      const z = current ?? zoomFromSpan(autoSpan)
      return (Math.min(2, z + 1) as ZoomLevel)
    })
  }

  function zoomOut() {
    setManualZoom((current) => {
      const z = current ?? zoomFromSpan(autoSpan)
      return (Math.max(0, z - 1) as ZoomLevel)
    })
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist: pinchDistance(e.touches), locked: false }
      }
    }

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const dist = pinchDistance(e.touches)
      const prev = pinchRef.current.dist
      if (!prev) {
        pinchRef.current.dist = dist
        return
      }
      const ratio = dist / prev
      if (pinchRef.current.locked) return
      if (ratio > 1.18 && zoomRef.current < 2) {
        pinchRef.current.locked = true
        setZoom((Math.min(2, zoomRef.current + 1) as ZoomLevel))
      } else if (ratio < 0.85 && zoomRef.current > 0) {
        pinchRef.current.locked = true
        setZoom((Math.max(0, zoomRef.current - 1) as ZoomLevel))
      }
    }

    const onEnd = () => {
      pinchRef.current = { dist: 0, locked: false }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const monthIndexes = useMemo(
    () => Array.from({ length: visible }, (_, i) => start + i),
    [start, visible],
  )

  const byFichaMonth = new Map<string, Ocurrencia[]>()
  for (const o of ocurrencias) {
    if (!o.fechaProgramada.startsWith(String(year))) continue
    const month = Number(o.fechaProgramada.slice(5, 7)) - 1
    const key = `${o.fichaId}:${month}`
    const list = byFichaMonth.get(key) ?? []
    list.push(o)
    byFichaMonth.set(key, list)
  }

  const correctivaOcc = new Set(
    acciones
      .filter((a) => tipoAccionOf(a) === 'correctiva' && a.ocurrenciaId)
      .map((a) => a.ocurrenciaId as string),
  )
  const correctivaFicha = new Set(
    acciones.filter((a) => tipoAccionOf(a) === 'correctiva' && !a.ocurrenciaId).map((a) => a.fichaId),
  )

  const encargadoMap = Object.fromEntries(encargados.map((e) => [e.id, e]))
  const bloqueMap = Object.fromEntries(bloques.map((b) => [b.id, b]))
  const groups = new Map<string, Ficha[]>()
  for (const ficha of fichas) {
    const list = groups.get(ficha.grupoId) ?? []
    list.push(ficha)
    groups.set(ficha.grupoId, list)
  }

  const orderedBloques = [
    ...bloques.filter((b) => groups.has(b.id)),
    ...[...groups.keys()]
      .filter((id) => !bloqueMap[id])
      .map((id) => ({
        id,
        nombre: 'Sin bloque',
        color: 'var(--accent)',
        createdAt: 0,
        updatedAt: 0,
      })),
  ]

  const visibleTrimestres = TRIMESTRES.map((t) => ({
    ...t,
    months: t.months.filter((m) => m >= start && m < start + visible),
  })).filter((t) => t.months.length)

  const rangeLabel = `${MESES[start]}–${MESES[start + visible - 1]} ${year}`
  const canPrev = start > 0
  const canNext = start < maxStart

  function step(delta: number) {
    setStart((current) => Math.min(maxStart, Math.max(0, current + delta)))
  }

  if (!fichas.length) {
    return <div className="card muted">No hay fichas para este año.</div>
  }

  return (
    <div>
      <div className="grid-toolbar">
        {span !== 'year' ? (
          <div className="row-spread grid-window">
            <button
              type="button"
              className="btn"
              disabled={!canPrev}
              onClick={() => step(-3)}
              aria-label="Periodo anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <strong>{rangeLabel}</strong>
            <button
              type="button"
              className="btn"
              disabled={!canNext}
              onClick={() => step(3)}
              aria-label="Periodo siguiente"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          <strong className="grid-year-label">{year}</strong>
        )}
        <div className="zoom-controls" role="group" aria-label="Zoom del cronograma">
          <button
            type="button"
            className="btn"
            disabled={zoom === 0}
            onClick={zoomOut}
            aria-label="Alejar"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            className="btn"
            disabled={zoom === 2}
            onClick={zoomIn}
            aria-label="Acercar"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      <div className="year-grid-wrap" ref={wrapRef}>
        <table className={`year-grid mode-${span}`}>
          <thead>
            <tr>
              <th className="ficha-col" rowSpan={2}>
                Ficha
              </th>
              {visibleTrimestres.map((t, i) => (
                <th
                  key={t.id}
                  className={`q-head${i > 0 ? ' q-gap' : ''}`}
                  colSpan={t.months.length}
                >
                  {t.label}
                </th>
              ))}
            </tr>
            <tr>
              {monthIndexes.map((m) => (
                <th
                  key={m}
                  className={monthClass(m, start, currentMonth)}
                  aria-current={m === currentMonth ? 'true' : undefined}
                >
                  {MESES[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedBloques.map((bloque) => {
              const rows = (groups.get(bloque.id) ?? []).sort((a, b) => {
                const na = Number.parseInt(a.numero, 10)
                const nb = Number.parseInt(b.numero, 10)
                if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
                return fichaTitulo(a).localeCompare(fichaTitulo(b), 'es')
              })
              if (!rows.length) return null
              return (
                <BloqueRows
                  key={bloque.id}
                  bloque={bloque}
                  fichas={rows}
                  monthIndexes={monthIndexes}
                  start={start}
                  currentMonth={currentMonth}
                  byFichaMonth={byFichaMonth}
                  encargadoMap={encargadoMap}
                  showFrecuencia={span === 'year'}
                  correctivaOcc={correctivaOcc}
                  correctivaFicha={correctivaFicha}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <LeyendaSimbolos />
    </div>
  )
}

function BloqueRows({
  bloque,
  fichas,
  monthIndexes,
  start,
  currentMonth,
  byFichaMonth,
  encargadoMap,
  showFrecuencia,
  correctivaOcc,
  correctivaFicha,
}: {
  bloque: Bloque
  fichas: Ficha[]
  monthIndexes: number[]
  start: number
  currentMonth: number
  byFichaMonth: Map<string, Ocurrencia[]>
  encargadoMap: Record<string, Encargado>
  showFrecuencia: boolean
  correctivaOcc: Set<string>
  correctivaFicha: Set<string>
}) {
  return (
    <>
      <tr className="bloque-row">
        <td colSpan={1 + monthIndexes.length} style={{ color: bloque.color }}>
          <span className="color-dot" style={{ background: bloque.color, margin: '0 8px 0 0' }} />
          {bloque.nombre}
        </td>
      </tr>
      {fichas.map((ficha) => {
        const encargado = ficha.encargadoId ? encargadoMap[ficha.encargadoId] : undefined
        return (
          <tr key={ficha.id}>
            <th className="ficha-col" scope="row">
              <Link to={`/fichas/${ficha.id}`}>
                <FichaTitle ficha={ficha} color={bloque.color} />
              </Link>
              <span className="ficha-meta">{encargado?.nombre ?? 'Sin encargado'}</span>
              {showFrecuencia ? (
                <span className="ficha-meta">{frecuenciaLabel(ficha.frecuencia)}</span>
              ) : null}
            </th>
            {monthIndexes.map((month) => {
              const occ = pickOcc(byFichaMonth.get(`${ficha.id}:${month}`) ?? [])
              const cls = monthClass(month, start, currentMonth)
              if (!occ) return <td key={month} className={cls || undefined} />
              const hasCorrectiva = correctivaOcc.has(occ.id) || correctivaFicha.has(ficha.id)
              const title = hasCorrectiva
                ? `${labelEstado(occ.estado)} · Con acción correctiva`
                : labelEstado(occ.estado)
              return (
                <td key={month} className={cls || undefined}>
                  <Link
                    className={`grid-cell ${occ.estado}${hasCorrectiva ? ' has-correctiva' : ''}`}
                    to={`/ocurrencias/${occ.id}`}
                    title={title}
                    aria-label={title}
                  >
                    <span className="cell-syms">
                      <span aria-hidden>{simboloEstado(occ.estado)}</span>
                      {hasCorrectiva ? (
                        <span className="cell-correctiva" aria-hidden>
                          {SIMBOLO_CORRECTIVA}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}
