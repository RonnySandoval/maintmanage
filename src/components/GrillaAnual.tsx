import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Bloque, Encargado, EstadoOcurrencia, Ficha, Ocurrencia } from '../db/types'
import { frecuenciaLabel } from '../db/types'
import { fichaTitulo } from '../lib/fichas'
import {
  monthsVisible,
  spanFromWidth,
  useGridSpan,
  windowStartForMonth,
} from '../hooks/useGridSpan'
import { FichaTitle } from './FichaTitle'

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

export function GrillaAnual({
  year,
  fichas,
  bloques,
  encargados,
  ocurrencias,
}: {
  year: number
  fichas: Ficha[]
  bloques: Bloque[]
  encargados: Encargado[]
  ocurrencias: Ocurrencia[]
}) {
  const span = useGridSpan()
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

  useEffect(() => {
    setStart((current) => Math.min(Math.max(0, Math.floor(current / 3) * 3), maxStart))
  }, [maxStart])

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
      {span !== 'year' ? (
        <div className="row-spread grid-window" style={{ marginBottom: '0.55rem' }}>
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
      ) : null}
      <div className="year-grid-wrap">
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
                />
              )
            })}
          </tbody>
        </table>
      </div>
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
}: {
  bloque: Bloque
  fichas: Ficha[]
  monthIndexes: number[]
  start: number
  currentMonth: number
  byFichaMonth: Map<string, Ocurrencia[]>
  encargadoMap: Record<string, Encargado>
  showFrecuencia: boolean
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
              return (
                <td key={month} className={cls || undefined}>
                  <Link
                    className={`grid-cell ${occ.estado}`}
                    to={`/ocurrencias/${occ.id}`}
                    title={occ.estado}
                  >
                    {occ.estado === 'ejecutada'
                      ? 'OK'
                      : occ.estado === 'vencida'
                        ? 'Ven'
                        : occ.estado === 'proxima'
                          ? 'Próx'
                          : '•'}
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
