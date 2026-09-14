import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import type { Actividad, Bloque, Encargado, EstadoOcurrencia, Evento, Ficha, Ocurrencia } from '../db/types'
import {
  esExtraordinaria,
  frecuenciaLabel,
  tipoAccionLabel,
  tipoAccionOf,
  type AccionCorrectiva,
} from '../db/types'
import { accionHref, estadoAgendaCorrectiva } from '../lib/acciones'
import { compareActividadesByTitulo } from '../lib/actividades'
import { compareFichasByNumero, fichaTitulo } from '../lib/fichas'
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
import { useGridNameCol } from '../hooks/useGridNameCol'
import { useAliases } from '../lib/labels'
import { ActividadTitle } from './ActividadTitle'
import { FichaTitle } from './FichaTitle'
import { LeyendaSimbolos, TipoBadge } from './ui'

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

function pickOcc<T extends { estado: EstadoOcurrencia }>(list: T[]): T | undefined {
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
  modo = 'fichas',
  fichas,
  actividades = [],
  bloques,
  encargados,
  ocurrencias,
  eventos = [],
  acciones,
  showBloque = true,
  onToggleBloque,
}: {
  year: number
  modo?: 'fichas' | 'actividades'
  fichas: Ficha[]
  actividades?: Actividad[]
  bloques: Bloque[]
  encargados: Encargado[]
  ocurrencias: Ocurrencia[]
  eventos?: Evento[]
  acciones: AccionCorrectiva[]
  showBloque?: boolean
  onToggleBloque?: () => void
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
  const [wrapWidth, setWrapWidth] = useState(() =>
    typeof window === 'undefined' ? 360 : Math.max(280, window.innerWidth - 48),
  )
  const nameCol = useGridNameCol(wrapWidth, span)
  const dragRef = useRef<{ x: number; w: number } | null>(null)
  const [resizing, setResizing] = useState(false)

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

  const byActividadMonth = new Map<string, Evento[]>()
  for (const e of eventos) {
    if (!e.fechaProgramada.startsWith(String(year))) continue
    const month = Number(e.fechaProgramada.slice(5, 7)) - 1
    const key = `${e.actividadId}:${month}`
    const list = byActividadMonth.get(key) ?? []
    list.push(e)
    byActividadMonth.set(key, list)
  }

  const correctivaOcc = new Set(
    acciones
      .filter((a) => tipoAccionOf(a) === 'correctiva' && a.ocurrenciaId)
      .map((a) => a.ocurrenciaId as string),
  )
  const correctivaFicha = new Set(
    acciones
      .filter((a) => tipoAccionOf(a) === 'correctiva' && !a.ocurrenciaId && a.fichaId)
      .map((a) => a.fichaId as string),
  )
  const correctivaEvt = new Set(
    acciones
      .filter((a) => tipoAccionOf(a) === 'correctiva' && a.eventoId)
      .map((a) => a.eventoId as string),
  )
  const correctivaActividad = new Set(
    acciones
      .filter((a) => tipoAccionOf(a) === 'correctiva' && !a.eventoId && a.actividadId)
      .map((a) => a.actividadId as string),
  )
  const correctivasFechadas = acciones
    .filter((a) => tipoAccionOf(a) === 'correctiva' && Boolean(a.fechaObjetivo))
    .sort((a, b) => {
      const byFecha = (a.fechaObjetivo ?? '').localeCompare(b.fechaObjetivo ?? '')
      if (byFecha) return byFecha
      return a.texto.localeCompare(b.texto, 'es')
    })
  const fichaById = Object.fromEntries(fichas.map((f) => [f.id, f]))
  const actividadById = Object.fromEntries(actividades.map((a) => [a.id, a]))

  const encargadoMap = Object.fromEntries(encargados.map((e) => [e.id, e]))
  const bloqueMap = Object.fromEntries(bloques.map((b) => [b.id, b]))
  const fichasOrdenadas = [...fichas].sort(compareFichasByNumero)
  const actividadesOrdenadas = [...actividades].sort(compareActividadesByTitulo)

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

  function onNameColPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!nameCol.canResize) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, w: nameCol.width }
    setResizing(true)
  }

  function onNameColPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    nameCol.setWidth(drag.w + (e.clientX - drag.x))
  }

  function onNameColPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    dragRef.current = null
    setResizing(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  function onNameColKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nameCol.setWidth(nameCol.width - 12)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nameCol.setWidth(nameCol.width + 12)
    } else if (e.key === 'Home') {
      e.preventDefault()
      nameCol.setWidth(nameCol.min)
    } else if (e.key === 'End') {
      e.preventDefault()
      nameCol.setWidth(nameCol.max)
    }
  }

  const vacia =
    modo === 'fichas'
      ? !fichas.length
      : !actividades.length && !correctivasFechadas.length

  useEffect(() => {
    if (vacia) return
    const el = wrapRef.current
    if (!el) return
    const update = () => setWrapWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [vacia])

  if (vacia) {
    return (
      <div className="card muted">
        {modo === 'fichas'
          ? 'No hay fichas para este año.'
          : 'No hay actividades ni acciones correctivas con fecha para este año.'}
      </div>
    )
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
            <div className="zoom-controls" role="group" aria-label="Zoom de meses">
              <button
                type="button"
                className="btn"
                disabled={zoom === 0}
                onClick={zoomOut}
                aria-label="Ver más meses"
              >
                <Minus size={14} />
              </button>
              <span className="zoom-label">Mes</span>
              <button
                type="button"
                className="btn"
                disabled={zoom === ZOOM_IN_MAX}
                onClick={zoomIn}
                aria-label="Ver menos meses"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="zoom-controls" role="group" aria-label="Detalle de ficha">
              <button
                type="button"
                className="btn"
                disabled={detail === 0}
                onClick={detailOut}
                aria-label="Menos detalle de ficha"
              >
                <Minus size={14} />
              </button>
              <span className="zoom-label">Ficha</span>
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
            {onToggleBloque ? (
              <div className="zoom-controls">
                <button
                  type="button"
                  className={`zoom-toggle${showBloque ? ' is-on' : ''}`}
                  onClick={onToggleBloque}
                  aria-pressed={showBloque}
                  title={showBloque ? 'Ocultar nombre del bloque' : 'Mostrar nombre del bloque'}
                >
                  Bloque
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className={`year-grid-wrap${resizing ? ' is-resizing' : ''}`} ref={wrapRef}>
          <table
            className={`year-grid mode-${span} detail-${detail}${nameCol.showFullText ? ' is-name-wide' : ''}${resizing ? ' is-resizing' : ''}`}
            style={{
              ['--ficha-col-w' as string]: `${nameCol.width}px`,
              ['--month-col-min' as string]: `${nameCol.monthMin}px`,
            }}
          >
          <thead>
            <tr>
              <th className="ficha-col" rowSpan={2}>
                {modo === 'actividades' ? 'Actividad' : 'Ficha'}
                {nameCol.canResize ? (
                  <button
                    type="button"
                    className={`ficha-col-resizer${resizing ? ' is-dragging' : ''}`}
                    aria-label="Redimensionar columna de nombre"
                    title="Arrastra para ver el nombre completo. Doble clic restablece."
                    aria-valuemin={nameCol.min}
                    aria-valuemax={nameCol.max}
                    aria-valuenow={nameCol.width}
                    onPointerDown={onNameColPointerDown}
                    onPointerMove={onNameColPointerMove}
                    onPointerUp={onNameColPointerUp}
                    onPointerCancel={onNameColPointerUp}
                    onDoubleClick={nameCol.reset}
                    onKeyDown={onNameColKeyDown}
                  />
                ) : null}
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
            {modo === 'fichas'
              ? fichasOrdenadas.map((ficha) => {
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
                })
              : null}
            {modo === 'actividades'
              ? actividadesOrdenadas.map((actividad) => (
                  <ActividadRow
                    key={actividad.id}
                    actividad={actividad}
                    monthIndexes={monthIndexes}
                    start={start}
                    currentMonth={currentMonth}
                    byActividadMonth={byActividadMonth}
                    encargado={actividad.encargadoId ? encargadoMap[actividad.encargadoId] : undefined}
                    showMeta={detail >= 1}
                    showFrecuencia={detail >= 2}
                    correctivaEvt={correctivaEvt}
                    correctivaActividad={correctivaActividad}
                  />
                ))
              : null}
            {modo === 'actividades'
              ? correctivasFechadas.map((accion) => (
                  <CorrectivaRow
                    key={accion.id}
                    accion={accion}
                    ficha={accion.fichaId ? fichaById[accion.fichaId] : undefined}
                    actividad={accion.actividadId ? actividadById[accion.actividadId] : undefined}
                    monthIndexes={monthIndexes}
                    start={start}
                    currentMonth={currentMonth}
                    year={year}
                    showMeta={detail >= 1}
                  />
                ))
              : null}
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
    <tr className="ficha-row">
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

function ActividadRow({
  actividad,
  monthIndexes,
  start,
  currentMonth,
  byActividadMonth,
  encargado,
  showMeta,
  showFrecuencia,
  correctivaEvt,
  correctivaActividad,
}: {
  actividad: Actividad
  monthIndexes: number[]
  start: number
  currentMonth: number
  byActividadMonth: Map<string, Evento[]>
  encargado?: Encargado
  showMeta: boolean
  showFrecuencia: boolean
  correctivaEvt: Set<string>
  correctivaActividad: Set<string>
}) {
  return (
    <tr className="ficha-row">
      <th className="ficha-col" scope="row">
        <Link to={`/actividades/${actividad.id}`}>
          <ActividadTitle actividad={actividad} />
        </Link>
        <span className="ficha-meta">
          <TipoBadge tipo={actividad.tipo} />
        </span>
        {showMeta ? (
          <span className="ficha-meta">{encargado?.nombre ?? 'Sin encargado'}</span>
        ) : null}
        {showFrecuencia ? (
          <span className="ficha-meta">{frecuenciaLabel(actividad.frecuencia)}</span>
        ) : null}
      </th>
      {monthIndexes.map((month) => {
        const evt = pickOcc(byActividadMonth.get(`${actividad.id}:${month}`) ?? [])
        const cls = `month-col ${monthClass(month, start, currentMonth)}`.trim()
        if (!evt) return <td key={month} className={cls} />
        const hasCorrectiva = correctivaEvt.has(evt.id) || correctivaActividad.has(actividad.id)
        const title = [
          labelEstado(evt.estado),
          esExtraordinaria(evt) ? 'Extraordinaria' : '',
          hasCorrectiva ? 'Con acción correctiva' : '',
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <td key={month} className={cls}>
            <Link
              className={`grid-cell ${evt.estado}${hasCorrectiva ? ' has-correctiva' : ''}`}
              to={`/eventos/${evt.id}`}
              title={title}
              aria-label={title}
            >
              <span className="cell-syms">
                <span aria-hidden>{simboloEstado(evt.estado)}</span>
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

function CorrectivaRow({
  accion,
  ficha,
  actividad,
  monthIndexes,
  start,
  currentMonth,
  year,
  showMeta,
}: {
  accion: AccionCorrectiva
  ficha?: Ficha
  actividad?: Actividad
  monthIndexes: number[]
  start: number
  currentMonth: number
  year: number
  showMeta: boolean
}) {
  const aliases = useAliases()
  const fecha = accion.fechaObjetivo ?? ''
  const month = fecha.startsWith(String(year)) ? Number(fecha.slice(5, 7)) - 1 : -1
  const estado = estadoAgendaCorrectiva(accion)
  const href = accionHref(accion)
  const parent = actividad ? actividad.titulo : ficha ? fichaTitulo(ficha) : ''
  return (
    <tr className="ficha-row">
      <th className="ficha-col" scope="row">
        <Link to={href}>{accion.texto}</Link>
        <span className="ficha-meta">{tipoAccionLabel('correctiva', aliases)}</span>
        {showMeta && parent ? <span className="ficha-meta">{parent}</span> : null}
      </th>
      {monthIndexes.map((m) => {
        const cls = `month-col ${monthClass(m, start, currentMonth)}`.trim()
        if (m !== month) return <td key={m} className={cls} />
        const title = [labelEstado(estado), tipoAccionLabel('correctiva', aliases)].join(' · ')
        return (
          <td key={m} className={cls}>
            <Link
              className={`grid-cell ${estado} has-correctiva`}
              to={href}
              title={title}
              aria-label={title}
            >
              <span className="cell-syms">
                <span aria-hidden>{simboloEstado(estado)}</span>
                <span className="cell-correctiva" aria-hidden>
                  {SIMBOLO_CORRECTIVA}
                </span>
              </span>
            </Link>
          </td>
        )
      })}
    </tr>
  )
}
