import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays } from 'lucide-react'
import { db } from '../db'
import { ESTADOS, type EstadoOcurrencia } from '../db/types'
import { formatDateLong } from '../lib/dates'
import { EmptyState, StatusBadge } from '../components/ui'

export function CronogramaPage() {
  const [params, setParams] = useSearchParams()
  const estado = (params.get('estado') ?? '') as EstadoOcurrencia | ''
  const grupoId = params.get('grupo') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const fichaId = params.get('ficha') ?? ''
  const fecha = params.get('fecha') ?? ''
  const q = params.get('q') ?? ''

  const ocurrencias = useLiveQuery(() => db.ocurrencias.orderBy('fechaProgramada').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const grupos = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []

  const fichaMap = useMemo(
    () => Object.fromEntries(fichas.map((f) => [f.id, f])),
    [fichas],
  )
  const grupoMap = useMemo(
    () => Object.fromEntries(grupos.map((g) => [g.id, g])),
    [grupos],
  )
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const filtered = ocurrencias.filter((o) => {
    const ficha = fichaMap[o.fichaId]
    if (!ficha) return false
    if (estado && o.estado !== estado) return false
    if (grupoId && ficha.grupoId !== grupoId) return false
    if (encargadoId && ficha.encargadoId !== encargadoId) return false
    if (fichaId && ficha.id !== fichaId) return false
    if (fecha && o.fechaProgramada !== fecha) return false
    if (q && !ficha.nombre.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const grouped = new Map<string, typeof filtered>()
  for (const o of filtered) {
    const list = grouped.get(o.fechaProgramada) ?? []
    list.push(o)
    grouped.set(o.fechaProgramada, list)
  }

  if (!fichas.length) {
    return (
      <EmptyState
        icon={<CalendarDays size={36} />}
        title="Sin cronograma"
        text="Cuando existan fichas con frecuencia, aquí verás las fechas programadas."
        action={
          <Link className="btn btn-primary" to="/fichas/nueva">
            Nueva ficha
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <div className="chip-row">
        <button
          type="button"
          className={`chip${!estado ? ' active' : ''}`}
          onClick={() => set('estado', '')}
        >
          Todas
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`chip${estado === e.id ? ' active' : ''}`}
            onClick={() => set('estado', e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder="Buscar ficha"
          value={q}
          onChange={(e) => set('q', e.target.value)}
        />
        <select className="select" value={grupoId} onChange={(e) => set('grupo', e.target.value)}>
          <option value="">Grupo</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={encargadoId}
          onChange={(e) => set('encargado', e.target.value)}
        >
          <option value="">Encargado</option>
          {encargados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <select className="select" value={fichaId} onChange={(e) => set('ficha', e.target.value)}>
          <option value="">Ficha</option>
          {fichas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      </div>

      {fecha ? (
        <p className="muted">
          Filtrando {formatDateLong(fecha)}.{' '}
          <button type="button" className="btn btn-ghost" onClick={() => set('fecha', '')}>
            Quitar fecha
          </button>
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <div className="card muted">No hay ocurrencias con esos filtros.</div>
      ) : (
        [...grouped.entries()].map(([day, items]) => (
          <section key={day}>
            <div className="date-group">{formatDateLong(day)}</div>
            <div className="list">
              {items.map((o) => {
                const ficha = fichaMap[o.fichaId]
                const grupo = ficha ? grupoMap[ficha.grupoId] : undefined
                const encargado = ficha ? encargadoMap[ficha.encargadoId] : undefined
                return (
                  <Link key={o.id} className="card card-click item" to={`/ocurrencias/${o.id}`}>
                    <span className="bar" style={{ background: grupo?.color ?? 'var(--accent)' }} />
                    <div className="grow">
                      <div className="row-spread">
                        <strong>{ficha?.nombre ?? 'Ficha'}</strong>
                        <StatusBadge estado={o.estado} />
                      </div>
                      <div className="muted">
                        {grupo?.nombre}
                        {encargado ? ` · ${encargado.nombre}` : ''}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
