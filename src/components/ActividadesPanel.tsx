import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Plus, Search, SlidersHorizontal, Wrench } from 'lucide-react'
import { db } from '../db'
import {
  frecuenciaLabel,
  mesesDeFrecuencia,
  prioridadOf,
  tipoAccionOf,
  tipoActividadLabel,
} from '../db/types'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { accionHref, estadoAgendaCorrectiva } from '../lib/acciones'
import { bloqueColorVar, kindActividadVar } from '../lib/colors'
import { formatDate } from '../lib/dates'
import { compareActividadesByTitulo, estadoVigente } from '../lib/actividades'
import { accionLabel, label, useAliases } from '../lib/labels'
import { congregacionDe, congregacionLabel, fichaTitulo } from '../lib/fichas'
import { ActividadTitle } from './ActividadTitle'
import { PrioridadMark } from './PrioridadMark'
import { SortHeader } from './SortHeader'
import { TipoMark } from './TipoMark'
import { EmptyState, StatusBadge } from './ui'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import type { AccionCorrectiva, Actividad, Ficha } from '../db/types'

type ListRow =
  | { kind: 'act'; id: string; actividad: Actividad }
  | { kind: 'acc'; id: string; accion: AccionCorrectiva }

type GroupBy = 'tipo' | 'encargado' | 'congregacion'
type SortCol = 'titulo' | 'tipo' | 'encargado' | 'periodo'
type SortDir = 'asc' | 'desc'

function groupFromParam(value: string | null): GroupBy {
  if (value === 'encargado' || value === 'congregacion') return value
  return 'tipo'
}

function sortColFromParam(value: string | null): SortCol {
  if (value === 'tipo' || value === 'encargado' || value === 'periodo') return value
  return 'titulo'
}

function sortDirFromParam(value: string | null): SortDir {
  return value === 'desc' ? 'desc' : 'asc'
}

export function ActividadesPanel() {
  const [params, setParams] = useSearchParams()
  const tipoId = params.get('tipo') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const q = params.get('q') ?? ''
  const [searchText, setSearchText] = useState(q)
  const groupBy = groupFromParam(params.get('agrupar'))
  const sortCol = sortColFromParam(params.get('col'))
  const sortDir = sortDirFromParam(params.get('dir'))

  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const eventos = useLiveQuery(() => db.eventos.toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const acciones =
    useLiveQuery(async () => {
      const rows = await db.accionesCorrectivas.toArray()
      return rows.filter((a) => tipoAccionOf(a) === 'correctiva')
    }) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const tipos = useTiposActividad()
  const aliases = useAliases()
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
  const actividadMap = useMemo(
    () => Object.fromEntries(actividades.map((a) => [a.id, a])),
    [actividades],
  )
  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const eventosByAct = useMemo(() => {
    const map = new Map<string, typeof eventos>()
    for (const e of eventos) {
      const list = map.get(e.actividadId) ?? []
      list.push(e)
      map.set(e.actividadId, list)
    }
    return map
  }, [eventos])

  function patch(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    next.set('tab', 'actividades')
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    setSearchText(q)
  }, [q])

  function setFilter(key: string, value: string) {
    patch({ [key]: value || undefined })
  }

  function onSearchChange(value: string) {
    setSearchText(value)
    setFilter('q', value)
  }

  function setGroup(next: GroupBy) {
    patch({ agrupar: next === 'tipo' ? undefined : next })
  }

  function setSort(column: SortCol) {
    if (sortCol === column) {
      const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc'
      if (column === 'titulo' && nextDir === 'asc') patch({ col: undefined, dir: undefined })
      else
        patch({
          col: column === 'titulo' ? undefined : column,
          dir: nextDir === 'asc' ? undefined : nextDir,
        })
      return
    }
    patch({ col: column === 'titulo' ? undefined : column, dir: undefined })
  }

  const correctivaLabel = accionLabel('correctiva', aliases)

  function parentOf(accion: AccionCorrectiva): {
    actividad?: Actividad
    ficha?: Ficha
    encargadoId: string
  } {
    const actividad = accion.actividadId ? actividadMap[accion.actividadId] : undefined
    const ficha = accion.fichaId ? fichaMap[accion.fichaId] : undefined
    return {
      actividad,
      ficha,
      encargadoId: actividad?.encargadoId ?? ficha?.encargadoId ?? '',
    }
  }

  const filteredActs = useMemo(() => {
    return actividades.filter((a) => {
      if (tipoId && a.tipo !== tipoId) return false
      if (encargadoId && a.encargadoId !== encargadoId) return false
      if (q) {
        const hay = `${a.titulo} ${tipoActividadLabel(a.tipo, tipos)}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [actividades, tipoId, encargadoId, q, tipos])

  const filteredAcciones = useMemo(() => {
    const qLower = q.toLowerCase()
    return acciones.filter((a) => {
      const act = a.actividadId ? actividadMap[a.actividadId] : undefined
      const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
      if (tipoId && (!act || act.tipo !== tipoId)) return false
      if (encargadoId) {
        const enc = act?.encargadoId ?? ficha?.encargadoId
        if (enc !== encargadoId) return false
      }
      if (q) {
        const hay = `${a.texto} ${act?.titulo ?? ''} ${ficha ? fichaTitulo(ficha) : ''} ${correctivaLabel}`
        if (!hay.toLowerCase().includes(qLower)) return false
      }
      return true
    })
  }, [acciones, actividadMap, fichaMap, tipoId, encargadoId, q, correctivaLabel])

  const filtered: ListRow[] = useMemo(
    () => [
      ...filteredActs.map((actividad) => ({ kind: 'act' as const, id: actividad.id, actividad })),
      ...filteredAcciones.map((accion) => ({ kind: 'acc' as const, id: accion.id, accion })),
    ],
    [filteredActs, filteredAcciones],
  )

  const grouped = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1

    function encargadoName(row: ListRow) {
      if (row.kind === 'act') {
        return (row.actividad.encargadoId ? encargadoMap[row.actividad.encargadoId]?.nombre : '') ?? ''
      }
      const encId = parentOf(row.accion).encargadoId
      return (encId ? encargadoMap[encId]?.nombre : '') ?? ''
    }

    function tipoLabel(row: ListRow) {
      return row.kind === 'acc' ? correctivaLabel : tipoActividadLabel(row.actividad.tipo, tipos)
    }

    function titleOf(row: ListRow) {
      return row.kind === 'acc' ? row.accion.texto : row.actividad.titulo
    }

    function groupOf(row: ListRow): { key: string; label: string } {
      if (groupBy === 'encargado') {
        const name = encargadoName(row)
        const id = row.kind === 'act' ? row.actividad.encargadoId : parentOf(row.accion).encargadoId
        return { key: id || '__none', label: name || 'Sin encargado' }
      }
      if (groupBy === 'congregacion') {
        const encId = row.kind === 'act' ? row.actividad.encargadoId : parentOf(row.accion).encargadoId
        const key = congregacionDe(encId ? encargadoMap[encId] : undefined)
        return { key: key || '__none', label: congregacionLabel(key) }
      }
      if (row.kind === 'acc') return { key: '__correctiva', label: correctivaLabel }
      return { key: row.actividad.tipo, label: tipoActividadLabel(row.actividad.tipo, tipos) }
    }

    function compareRows(a: ListRow, b: ListRow) {
      if (sortCol === 'tipo') {
        const cmp = tipoLabel(a).localeCompare(tipoLabel(b), 'es')
        return cmp !== 0 ? cmp * dir : titleOf(a).localeCompare(titleOf(b), 'es') * dir
      }
      if (sortCol === 'encargado') {
        const cmp = (encargadoName(a) || '\uffff').localeCompare(encargadoName(b) || '\uffff', 'es')
        return cmp !== 0 ? cmp * dir : titleOf(a).localeCompare(titleOf(b), 'es') * dir
      }
      if (sortCol === 'periodo') {
        if (a.kind === 'act' && b.kind === 'act') {
          const cmp = mesesDeFrecuencia(a.actividad.frecuencia) - mesesDeFrecuencia(b.actividad.frecuencia)
          if (cmp !== 0) return cmp * dir
          return (
            frecuenciaLabel(a.actividad.frecuencia).localeCompare(frecuenciaLabel(b.actividad.frecuencia), 'es') * dir
          )
        }
        const pa = a.kind === 'acc' ? a.accion.fechaObjetivo || '\uffff' : frecuenciaLabel(a.actividad.frecuencia)
        const pb = b.kind === 'acc' ? b.accion.fechaObjetivo || '\uffff' : frecuenciaLabel(b.actividad.frecuencia)
        return pa.localeCompare(pb, 'es') * dir
      }
      if (a.kind === 'act' && b.kind === 'act') return compareActividadesByTitulo(a.actividad, b.actividad) * dir
      return titleOf(a).localeCompare(titleOf(b), 'es') * dir
    }

    const map = new Map<string, { label: string; rows: ListRow[] }>()
    for (const row of filtered) {
      const { key, label: groupLabel } = groupOf(row)
      const group = map.get(key) ?? { label: groupLabel, rows: [] }
      group.rows.push(row)
      map.set(key, group)
    }
    for (const group of map.values()) {
      group.rows.sort(compareRows)
    }

    const groups = [...map.entries()].map(([key, group]) => ({
      key,
      label: group.label,
      rows: group.rows,
    }))

    const sortGroupsByColumn =
      (groupBy === 'tipo' && sortCol === 'tipo') ||
      (groupBy === 'encargado' && sortCol === 'encargado') ||
      (groupBy === 'congregacion' && sortCol === 'encargado')

    groups.sort((a, b) => {
      if (a.key === '__correctiva' && b.key !== '__correctiva') return 1
      if (b.key === '__correctiva' && a.key !== '__correctiva') return -1
      const emptyA = a.key === '__none'
      const emptyB = b.key === '__none'
      if (emptyA && emptyB) return 0
      if (emptyA) return 1
      if (emptyB) return -1
      const cmp = a.label.localeCompare(b.label, 'es')
      return sortGroupsByColumn ? cmp * dir : cmp
    })

    return groups
  }, [filtered, encargadoMap, actividadMap, fichaMap, groupBy, sortCol, sortDir, tipos, correctivaLabel])

  const filterTools = useMemo<FilterTool[]>(
    () => [
      {
        id: 'filtrar',
        label: 'Filtrar',
        icon: SlidersHorizontal,
        active: Boolean(tipoId || encargadoId),
        content: (
          <div className="stack" style={{ gap: '0.7rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="act-filtro-tipo">Tipo</label>
              <select
                id="act-filtro-tipo"
                className="select"
                value={tipoId}
                onChange={(e) => setFilter('tipo', e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="act-filtro-encargado">Encargado</label>
              <select
                id="act-filtro-encargado"
                className="select"
                value={encargadoId}
                onChange={(e) => setFilter('encargado', e.target.value)}
              >
                <option value="">Todos</option>
                {encargados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ),
      },
      {
        id: 'agrupar',
        label: 'Agrupar',
        icon: Layers,
        active: groupBy !== 'tipo',
        content: (
          <div className="chip-row tight" role="tablist" aria-label="Agrupar">
            <button
              type="button"
              className={`chip compact${groupBy === 'tipo' ? ' active' : ''}`}
              onClick={() => setGroup('tipo')}
            >
              Tipo
            </button>
            <button
              type="button"
              className={`chip compact${groupBy === 'encargado' ? ' active' : ''}`}
              onClick={() => setGroup('encargado')}
            >
              Encargado
            </button>
            <button
              type="button"
              className={`chip compact${groupBy === 'congregacion' ? ' active' : ''}`}
              onClick={() => setGroup('congregacion')}
            >
              Congregación
            </button>
          </div>
        ),
      },
    ],
    [tipoId, encargadoId, groupBy, encargados, tipos],
  )

  return (
    <div>
      <FilterDrawerSlot
        title="Actividades"
        tools={filterTools}
        canClear={Boolean(q || tipoId || encargadoId || groupBy !== 'tipo')}
        onClear={() => {
          setSearchText('')
          patch({ q: undefined, tipo: undefined, encargado: undefined, agrupar: undefined })
        }}
      />
      <div className="page-head">
        <p className="muted" style={{ margin: 0 }}>
          {actividades.length} actividad{actividades.length === 1 ? '' : 'es'}
          {acciones.length ? ` · ${acciones.length} correctiva${acciones.length === 1 ? '' : 's'}` : ''}
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn btn-add" to="/actividades/nueva">
            <Plus size={16} />
            Nueva
          </Link>
        </div>
      </div>

      {actividades.length > 0 || acciones.length > 0 ? (
        <label className="search-field" htmlFor="act-q">
          <Search size={16} aria-hidden />
          <input
            id="act-q"
            className="input"
            type="search"
            placeholder="Buscar actividad o correctiva"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
        </label>
      ) : null}

      {actividades.length === 0 && acciones.length === 0 ? (
        <EmptyState
          icon={<Wrench size={36} />}
          title="Sin actividades"
          text={`${label('reparacion', aliases)}, ${label('compra', aliases)}, ${label('limpieza', aliases)} o ${label('capacitacion', aliases)}. No necesitan ficha.`}
          action={
            <Link className="btn btn-add" to="/actividades/nueva">
              Crear actividad
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <div className="table-card">
          <p className="table-empty">No hay actividades ni correctivas con esos filtros.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-head table-cols-fichas has-mark">
            <span className="table-bar" aria-hidden />
            <span className="crono-mark" title="Tipo o prioridad">
              Tipo
            </span>
            <SortHeader
              label="Actividad"
              active={sortCol === 'titulo'}
              dir={sortDir}
              onClick={() => setSort('titulo')}
            />
            <SortHeader
              label="Encargado"
              className="col-md"
              active={sortCol === 'encargado'}
              dir={sortDir}
              onClick={() => setSort('encargado')}
            />
            <SortHeader
              label="Periodo"
              active={sortCol === 'periodo'}
              dir={sortDir}
              onClick={() => setSort('periodo')}
            />
          </div>
          {grouped.map((group) => (
            <section key={group.key}>
              <div className="table-section">{group.label}</div>
              {group.rows.map((row) => {
                if (row.kind === 'acc') {
                  const { actividad, ficha, encargadoId } = parentOf(row.accion)
                  const encargado = encargadoId ? encargadoMap[encargadoId] : undefined
                  const parent = actividad ? actividad.titulo : ficha ? fichaTitulo(ficha) : ''
                  return (
                    <Link
                      key={row.id}
                      className="table-row table-cols-fichas has-mark"
                      to={accionHref(row.accion)}
                    >
                      <span
                        className="table-bar"
                        style={{
                          background: actividad ? kindActividadVar() : bloqueColorVar('rose'),
                        }}
                      />
                      <span className="crono-mark">
                        <PrioridadMark prioridad={prioridadOf(row.accion)} iconOnly />
                      </span>
                      <span className="table-cell">
                        <span className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                          <strong>{row.accion.texto}</strong>
                          <StatusBadge estado={estadoAgendaCorrectiva(row.accion)} />
                        </span>
                        <span className="muted col-sm-only">
                          {correctivaLabel}
                          {parent ? ` · ${parent}` : ''}
                          {encargado ? ` · ${encargado.nombre}` : ''}
                        </span>
                      </span>
                      <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                      <span className="muted table-nowrap">
                        {row.accion.fechaObjetivo ? formatDate(row.accion.fechaObjetivo) : '—'}
                      </span>
                    </Link>
                  )
                }
                const a = row.actividad
                const encargado = a.encargadoId ? encargadoMap[a.encargadoId] : undefined
                const vigente = estadoVigente(eventosByAct.get(a.id) ?? [])
                return (
                  <Link
                    key={row.id}
                    className="table-row table-cols-fichas has-mark"
                    to={`/actividades/${a.id}`}
                  >
                    <span
                      className="table-bar"
                      style={{ background: kindActividadVar() }}
                    />
                    <span className="crono-mark">
                      <TipoMark tipo={a.tipo} />
                    </span>
                    <span className="table-cell">
                      <span className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        <ActividadTitle actividad={a} hideIcon />
                        {vigente ? <StatusBadge estado={vigente} /> : null}
                      </span>
                      <span className="muted col-sm-only">
                        {encargado ? encargado.nombre : ''}
                      </span>
                    </span>
                    <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                    <span className="muted table-nowrap">{frecuenciaLabel(a.frecuencia)}</span>
                  </Link>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
