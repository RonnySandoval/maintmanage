import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import { db } from '../db'
import { ESTADOS, type EstadoOcurrencia } from '../db/types'
import { formatFechaProgramada, formatDateLong } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { EmptyState, LeyendaSimbolos, StatusBadge } from '../components/ui'
import { SIMBOLOS_ESTADO } from '../lib/simbolos'
import { GrillaAnual } from '../components/GrillaAnual'
import { FichaTitle } from '../components/FichaTitle'

export function CronogramaPage() {
  const [params, setParams] = useSearchParams()
  const estado = (params.get('estado') ?? '') as EstadoOcurrencia | ''
  const bloqueId = params.get('bloque') ?? params.get('grupo') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const fichaId = params.get('ficha') ?? ''
  const fecha = params.get('fecha') ?? ''
  const q = params.get('q') ?? ''
  const vista = params.get('vista') === 'lista' ? 'lista' : 'grilla'
  const year = Number(params.get('anio')) || new Date().getFullYear()

  const ocurrencias = useLiveQuery(() => db.ocurrencias.orderBy('fechaProgramada').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const acciones = useLiveQuery(() => db.accionesCorrectivas.toArray()) ?? []

  const fichaMap = useMemo(
    () => Object.fromEntries(fichas.map((f) => [f.id, f])),
    [fichas],
  )
  const bloqueMap = useMemo(
    () => Object.fromEntries(bloques.map((b) => [b.id, b])),
    [bloques],
  )
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )

  function set(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'bloque') next.delete('grupo')
    setParams(next, { replace: true })
  }

  const fichasFiltradas = fichas.filter((ficha) => {
    if (bloqueId && ficha.grupoId !== bloqueId) return false
    if (encargadoId && ficha.encargadoId !== encargadoId) return false
    if (fichaId && ficha.id !== fichaId) return false
    if (q && !`${ficha.numero} ${ficha.nombre}`.toLowerCase().includes(q.toLowerCase())) {
      return false
    }
    return true
  })

  const filtered = ocurrencias.filter((o) => {
    const ficha = fichaMap[o.fichaId]
    if (!ficha) return false
    if (!fichasFiltradas.some((f) => f.id === ficha.id)) return false
    if (estado && o.estado !== estado) return false
    if (fecha && o.fechaProgramada !== fecha) return false
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
        text="Cuando existan fichas con periodo, aquí verás las fechas programadas."
        action={
          <Link className="btn btn-add" to="/fichas/nueva">
            Nueva ficha
          </Link>
        }
      />
    )
  }

  return (
    <div>
      <div className="crono-toolbar">
        <div className="seg-toggle compact" role="tablist" aria-label="Vista del cronograma">
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'grilla'}
            className={vista === 'grilla' ? 'active' : ''}
            onClick={() => set('vista', '')}
          >
            <LayoutGrid size={14} />
            Grilla
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={vista === 'lista'}
            className={vista === 'lista' ? 'active' : ''}
            onClick={() => set('vista', 'lista')}
          >
            <List size={14} />
            Lista
          </button>
        </div>
        {vista === 'grilla' ? (
          <div className="year-stepper">
            <button
              type="button"
              className="icon-btn"
              aria-label="Año anterior"
              onClick={() => set('anio', String(year - 1))}
            >
              <ChevronLeft size={18} />
            </button>
            <strong>{year}</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label="Año siguiente"
              onClick={() => set('anio', String(year + 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="chip-row compact">
        <button
          type="button"
          className={`chip compact${!estado ? ' active' : ''}`}
          onClick={() => set('estado', '')}
        >
          Todas
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            type="button"
            className={`chip compact${estado === e.id ? ' active' : ''}`}
            onClick={() => set('estado', e.id)}
          >
            <span className="sym" aria-hidden>
              {SIMBOLOS_ESTADO[e.id].glyph}
            </span>
            {e.label}
          </button>
        ))}
      </div>

      <div className="filters compact">
        <input
          className="input"
          placeholder="Buscar"
          value={q}
          onChange={(e) => set('q', e.target.value)}
        />
        <select className="select" value={bloqueId} onChange={(e) => set('bloque', e.target.value)}>
          <option value="">Bloque</option>
          {bloques.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
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
              {fichaTitulo(f)}
            </option>
          ))}
        </select>
      </div>

      {vista === 'grilla' ? (
        <GrillaAnual
          year={year}
          fichas={fichasFiltradas}
          bloques={bloques}
          encargados={encargados}
          ocurrencias={estado || fecha ? filtered : ocurrencias.filter((o) =>
            fichasFiltradas.some((f) => f.id === o.fichaId),
          )}
          acciones={acciones}
        />
      ) : (
        <>
          {fecha ? (
            <p className="muted">
              Filtrando {formatDateLong(fecha)}.{' '}
              <button type="button" className="btn btn-ghost" onClick={() => set('fecha', '')}>
                Quitar fecha
              </button>
            </p>
          ) : null}

          {filtered.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">No hay ocurrencias con esos filtros.</p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-crono">
                <span className="table-bar" aria-hidden />
                <span>Ficha</span>
                <span className="col-md">Bloque</span>
                <span className="col-md">Encargado</span>
                <span>Estado</span>
              </div>
              {[...grouped.entries()].map(([day, items]) => (
                <section key={day}>
                  <div className="table-section">
                    {formatFechaProgramada(
                      day,
                      fichaMap[items[0]?.fichaId ?? '']?.fechaPrecision === 'dia' ? 'dia' : 'mes',
                    )}
                  </div>
                  {items.map((o) => {
                    const ficha = fichaMap[o.fichaId]
                    const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                    const encargado = ficha ? encargadoMap[ficha.encargadoId ?? ''] : undefined
                    return (
                      <Link
                        key={o.id}
                        className="table-row table-cols-crono"
                        to={`/ocurrencias/${o.id}`}
                      >
                        <span
                          className="table-bar"
                          style={{ background: bloque?.color ?? 'var(--accent)' }}
                        />
                        <span className="table-cell">
                          <FichaTitle ficha={ficha} color={bloque?.color} />
                          <span className="muted col-sm-only">
                            {bloque?.nombre}
                            {encargado ? ` · ${encargado.nombre}` : ''}
                          </span>
                        </span>
                        <span className="col-md muted">{bloque?.nombre ?? '—'}</span>
                        <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                        <span className="table-nowrap">
                          <StatusBadge estado={o.estado} />
                        </span>
                      </Link>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
          <LeyendaSimbolos />
        </>
      )}
    </div>
  )
}
