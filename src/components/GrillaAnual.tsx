import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import type { AccionCorrectiva, Bloque, Encargado, EstadoOcurrencia, Ficha, Ocurrencia } from '../db/types'
import { esExtraordinaria, frecuenciaLabel, tipoAccionOf } from '../db/types'
import { compareFichasByNumero } from '../lib/fichas'
import { labelEstado, SIMBOLO_CORRECTIVA, simboloEstado } from '../lib/simbolos'
import {
  monthsVisible,
  spanFromWidth,
  spanFromZoom,
  useGridSpan,
  windowStartForMonth,
  zoomFromSpan,
  ZOOM_IN_MAX,
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
  pendiente: 1,
  proxima: 2,
  planificada: 3,
  ejecutada: 4,
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

type DetailLevel = 0 | 1 | 2
const DETAIL_MAX: DetailLevel = 2

function pinchAxes(touches: TouchList): { dx: number; dy: number; dist: number } {
  const dx = Math.abs(touches[0].clientX - touches[1].clientX)
  const dy = Math.abs(touches[0].clientY - touches[1].clientY)
  return { dx, dy, dist: Math.hypot(dx, dy) }
}

export function GrillaAnual({
  year,
  fichas,
  bloques,
  encargados,
  ocurrencias,
  acciones,
  showBloque = true,
}: {
  year: number
  fichas: Ficha[]
  bloques: Bloque[]
  encargados: Encargado[]
  ocurrencias: Ocurrencia[]
  acciones: AccionCorrectiva[]
  showBloque?: boolean
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
  const [detail, setDetail] = useState<DetailLevel>(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef({ dx: 0, dy: 0, dist: 0, locked: false })
  const zoomRef = useRef(zoom)
  const detailRef = useRef(detail)
  zoomRef.current = zoom
  detailRef.current = detail

  useEffect(() => {
    setStart((current) => Math.min(Math.max(0, Math.floor(current / 3) * 3), maxStart))
  }, [maxStart])

  function setZoom(next: ZoomLevel) {
    setManualZoom(next)
  }

  function zoomIn() {
    setManualZoom((current) => {
      const z = current ?? zoomFromSpan(autoSpan)
      return (Math.min(ZOOM_IN_MAX, z + 1) as ZoomLevel)
    })
  }

  function zoomOut() {
    setManualZoom((current) => {
      const z = current ?? zoomFromSpan(autoSpan)
      return (Math.max(0, z - 1) as ZoomLevel)
    })
  }

  function detailIn() {
    setDetail((current) => Math.min(DETAIL_MAX, current + 1) as DetailLevel)
  }

  function detailOut() {
    setDetail((current) => Math.max(0, current - 1) as DetailLevel)
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { ...pinchAxes(e.touches), locked: false }
      }
    }

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      const next = pinchAxes(e.touches)
      const prev = pinchRef.current
      if (!prev.dist) {
        pinchRef.current = { ...next, locked: false }
        return
      }
      if (pinchRef.current.locked) return
      const ddx = next.dx - prev.dx
      const ddy = next.dy - prev.dy
      const horizontal = Math.abs(ddx) >= Math.abs(ddy)
      if (horizontal) {
        if (ddx > 28 && zoomRef.current > 0) {
          pinchRef.current.locked = true
          setZoom((Math.max(0, zoomRef.current - 1) as ZoomLevel))
        } else if (ddx < -28 && zoomRef.current < ZOOM_IN_MAX) {
          pinchRef.current.locked = true
          setZoom((Math.min(ZOOM_IN_MAX, zoomRef.current + 1) as ZoomLevel))
        }
      } else if (ddy > 24 && detailRef.current < DETAIL_MAX) {
        pinchRef.current.locked = true
        setDetail((Math.min(DETAIL_MAX, detailRef.current + 1) as DetailLevel))
      } else if (ddy < -24 && detailRef.current > 0) {
        pinchRef.current.locked = true
        setDetail((Math.max(0, detailRef.current - 1) as DetailLevel))
      }
    }

    const onEnd = () => {
      pinchRef.current = { dx: 0, dy: 0, dist: 0, locked: false }
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
  const fichasOrdenadas = [...fichas].sort(compareFichasByNumero)

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
      <div className="year-grid-shell">
        <div className="year-grid-chrome">
          {span !== 'year' ? (
            <div className="row-spread grid-window">
              <button
                type="button"
                className="btn"
                disabled={!canPrev}
                onClick={() => step(-3)}
                aria-label="Periodo anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <strong>{rangeLabel}</strong>
              <button
                type="button"
                className="btn"
                disabled={!canNext}
                onClick={() => step(3)}
                aria-label="Periodo siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <strong className="grid-year-label">{year}</strong>
          )}
          <div className="zoom-stack">
            <div className="zoom-controls" role="group" aria-label="Zoom de meses y ficha">
              <span className="zoom-label">Mes</span>
              <button
                type="button"
                className="btn"
                disabled={zoom === 0}
                onClick={zoomOut}
                aria-label="Ver más meses"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                className="btn"
                disabled={zoom === ZOOM_IN_MAX}
                onClick={zoomIn}
                aria-label="Ver menos meses"
              >
                <Plus size={14} />
              </button>
              <span className="zoom-split" aria-hidden />
              <span className="zoom-label">Ficha</span>
              <button
                type="button"
                className="btn"
                disabled={detail === 0}
                onClick={detailOut}
                aria-label="Menos detalle de ficha"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                className="btn"
                disabled={detail === DETAIL_MAX}
                onClick={detailIn}
                aria-label="Más detalle de ficha"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
        <div className="year-grid-wrap" ref={wrapRef}>
          <table className={`year-grid mode-${span} detail-${detail}`}>
          <thead>
            <tr>
              <th className="ficha-col" rowSpan={2}>
                Ficha
              </th>
              {visibleTrimestres.map((t, i) => (
                <th
                  key={t.id}
                  className={`q-head q-${t.id}${i > 0 ? ' q-gap' : ''}`}
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
                  className={`month-col ${monthClass(m, start, currentMonth)}`.trim()}
                  aria-current={m === currentMonth ? 'true' : undefined}
                >
                  {MESES[m]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fichasOrdenadas.map((ficha, index) => {
              const bloque = bloqueMap[ficha.grupoId] ?? {
                id: ficha.grupoId,
                nombre: 'Sin bloque',
                color: 'teal',
                createdAt: 0,
                updatedAt: 0,
              }
              return (
                <FichaRow
                  key={ficha.id}
                  ficha={ficha}
                  bloque={bloque}
                  index={index}
                  monthIndexes={monthIndexes}
                  start={start}
                  currentMonth={currentMonth}
                  byFichaMonth={byFichaMonth}
                  encargado={ficha.encargadoId ? encargadoMap[ficha.encargadoId] : undefined}
                  showBloque={showBloque}
                  showMeta={detail >= 1}
                  showFrecuencia={detail >= 2}
                  correctivaOcc={correctivaOcc}
                  correctivaFicha={correctivaFicha}
                />
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
      <LeyendaSimbolos />
    </div>
  )
}

function FichaRow({
  ficha,
  bloque,
  index,
  monthIndexes,
  start,
  currentMonth,
  byFichaMonth,
  encargado,
  showBloque,
  showMeta,
  showFrecuencia,
  correctivaOcc,
  correctivaFicha,
}: {
  ficha: Ficha
  bloque: Bloque
  index: number
  monthIndexes: number[]
  start: number
  currentMonth: number
  byFichaMonth: Map<string, Ocurrencia[]>
  encargado?: Encargado
  showBloque: boolean
  showMeta: boolean
  showFrecuencia: boolean
  correctivaOcc: Set<string>
  correctivaFicha: Set<string>
}) {
  return (
    <tr className={`ficha-row${index % 2 ? ' is-alt' : ''}`}>
      <th className="ficha-col" scope="row">
        <Link to={`/fichas/${ficha.id}`}>
          <FichaTitle ficha={ficha} color={bloque.color} />
        </Link>
        {showBloque ? <span className="ficha-meta">{bloque.nombre}</span> : null}
        {showMeta ? (
          <span className="ficha-meta">{encargado?.nombre ?? 'Sin encargado'}</span>
        ) : null}
        {showFrecuencia ? (
          <span className="ficha-meta">{frecuenciaLabel(ficha.frecuencia)}</span>
        ) : null}
      </th>
      {monthIndexes.map((month) => {
        const occ = pickOcc(byFichaMonth.get(`${ficha.id}:${month}`) ?? [])
        const cls = `month-col ${monthClass(month, start, currentMonth)}`.trim()
        if (!occ) return <td key={month} className={cls} />
        const hasCorrectiva = correctivaOcc.has(occ.id) || correctivaFicha.has(ficha.id)
        const title = [
          labelEstado(occ.estado),
          esExtraordinaria(occ) ? 'Extraordinaria' : '',
          hasCorrectiva ? 'Con acción correctiva' : '',
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <td key={month} className={cls}>
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
}
