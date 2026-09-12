import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowUpDown,
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
  ESTADOS_CORRECTIVA,
  esExtraordinaria,
  prioridadOf,
  prioridadRank,
  tipoAccionOf,
  type AccionCorrectiva,
  type EstadoCorrectiva,
  type Ejecucion,
  type Encargado,
  type Ficha,
  type Ocurrencia,
} from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { formatDate, formatFechaProgramada } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { EjecucionModal } from '../components/EjecucionForm'
import { ShareMenu } from '../components/ShareMenu'
import { EmptyState, ExtraBadge, StatusBadge } from '../components/ui'
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
      const meta = ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)
      push(a.estado, meta?.label ?? a.estado, a)
    } else {
      const ficha = fichaMap[a.fichaId]
      push(a.fichaId, ficha ? fichaTitulo(ficha) : 'Sin ficha', a)
    }
  }

  const order =
    group === 'fecha'
      ? ['con', 'sin']
      : group === 'prioridad'
        ? ['alta', 'media', 'baja']
        : group === 'estado'
          ? ESTADOS_CORRECTIVA.map((s) => s.id)
          : [...buckets.keys()].sort((a, b) => (labels.get(a) ?? '').localeCompare(labels.get(b) ?? '', 'es'))

  return order
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, label: labels.get(key) ?? key, items: buckets.get(key) ?? [] }))
}

export function HistoricosPage() {
  const [tab, setTab] = useState<'ocurrencias' | 'acciones'>('ocurrencias')
  const [groupBy, setGroupBy] = useState<'ficha' | 'fecha'>('ficha')
  const [estadoAcc, setEstadoAcc] = useState<EstadoCorrectiva | ''>('')
  const [groupAcc, setGroupAcc] = useState<AccGroup>('lista')
  const [sortAcc, setSortAcc] = useState<AccSort>('fecha')
  const [openOcc, setOpenOcc] = useState<string | null>(null)

  const ocurrencias =
    useLiveQuery(async () => {
      const rows = await db.ocurrencias.where('estado').equals('ejecutada').toArray()
      return rows.sort((a, b) => b.fechaProgramada.localeCompare(a.fechaProgramada))
    }) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.toArray()) ?? []
  const ejecuciones = useLiveQuery(() => db.ejecuciones.toArray()) ?? []
  const acciones =
    useLiveQuery(async () => {
      const rows = await db.accionesCorrectivas.toArray()
      return rows.filter((a) => tipoAccionOf(a) === 'correctiva')
    }) ?? []

  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const bloqueMap = useMemo(() => Object.fromEntries(bloques.map((b) => [b.id, b])), [bloques])
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
  const ejecucionMap = useMemo(
    () => Object.fromEntries(ejecuciones.map((e) => [e.ocurrenciaId, e])),
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

  const accionesFiltradas = sortAcciones(
    acciones.filter((a) => !estadoAcc || a.estado === estadoAcc),
    sortAcc,
  )
  const gruposAcc = groupAcciones(accionesFiltradas, groupAcc, fichaMap)

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
                  ['ficha', 'Ficha'],
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

  if (!ocurrencias.length && !acciones.length) {
    return (
      <EmptyState
        icon={<History size={36} />}
        title="Sin histórico"
        text="Cuando ejecutes fichas o registres acciones correctivas, aparecerán aquí."
      />
    )
  }

  function toggleOcc(id: string) {
    setOpenOcc((current) => (current === id ? null : id))
  }

  return (
    <div>
      <FilterDrawerSlot
        title={tab === 'acciones' ? 'Correctivas' : 'Ejecutadas'}
        tools={filterTools}
      />
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
          {ocurrencias.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">Aún no hay fichas ejecutadas.</p>
            </div>
          ) : groupBy === 'ficha' ? (
            <div className="table-card">
              <div className="table-head table-cols-hist-occ">
                <span className="table-bar" aria-hidden />
                <span>Fecha</span>
                <span className="sr-only">Detalle</span>
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
                      <EjecutadaRow
                        key={o.id}
                        occ={o}
                        ficha={ficha}
                        color={bloque?.color}
                        encargado={ficha ? encargadoMap[ficha.encargadoId ?? ''] : undefined}
                        ejecucion={ejecucionMap[o.id]}
                        variant="fecha"
                        acciones={accionesPorOcc.get(o.id) ?? []}
                        open={openOcc === o.id}
                        onToggle={() => toggleOcc(o.id)}
                      />
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
                <span className="sr-only">Detalle</span>
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
                        <EjecutadaRow
                          key={o.id}
                          occ={o}
                          ficha={ficha}
                          color={bloque?.color}
                          encargado={ficha ? encargadoMap[ficha.encargadoId ?? ''] : undefined}
                          ejecucion={ejecucionMap[o.id]}
                          variant="ficha"
                          acciones={accionesPorOcc.get(o.id) ?? []}
                          open={openOcc === o.id}
                          onToggle={() => toggleOcc(o.id)}
                        />
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
                <span className="col-md">Prioridad</span>
                <span>Estado</span>
              </div>
              {gruposAcc.map((grupo) => (
                <section key={grupo.key}>
                  {grupo.label ? <div className="table-section">{grupo.label}</div> : null}
                  {grupo.items.map((a) => {
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
                            {' · '}
                            <PrioridadMark prioridad={prioridadOf(a)} />
                          </span>
                        </span>
                        <span className="col-md">
                          <FichaTitle ficha={ficha} color={bloque?.color} />
                        </span>
                        <span className="col-md muted table-nowrap">
                          {a.fechaObjetivo ? formatDate(a.fechaObjetivo) : '—'}
                        </span>
                        <span className="col-md">
                          <PrioridadMark prioridad={prioridadOf(a)} />
                        </span>
                        <span className={`badge badge-${a.estado}`}>
                          {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                        </span>
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
  ficha,
  color,
  encargado,
  ejecucion,
  variant,
  acciones,
  open,
  onToggle,
}: {
  occ: Ocurrencia
  ficha?: Ficha
  color?: string
  encargado?: Encargado
  ejecucion?: Ejecucion
  variant: 'fecha' | 'ficha'
  acciones: AccionCorrectiva[]
  open: boolean
  onToggle: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const precision = ficha?.fechaPrecision === 'dia' ? 'dia' : 'mes'
  const shareText = [
    ficha ? `Ficha: ${fichaTitulo(ficha)}` : '',
    `Programada: ${occ.fechaProgramada}`,
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
        <span className="table-bar" style={{ background: bloqueColorVar(color) }} />
        <Link className="table-cell hist-occ-main" to={`/ocurrencias/${occ.id}`}>
          {variant === 'fecha' ? (
            <span className="occ-meta">
              {formatFechaProgramada(occ.fechaProgramada, precision)}
              {esExtraordinaria(occ) ? <ExtraBadge /> : null}
            </span>
          ) : (
            <span className="occ-meta">
              <FichaTitle ficha={ficha} color={color} />
              {esExtraordinaria(occ) ? <ExtraBadge /> : null}
            </span>
          )}
        </Link>
        <span className="table-nowrap hist-occ-end">
          <button
            type="button"
            className="icon-btn hist-occ-toggle"
            aria-expanded={open}
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle de la ejecución'}
            onClick={onToggle}
          >
            {acciones.length ? <span className="muted">{acciones.length}</span> : null}
            <ChevronDown size={16} className={open ? 'is-open' : ''} />
          </button>
          <StatusBadge estado="ejecutada" iconOnly />
        </span>
      </div>
      {open ? (
        <div className="hist-occ-acciones">
          <div className="hist-occ-ejecucion">
            <div className="row-spread" style={{ marginBottom: 6 }}>
              <strong>Ejecución</strong>
              <span className="row" style={{ gap: 2 }}>
                {ficha ? (
                  <>
                    <button
                      type="button"
                      className="icon-btn icon-btn-edit"
                      aria-label="Editar ejecución"
                      title="Editar ejecución"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil size={16} />
                    </button>
                    <ShareMenu title={fichaTitulo(ficha)} text={shareText} iconOnly />
                  </>
                ) : null}
              </span>
            </div>
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
          </div>
          {acciones.length ? (
            acciones.map((a) => (
              <Link key={a.id} className="hist-occ-accion" to={`/ocurrencias/${occ.id}`}>
                <PrioridadMark prioridad={prioridadOf(a)} />
                <span className="grow">{a.texto}</span>
                <span className={`badge badge-${a.estado}`}>
                  {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                </span>
              </Link>
            ))
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Sin acciones correctivas.
            </p>
          )}
        </div>
      ) : null}
      {ficha ? (
        <EjecucionModal
          open={editOpen}
          ocurrenciaId={occ.id}
          fichaId={ficha.id}
          onClose={() => setEditOpen(false)}
        />
      ) : null}
    </div>
  )
}
