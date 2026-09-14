import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowUpDown,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleDot,
  FolderTree,
  History,
  Layers,
  Pencil,
} from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS,
  esExtraordinaria,
  prioridadOf,
  prioridadRank,
  tipoAccionOf,
  type AccionCorrectiva,
  type Actividad,
  type EstadoOcurrencia,
  type Ejecucion,
  type Encargado,
  type Evento,
  type Ficha,
  type Ocurrencia,
} from '../db/types'
import { bloqueColorVar, kindActividadVar } from '../lib/colors'
import { formatDate, formatFechaProgramada, monthLabel, monthValue } from '../lib/dates'
import { accionHref, estadoAgendaCorrectiva } from '../lib/acciones'
import { actividadTitulo } from '../lib/actividades'
import { fichaTitulo } from '../lib/fichas'
import { ActividadTitle } from '../components/ActividadTitle'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { EjecucionModal } from '../components/EjecucionForm'
import { ShareMenu } from '../components/ShareMenu'
import { CorrectivaBadge, EmptyState, ExtraBadge, StatusBadge, StatusWordsToggle, TipoBadge } from '../components/ui'
import { EntityCard } from '../components/EntityCard'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'

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
  const [groupBy, setGroupBy] = useState<'ficha' | 'bloque' | 'fecha'>('ficha')
  const [estadoAcc, setEstadoAcc] = useState<EstadoOcurrencia | ''>('')
  const [groupAcc, setGroupAcc] = useState<AccGroup>('lista')
  const [sortAcc, setSortAcc] = useState<AccSort>('fecha')
  const [openOcc, setOpenOcc] = useState<string | null>(null)

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
  const encargados = useLiveQuery(() => db.encargados.toArray()) ?? []
  const ejecuciones = useLiveQuery(() => db.ejecuciones.toArray()) ?? []
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
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
  const ejecucionMap = useMemo(
    () =>
      Object.fromEntries(
        ejecuciones
          .filter((e) => e.ocurrenciaId)
          .map((e) => [e.ocurrenciaId as string, e]),
      ),
    [ejecuciones],
  )
  const ejecucionEventoMap = useMemo(
    () =>
      Object.fromEntries(
        ejecuciones.filter((e) => e.eventoId).map((e) => [e.eventoId as string, e]),
      ),
    [ejecuciones],
  )

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
    const key = monthValue(o.fechaProgramada)
    const list = byFechaOcc.get(key) ?? []
    list.push(o)
    byFechaOcc.set(key, list)
  }
  const byActividad = new Map<string, typeof eventos>()
  for (const e of eventos) {
    const list = byActividad.get(e.actividadId) ?? []
    list.push(e)
    byActividad.set(e.actividadId, list)
  }
  const byFechaEvt = new Map<string, typeof eventos>()
  for (const e of eventos) {
    const key = monthValue(e.fechaProgramada)
    const list = byFechaEvt.get(key) ?? []
    list.push(e)
    byFechaEvt.set(key, list)
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

  const byBloque = new Map<string, typeof ocurrencias>()
  for (const o of ocurrencias) {
    const key = fichaMap[o.fichaId]?.grupoId ?? 'none'
    const list = byBloque.get(key) ?? []
    list.push(o)
    byBloque.set(key, list)
  }
  const bloquesOrdenados = [...byBloque.keys()].sort((a, b) => {
    if (a === 'none') return 1
    if (b === 'none') return -1
    return (bloqueMap[a]?.nombre ?? '').localeCompare(bloqueMap[b]?.nombre ?? '', 'es')
  })
  const eventosPorFecha = [...eventos].sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))

  const accionesFiltradas = sortAcciones(
    acciones.filter((a) => !estadoAcc || estadoAgendaCorrectiva(a) === estadoAcc),
    sortAcc,
  )
  const gruposAcc = groupAcciones(accionesFiltradas, groupAcc, fichaMap, actividadMap)

  function toggleOcc(id: string) {
    setOpenOcc((current) => (current === id ? null : id))
  }

  function renderOccRow(o: Ocurrencia, hideTitle: boolean) {
    const ficha = fichaMap[o.fichaId]
    const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
    return (
      <EjecutadaRow
        key={o.id}
        occ={o}
        ficha={ficha}
        color={bloque?.color}
        encargado={ficha?.encargadoId ? encargadoMap[ficha.encargadoId] : undefined}
        ejecucion={ejecucionMap[o.id]}
        acciones={accionesPorOcc.get(o.id) ?? []}
        hideTitle={hideTitle}
        open={openOcc === o.id}
        onToggle={() => toggleOcc(o.id)}
      />
    )
  }

  function renderEvtRow(e: Evento, hideTitle: boolean) {
    const act = actividadMap[e.actividadId]
    return (
      <EjecutadaRow
        key={e.id}
        evento={e}
        actividad={act}
        encargado={act?.encargadoId ? encargadoMap[act.encargadoId] : undefined}
        ejecucion={ejecucionEventoMap[e.id]}
        acciones={accionesPorEvento.get(e.id) ?? []}
        hideTitle={hideTitle}
        open={openOcc === e.id}
        onToggle={() => toggleOcc(e.id)}
      />
    )
  }

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
        id: 'bloque',
        label: 'Por bloque',
        icon: Boxes,
        active: groupBy === 'bloque',
        onClick: () => setGroupBy('bloque'),
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
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-hist-occ">
                <span className="table-bar" aria-hidden />
                <span>Origen</span>
                <span className="col-md">Acciones</span>
                <span>Estado</span>
              </div>
              {groupBy === 'ficha' ? (
                <>
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
                        {rows.map((o) => renderOccRow(o, true))}
                      </section>
                    )
                  })}
                  {actividadesOrdenadas.map((actId) => {
                    const act = actividadMap[actId]
                    const rows = (byActividad.get(actId) ?? []).sort((a, b) =>
                      b.fechaProgramada.localeCompare(a.fechaProgramada),
                    )
                    return (
                      <section key={actId}>
                        <div className="table-section">
                          <span className="occ-meta">
                            <ActividadTitle actividad={act} />
                            {act ? <TipoBadge tipo={act.tipo} /> : null}
                          </span>
                        </div>
                        {rows.map((e) => renderEvtRow(e, true))}
                      </section>
                    )
                  })}
                </>
              ) : groupBy === 'bloque' ? (
                <>
                  {bloquesOrdenados.map((bloqueId) => {
                    const bloque = bloqueMap[bloqueId]
                    const rows = (byBloque.get(bloqueId) ?? []).sort((a, b) =>
                      b.fechaProgramada.localeCompare(a.fechaProgramada),
                    )
                    return (
                      <section key={bloqueId}>
                        <div
                          className="table-section"
                          style={bloque ? { color: bloqueColorVar(bloque.color) } : undefined}
                        >
                          {bloque?.nombre ?? 'Sin bloque'}
                        </div>
                        {rows.map((o) => renderOccRow(o, false))}
                      </section>
                    )
                  })}
                  {eventosPorFecha.length ? (
                    <section>
                      <div className="table-section">Actividades</div>
                      {eventosPorFecha.map((e) => renderEvtRow(e, false))}
                    </section>
                  ) : null}
                </>
              ) : (
                fechasOrdenadas.map((month) => {
                  const occRows = byFechaOcc.get(month) ?? []
                  const evtRows = byFechaEvt.get(month) ?? []
                  const mixed = [
                    ...occRows.map((o) => ({ kind: 'occ' as const, fecha: o.fechaProgramada, o })),
                    ...evtRows.map((e) => ({ kind: 'evt' as const, fecha: e.fechaProgramada, e })),
                  ].sort((a, b) => b.fecha.localeCompare(a.fecha))
                  return (
                    <section key={month}>
                      <div className="table-section">{monthLabel(month)}</div>
                      {mixed.map((item) =>
                        item.kind === 'occ' ? renderOccRow(item.o, false) : renderEvtRow(item.e, false),
                      )}
                    </section>
                  )
                })
              )}
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

function EjecutadaRow({
  occ,
  evento,
  ficha,
  actividad,
  color,
  encargado,
  ejecucion,
  acciones,
  hideTitle,
  open,
  onToggle,
}: {
  occ?: Ocurrencia
  evento?: Evento
  ficha?: Ficha
  actividad?: Actividad
  color?: string
  encargado?: Encargado
  ejecucion?: Ejecucion
  acciones: AccionCorrectiva[]
  hideTitle?: boolean
  open: boolean
  onToggle: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const item = occ ?? evento
  if (!item) return null
  const href = occ ? `/ocurrencias/${occ.id}` : `/eventos/${evento?.id}`
  const precision =
    (ficha?.fechaPrecision ?? actividad?.fechaPrecision) === 'dia' ? 'dia' : 'mes'
  const barColor = actividad ? kindActividadVar() : bloqueColorVar(color)
  const fecha = formatFechaProgramada(item.fechaProgramada, precision)
  const shareTitle = ficha ? fichaTitulo(ficha) : actividad ? actividadTitulo(actividad) : 'Ejecución'
  const shareText = [
    ficha ? `Ficha: ${fichaTitulo(ficha)}` : '',
    actividad ? `Actividad: ${actividadTitulo(actividad)}` : '',
    `Programada: ${item.fechaProgramada}`,
    ejecucion?.fechaReal ? `Realizada: ${ejecucion.fechaReal}` : '',
    ejecucion?.realizadoPor ? `Realizado por: ${ejecucion.realizadoPor}` : '',
    encargado ? `Encargado: ${encargado.nombre}` : '',
    ejecucion?.observaciones ? `Observaciones: ${ejecucion.observaciones}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className={`hist-occ-item${open ? ' is-open' : ''}`}>
      <div className="table-row table-cols-hist-occ">
        <span className="table-bar" style={{ background: barColor }} />
        <Link className="table-cell hist-occ-main" to={href}>
          {!hideTitle && ficha ? <FichaTitle ficha={ficha} color={color} /> : null}
          {!hideTitle && actividad ? (
            <span className="occ-meta">
              <ActividadTitle actividad={actividad} />
              <TipoBadge tipo={actividad.tipo} />
            </span>
          ) : null}
          <span className="muted hist-occ-when">
            {fecha}
            {encargado ? ` · ${encargado.nombre}` : ''}
          </span>
          {esExtraordinaria(item) || (hideTitle && actividad) || acciones.length ? (
            <span className="occ-meta">
              {esExtraordinaria(item) ? <ExtraBadge /> : null}
              {hideTitle && actividad ? <TipoBadge tipo={actividad.tipo} /> : null}
              <CorrectivaBadge count={acciones.length} />
            </span>
          ) : null}
        </Link>
        <span className="col-md muted table-nowrap">{acciones.length || '—'}</span>
        <span className="table-nowrap hist-occ-end">
          <button
            type="button"
            className="icon-btn hist-occ-toggle"
            aria-expanded={open}
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle de la ejecución'}
            onClick={onToggle}
          >
            <ChevronDown size={16} className={open ? 'is-open' : ''} />
          </button>
          <StatusBadge estado="ejecutada" />
        </span>
      </div>
      {open ? (
        <div className="hist-occ-acciones">
          <EntityCard
            nested
            className="hist-occ-ejecucion"
            title={<strong>Ejecución</strong>}
            footer={
              ficha || actividad ? (
                <>
                  <span />
                  <div className="row" style={{ gap: 2 }}>
                    <button
                      type="button"
                      className="icon-btn icon-btn-edit"
                      aria-label="Editar ejecución"
                      title="Editar ejecución"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil size={16} />
                    </button>
                    <ShareMenu title={shareTitle} text={shareText} iconOnly />
                  </div>
                </>
              ) : null
            }
          >
            {ejecucion ? (
              <>
                <p>
                  Realizada el <strong>{formatDate(ejecucion.fechaReal)}</strong>
                  {ejecucion.realizadoPor ? ` · ${ejecucion.realizadoPor}` : ''}
                </p>
                {ejecucion.observaciones ? (
                  <p>{ejecucion.observaciones}</p>
                ) : (
                  <p className="muted">Sin observaciones.</p>
                )}
              </>
            ) : (
              <p className="muted">Sin registro de ejecución.</p>
            )}
          </EntityCard>
          {acciones.length ? (
            acciones.map((a) => (
              <Link key={a.id} className="hist-occ-accion" to={accionHref(a)}>
                <PrioridadMark prioridad={prioridadOf(a)} />
                <span className="grow">{a.texto}</span>
                <StatusBadge estado={estadoAgendaCorrectiva(a)} />
              </Link>
            ))
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Sin acciones correctivas.
            </p>
          )}
        </div>
      ) : null}
      {ficha && occ ? (
        <EjecucionModal
          open={editOpen}
          ocurrenciaId={occ.id}
          fichaId={ficha.id}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
      {actividad && evento ? (
        <EjecucionModal
          open={editOpen}
          eventoId={evento.id}
          actividadId={actividad.id}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  )
}
