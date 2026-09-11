import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { History } from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS_CORRECTIVA,
  tipoAccionOf,
  type EstadoCorrectiva,
} from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { formatDate, formatFechaProgramada } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { FichaTitle } from '../components/FichaTitle'
import { EmptyState, StatusBadge } from '../components/ui'

export function HistoricosPage() {
  const [tab, setTab] = useState<'ocurrencias' | 'acciones'>('ocurrencias')
  const [groupBy, setGroupBy] = useState<'ficha' | 'fecha'>('ficha')
  const [estadoAcc, setEstadoAcc] = useState<EstadoCorrectiva | ''>('')

  const ocurrencias =
    useLiveQuery(async () => {
      const rows = await db.ocurrencias.where('estado').equals('ejecutada').toArray()
      return rows.sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    }) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.toArray()) ?? []
  const acciones =
    useLiveQuery(async () => {
      const rows = await db.accionesCorrectivas.toArray()
      return rows.filter((a) => tipoAccionOf(a) === 'correctiva')
    }) ?? []

  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const bloqueMap = useMemo(() => Object.fromEntries(bloques.map((b) => [b.id, b])), [bloques])

  const byFicha = new Map<string, typeof ocurrencias>()
  for (const o of ocurrencias) {
    const list = byFicha.get(o.fichaId) ?? []
    list.push(o)
    byFicha.set(o.fichaId, list)
  }

  const byFecha = new Map<string, typeof ocurrencias>()
  for (const o of ocurrencias) {
    const list = byFecha.get(o.fechaProgramada) ?? []
    list.push(o)
    byFecha.set(o.fechaProgramada, list)
  }

  const fichasOrdenadas = [...byFicha.keys()].sort((a, b) => {
    const fa = fichaMap[a]
    const fb = fichaMap[b]
    if (!fa || !fb) return 0
    return fichaTitulo(fa).localeCompare(fichaTitulo(fb), 'es')
  })

  const fechasOrdenadas = [...byFecha.keys()].sort((a, b) => b.localeCompare(a))

  const accionesFiltradas = acciones
    .filter((a) => !estadoAcc || a.estado === estadoAcc)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  if (!ocurrencias.length && !acciones.length) {
    return (
      <EmptyState
        icon={<History size={36} />}
        title="Sin histórico"
        text="Cuando ejecutes fichas o registres acciones correctivas, aparecerán aquí."
      />
    )
  }

  return (
    <div>
      <div className="seg-toggle" role="tablist" aria-label="Histórico">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ocurrencias'}
          className={tab === 'ocurrencias' ? 'active' : ''}
          onClick={() => setTab('ocurrencias')}
        >
          Ejecutadas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'acciones'}
          className={tab === 'acciones' ? 'active' : ''}
          onClick={() => setTab('acciones')}
        >
          Correctivas
        </button>
      </div>

      {tab === 'ocurrencias' ? (
        <>
          <div className="seg-toggle compact" style={{ marginBottom: '0.65rem' }} role="tablist">
            <button
              type="button"
              className={groupBy === 'ficha' ? 'active' : ''}
              onClick={() => setGroupBy('ficha')}
            >
              Por ficha
            </button>
            <button
              type="button"
              className={groupBy === 'fecha' ? 'active' : ''}
              onClick={() => setGroupBy('fecha')}
            >
              Por fecha
            </button>
          </div>

          {ocurrencias.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">Aún no hay fichas ejecutadas.</p>
            </div>
          ) : groupBy === 'ficha' ? (
            <div className="table-card">
              <div className="table-head table-cols-hist-occ">
                <span className="table-bar" aria-hidden />
                <span>Fecha</span>
                <span>Estado</span>
              </div>
              {fichasOrdenadas.map((fichaId) => {
                const ficha = fichaMap[fichaId]
                const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                const rows = (byFicha.get(fichaId) ?? []).sort((a, b) =>
                  b.fechaProgramada.localeCompare(a.fechaProgramada),
                )
                return (
                  <section key={fichaId}>
                    <div className="table-section">
                      <FichaTitle ficha={ficha} color={bloque?.color} />
                    </div>
                    {rows.map((o) => (
                      <Link
                        key={o.id}
                        className="table-row table-cols-hist-occ"
                        to={`/ocurrencias/${o.id}`}
                      >
                        <span
                          className="table-bar"
                          style={{ background: bloqueColorVar(bloque?.color) }}
                        />
                        <span className="table-cell">
                          {formatFechaProgramada(
                            o.fechaProgramada,
                            ficha?.fechaPrecision === 'dia' ? 'dia' : 'mes',
                          )}
                        </span>
                        <span className="table-nowrap">
                          <StatusBadge estado={o.estado} />
                        </span>
                      </Link>
                    ))}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-hist-occ">
                <span className="table-bar" aria-hidden />
                <span>Ficha</span>
                <span>Estado</span>
              </div>
              {fechasOrdenadas.map((day) => {
                const rows = byFecha.get(day) ?? []
                const precision = fichaMap[rows[0]?.fichaId ?? '']?.fechaPrecision === 'dia' ? 'dia' : 'mes'
                return (
                  <section key={day}>
                    <div className="table-section">{formatFechaProgramada(day, precision)}</div>
                    {rows.map((o) => {
                      const ficha = fichaMap[o.fichaId]
                      const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                      return (
                        <Link
                          key={o.id}
                          className="table-row table-cols-hist-occ"
                          to={`/ocurrencias/${o.id}`}
                        >
                          <span
                            className="table-bar"
                            style={{ background: bloqueColorVar(bloque?.color) }}
                          />
                          <span className="table-cell">
                            <FichaTitle ficha={ficha} color={bloque?.color} />
                          </span>
                          <span className="table-nowrap">
                            <StatusBadge estado={o.estado} />
                          </span>
                        </Link>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="chip-row compact">
            <button
              type="button"
              className={`chip compact${!estadoAcc ? ' active' : ''}`}
              onClick={() => setEstadoAcc('')}
            >
              Todos los estados
            </button>
            {ESTADOS_CORRECTIVA.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip compact${estadoAcc === s.id ? ' active' : ''}`}
                onClick={() => setEstadoAcc(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {accionesFiltradas.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">No hay registros con esos filtros.</p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-hist-acc">
                <span>Registro</span>
                <span className="col-md">Ficha</span>
                <span className="col-md">Fecha</span>
                <span>Estado</span>
              </div>
              {accionesFiltradas.map((a) => {
                const ficha = fichaMap[a.fichaId]
                const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                const to = a.ocurrenciaId ? `/ocurrencias/${a.ocurrenciaId}` : `/fichas/${a.fichaId}`
                return (
                  <Link key={a.id} className="table-row table-cols-hist-acc" to={to}>
                    <span className="table-cell">
                      <strong>{a.texto}</strong>
                      <span className="muted col-sm-only">
                        {ficha ? fichaTitulo(ficha) : ''}
                        {a.fechaObjetivo ? `${ficha ? ' · ' : ''}${formatDate(a.fechaObjetivo)}` : ''}
                      </span>
                    </span>
                    <span className="col-md">
                      <FichaTitle ficha={ficha} color={bloque?.color} />
                    </span>
                    <span className="col-md muted table-nowrap">
                      {a.fechaObjetivo ? formatDate(a.fechaObjetivo) : '—'}
                    </span>
                    <span className={`badge badge-${a.estado}`}>
                      {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
