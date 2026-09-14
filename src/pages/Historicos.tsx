import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowUpDown,
  CalendarDays,
  CircleDot,
  FolderTree,
  History,
  Layers,
} from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS,
  esExtraordinaria,
  prioridadOf,
  prioridadRank,
  tipoAccionOf,
  tipoActividadColor,
  type AccionCorrectiva,
  type Actividad,
  type EstadoOcurrencia,
  type Ficha,
} from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { formatDate, formatFechaProgramada } from '../lib/dates'
import { accionHref, estadoAgendaCorrectiva } from '../lib/acciones'
import { actividadTitulo } from '../lib/actividades'
import { fichaTitulo } from '../lib/fichas'
import { ActividadTitle } from '../components/ActividadTitle'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { EmptyState, ExtraBadge, StatusBadge, StatusWordsToggle, TipoBadge } from '../components/ui'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import { useTiposActividad } from '../hooks/useTiposActividad'

type AccGroup = 'lista' | 'fecha' | 'prioridad' | 'estado' | 'ficha'
type AccSort = 'fecha' | 'prioridad' | 'reciente'

function sortAcciones(rows: AccionCorrectiva[], sort: AccSort): AccionCorrectiva[] {
  return [...rows].sort((a, b) => {
    if (sort === 'prioridad') {
      const d = prioridadRank(prioridadOf(a)) - prioridadRank(prioridadOf(b))
      if (d) return d
    }
    if (sort === 'fecha') {
      if (a.fechaObjetivo && b.fechaObjetivo) return a.fechaObjetivo.localeCompare(b.fechaObjetivo)
      if (a.fechaObjetivo) return -1
      if (b.fechaObjetivo) return 1
    }
    return b.updatedAt - a.updatedAt
  })
}

function groupAcciones(
  rows: AccionCorrectiva[],
  group: AccGroup,
  fichaMap: Record<string, Ficha>,
  actividadMap: Record<string, Actividad>,
): { key: string; label: string; items: AccionCorrectiva[] }[] {
  if (group === 'lista') return [{ key: 'all', label: '', items: rows }]

  const buckets = new Map<string, AccionCorrectiva[]>()
  const labels = new Map<string, string>()

  function push(key: string, label: string, item: AccionCorrectiva) {
    const list = buckets.get(key) ?? []
    list.push(item)
    buckets.set(key, list)
    labels.set(key, label)
  }

  for (const a of rows) {
    if (group === 'fecha') {
      push(a.fechaObjetivo ? 'con' : 'sin', a.fechaObjetivo ? 'Con fecha' : 'Sin fecha', a)
    } else if (group === 'prioridad') {
      const p = prioridadOf(a)
      push(p, p === 'alta' ? 'Alta' : p === 'media' ? 'Media' : 'Baja', a)
    } else if (group === 'estado') {
      const estado = estadoAgendaCorrectiva(a)
      const meta = ESTADOS.find((s) => s.id === estado)
      push(estado, meta?.label ?? estado, a)
    } else {
      if (a.actividadId) {
        const act = actividadMap[a.actividadId]
        push(`act:${a.actividadId}`, act ? actividadTitulo(act) : 'Actividad', a)
      } else {
        const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
        push(`ficha:${a.fichaId ?? 'none'}`, ficha ? fichaTitulo(ficha) : 'Sin ficha', a)
      }
    }
  }

  const order =
    group === 'fecha'
      ? ['con', 'sin']
      : group === 'prioridad'
        ? ['alta', 'media', 'baja']
        : group === 'estado'
          ? ESTADOS.map((s) => s.id)
          : [...buckets.keys()].sort((a, b) => (labels.get(a) ?? '').localeCompare(labels.get(b) ?? '', 'es'))

  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, label: labels.get(key) ?? key, items: buckets.get(key) ?? [] }))
}

export function HistoricosPage() {
  const [tab, setTab] = useState<'ocurrencias' | 'acciones'>('ocurrencias')
  const [groupBy, setGroupBy] = useState<'ficha' | 'fecha'>('ficha')
  const [estadoAcc, setEstadoAcc] = useState<EstadoOcurrencia | ''>('')
  const [groupAcc, setGroupAcc] = useState<AccGroup>('lista')
  const [sortAcc, setSortAcc] = useState<AccSort>('fecha')
  const tipos = useTiposActividad()

  const ocurrencias =
    useLiveQuery(async () => {
      const rows = await db.ocurrencias.where('estado').equals('ejecutada').toArray()
      return rows.sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    }) ?? []
  const eventos =
    useLiveQuery(async () => {
      const rows = await db.eventos.where('estado').equals('ejecutada').toArray()
      return rows.sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    }) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.toArray()) ?? []
  const acciones =
    useLiveQuery(async () => {
      const rows = await db.accionesCorrectivas.toArray()
      return rows.filter((a) => tipoAccionOf(a) === 'correctiva')
    }) ?? []

  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const actividadMap = useMemo(
    () => Object.fromEntries(actividades.map((a) => [a.id, a])),
    [actividades],
  )
  const bloqueMap = useMemo(() => Object.fromEntries(bloques.map((b) => [b.id, b])), [bloques])

  const accionesPorOcc = useMemo(() => {
    const map = new Map<string, AccionCorrectiva[]>()
    for (const a of acciones) {
      if (!a.ocurrenciaId) continue
      const list = map.get(a.ocurrenciaId) ?? []
      list.push(a)
      map.set(a.ocurrenciaId, list)
    }
    return map
  }, [acciones])
  const accionesPorEvento = useMemo(() => {
    const map = new Map<string, AccionCorrectiva[]>()
    for (const a of acciones) {
      if (!a.eventoId) continue
      const list = map.get(a.eventoId) ?? []
      list.push(a)
      map.set(a.eventoId, list)
    }
    return map
  }, [acciones])

  const byFicha = new Map<string, typeof ocurrencias>()
  for (const o of ocurrencias) {
    const list = byFicha.get(o.fichaId) ?? []
    list.push(o)
    byFicha.set(o.fichaId, list)
  }

  const byFechaOcc = new Map<string, typeof ocurrencias>()
  for (const o of ocurrencias) {
    const list = byFechaOcc.get(o.fechaProgramada) ?? []
    list.push(o)
    byFechaOcc.set(o.fechaProgramada, list)
  }
  const byActividad = new Map<string, typeof eventos>()
  for (const e of eventos) {
    const list = byActividad.get(e.actividadId) ?? []
    list.push(e)
    byActividad.set(e.actividadId, list)
  }
  const byFechaEvt = new Map<string, typeof eventos>()
  for (const e of eventos) {
    const list = byFechaEvt.get(e.fechaProgramada) ?? []
    list.push(e)
    byFechaEvt.set(e.fechaProgramada, list)
  }

  const fichasOrdenadas = [...byFicha.keys()].sort((a, b) => {
    const fa = fichaMap[a]
    const fb = fichaMap[b]
    if (!fa || !fb) return 0
    return fichaTitulo(fa).localeCompare(fichaTitulo(fb), 'es')
  })

  const fechasOrdenadas = [
    ...new Set([...byFechaOcc.keys(), ...byFechaEvt.keys()]),
  ].sort((a, b) => b.localeCompare(a))
  const actividadesOrdenadas = [...byActividad.keys()].sort((a, b) => {
    const aa = actividadMap[a]
    const ab = actividadMap[b]
    if (!aa || !ab) return 0
    return actividadTitulo(aa).localeCompare(actividadTitulo(ab), 'es')
  })

  const accionesFiltradas = sortAcciones(
    acciones.filter((a) => !estadoAcc || estadoAgendaCorrectiva(a) === estadoAcc),
    sortAcc,
  )
  const gruposAcc = groupAcciones(accionesFiltradas, groupAcc, fichaMap, actividadMap)

  const filterTools = useMemo<FilterTool[]>(() => {
    if (tab === 'acciones') {
      return [
        {
          id: 'estado',
          label: 'Estado',
          icon: CircleDot,
          active: Boolean(estadoAcc),
          content: (
            <div className="chip-row tight" role="tablist" aria-label="Estado">
              <button
                type="button"
                className={`chip compact${!estadoAcc ? ' active' : ''}`}
                onClick={() => setEstadoAcc('')}
              >
                Todos
              </button>
              {ESTADOS.map((s) => (
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
          ),
        },
        {
          id: 'agrupar',
          label: 'Agrupar',
          icon: Layers,
          active: groupAcc !== 'lista',
          content: (
            <div className="chip-row tight" role="tablist" aria-label="Agrupar">
              {(
                [
                  ['lista', 'Lista'],
                  ['fecha', 'Fecha'],
                  ['prioridad', 'Prioridad'],
                  ['estado', 'Estado'],
                  ['ficha', 'Origen'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip compact${groupAcc === id ? ' active' : ''}`}
                  onClick={() => setGroupAcc(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ),
        },
        {
          id: 'ordenar',
          label: 'Ordenar',
          icon: ArrowUpDown,
          active: sortAcc !== 'fecha',
          content: (
            <div className="chip-row tight" role="tablist" aria-label="Ordenar">
              {(
                [
                  ['fecha', 'Fecha'],
                  ['prioridad', 'Prioridad'],
                  ['reciente', 'Recientes'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip compact${sortAcc === id ? ' active' : ''}`}
                  onClick={() => setSortAcc(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          ),
        },
      ]
    }
    return [
      {
        id: 'ficha',
        label: 'Por ficha',
        icon: FolderTree,
        active: groupBy === 'ficha',
        onClick: () => setGroupBy('ficha'),
      },
      {
        id: 'fecha',
        label: 'Por fecha',
        icon: CalendarDays,
        active: groupBy === 'fecha',
        onClick: () => setGroupBy('fecha'),
      },
    ]
  }, [tab, estadoAcc, groupAcc, sortAcc, groupBy])

  if (!ocurrencias.length && !eventos.length && !acciones.length) {
    return (
      <EmptyState
        icon={<History size={36} />}
        title="Sin histórico"
        text="Cuando ejecutes fichas, actividades o registres acciones correctivas, aparecerán aquí."
      />
    )
  }

  return (
    <div>
      <FilterDrawerSlot
        title={tab === 'acciones' ? 'Correctivas' : 'Ejecutadas'}
        tools={filterTools}
        canClear={
          tab === 'acciones'
            ? Boolean(estadoAcc || groupAcc !== 'lista' || sortAcc !== 'fecha')
            : groupBy !== 'ficha'
        }
        onClear={() => {
          if (tab === 'acciones') {
            setEstadoAcc('')
            setGroupAcc('lista')
            setSortAcc('fecha')
            return
          }
          setGroupBy('ficha')
        }}
      />
      <div className="hist-toolbar">
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
        <StatusWordsToggle />
      </div>

      {tab === 'ocurrencias' ? (
        <>
          {ocurrencias.length === 0 && eventos.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">Aún no hay inspecciones ni actividades ejecutadas.</p>
            </div>
          ) : groupBy === 'ficha' ? (
            <div className="ejec-groups">
              {fichasOrdenadas.map((fichaId) => {
                const ficha = fichaMap[fichaId]
                const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                const rows = (byFicha.get(fichaId) ?? []).sort((a, b) =>
                  b.fechaProgramada.localeCompare(a.fechaProgramada),
                )
                return (
                  <section key={fichaId} className="ejec-group">
                    <h3 className="ejec-group-title">
                      <FichaTitle ficha={ficha} color={bloque?.color} />
                    </h3>
                    <div className="ejec-tiles">
                      {rows.map((o) => (
                        <EjecutadaTile
                          key={o.id}
                          href={`/ocurrencias/${o.id}`}
                          label={formatFechaProgramada(
                            o.fechaProgramada,
                            ficha?.fechaPrecision === 'dia' ? 'dia' : 'mes',
                          )}
                          color={bloque?.color}
                          extra={esExtraordinaria(o)}
                          acciones={accionesPorOcc.get(o.id)?.length ?? 0}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
              {actividadesOrdenadas.map((actId) => {
                const act = actividadMap[actId]
                const rows = (byActividad.get(actId) ?? []).sort((a, b) =>
                  b.fechaProgramada.localeCompare(a.fechaProgramada),
                )
                return (
                  <section key={actId} className="ejec-group">
                    <h3 className="ejec-group-title">
                      <ActividadTitle actividad={act} />
                    </h3>
                    <div className="ejec-tiles">
                      {rows.map((e) => (
                        <EjecutadaTile
                          key={e.id}
                          href={`/eventos/${e.id}`}
                          label={formatFechaProgramada(
                            e.fechaProgramada,
                            act?.fechaPrecision === 'dia' ? 'dia' : 'mes',
                          )}
                          color={act ? tipoActividadColor(act.tipo, tipos) : undefined}
                          extra={esExtraordinaria(e)}
                          tipo={act?.tipo}
                          acciones={accionesPorEvento.get(e.id)?.length ?? 0}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="ejec-groups">
              {fechasOrdenadas.map((day) => {
                const occRows = byFechaOcc.get(day) ?? []
                const evtRows = byFechaEvt.get(day) ?? []
                const precision =
                  fichaMap[occRows[0]?.fichaId ?? '']?.fechaPrecision === 'dia' ||
                  actividadMap[evtRows[0]?.actividadId ?? '']?.fechaPrecision === 'dia'
                    ? 'dia'
                    : 'mes'
                return (
                  <section key={day} className="ejec-group">
                    <h3 className="ejec-group-title">{formatFechaProgramada(day, precision)}</h3>
                    <div className="ejec-tiles">
                      {occRows.map((o) => {
                        const ficha = fichaMap[o.fichaId]
                        const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                        return (
                          <EjecutadaTile
                            key={o.id}
                            href={`/ocurrencias/${o.id}`}
                            label={ficha ? fichaTitulo(ficha) : 'Ficha'}
                            color={bloque?.color}
                            extra={esExtraordinaria(o)}
                            acciones={accionesPorOcc.get(o.id)?.length ?? 0}
                          />
                        )
                      })}
                      {evtRows.map((e) => {
                        const act = actividadMap[e.actividadId]
                        return (
                          <EjecutadaTile
                            key={e.id}
                            href={`/eventos/${e.id}`}
                            label={act ? actividadTitulo(act) : 'Actividad'}
                            color={act ? tipoActividadColor(act.tipo, tipos) : undefined}
                            extra={esExtraordinaria(e)}
                            tipo={act?.tipo}
                            acciones={accionesPorEvento.get(e.id)?.length ?? 0}
                          />
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {accionesFiltradas.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">No hay registros con esos filtros.</p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-hist-acc">
                <span>Registro</span>
                <span className="col-md">Origen</span>
                <span className="col-md">Fecha</span>
                <span className="col-md">Prioridad</span>
                <span>Estado</span>
              </div>
              {gruposAcc.map((grupo) => (
                <section key={grupo.key}>
                  {grupo.label ? <div className="table-section">{grupo.label}</div> : null}
                  {grupo.items.map((a) => {
                    const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
                    const act = a.actividadId ? actividadMap[a.actividadId] : undefined
                    const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                    const origen = act ? actividadTitulo(act) : ficha ? fichaTitulo(ficha) : ''
                    return (
                      <Link key={a.id} className="table-row table-cols-hist-acc" to={accionHref(a)}>
                        <span className="table-cell">
                          <strong>{a.texto}</strong>
                          <span className="muted col-sm-only">
                            {origen}
                            {a.fechaObjetivo ? `${origen ? ' · ' : ''}${formatDate(a.fechaObjetivo)}` : ''}
                            {' · '}
                            <PrioridadMark prioridad={prioridadOf(a)} />
                          </span>
                        </span>
                        <span className="col-md">
                          {act ? (
                            <ActividadTitle actividad={act} />
                          ) : (
                            <FichaTitle ficha={ficha} color={bloque?.color} />
                          )}
                        </span>
                        <span className="col-md muted table-nowrap">
                          {a.fechaObjetivo ? formatDate(a.fechaObjetivo) : '—'}
                        </span>
                        <span className="col-md">
                          <PrioridadMark prioridad={prioridadOf(a)} />
                        </span>
                        <StatusBadge estado={estadoAgendaCorrectiva(a)} />
                      </Link>
                    )
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EjecutadaTile({
  href,
  label,
  color,
  extra,
  tipo,
  acciones,
}: {
  href: string
  label: string
  color?: string
  extra?: boolean
  tipo?: string
  acciones: number
}) {
  return (
    <Link className="ejec-tile" to={href}>
      <span className="ejec-tile-bar" style={{ background: bloqueColorVar(color) }} />
      <span className="ejec-tile-label">{label}</span>
      <span className="ejec-tile-meta">
        {extra ? <ExtraBadge /> : null}
        {tipo ? <TipoBadge tipo={tipo} /> : null}
        {acciones ? <span className="ejec-tile-acc">▴ {acciones}</span> : null}
      </span>
    </Link>
  )
}
