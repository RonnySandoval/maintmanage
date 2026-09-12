import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Plus, Search, SlidersHorizontal, Wrench } from 'lucide-react'
import { db } from '../db'
import { frecuenciaLabel, mesesDeFrecuencia, tipoActividadLabel } from '../db/types'
import { tipoActividadColor } from '../db/types'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { bloqueColorVar } from '../lib/colors'
import { compareActividadesByTitulo, estadoVigente } from '../lib/actividades'
import { label, useAliases } from '../lib/labels'
import { congregacionDe, congregacionLabel } from '../lib/fichas'
import { ActividadTitle } from './ActividadTitle'
import { SortHeader } from './SortHeader'
import { EmptyState, StatusBadge, TipoBadge } from './ui'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import type { Actividad } from '../db/types'

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
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const tipos = useTiposActividad()
  const aliases = useAliases()
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
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

  const filtered = useMemo(() => {
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

  const grouped = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1

    function encargadoName(a: Actividad) {
      return (a.encargadoId ? encargadoMap[a.encargadoId]?.nombre : '') ?? ''
    }
    function groupOf(a: Actividad): { key: string; label: string } {
      if (groupBy === 'encargado') {
        const name = encargadoName(a)
        return { key: a.encargadoId || '__none', label: name || 'Sin encargado' }
      }
      if (groupBy === 'congregacion') {
        const key = congregacionDe(a.encargadoId ? encargadoMap[a.encargadoId] : undefined)
        return { key: key || '__none', label: congregacionLabel(key) }
      }
      return { key: a.tipo, label: tipoActividadLabel(a.tipo, tipos) }
    }

    function compareRows(a: Actividad, b: Actividad) {
      if (sortCol === 'tipo') {
        const cmp = tipoActividadLabel(a.tipo, tipos).localeCompare(tipoActividadLabel(b.tipo, tipos), 'es')
        return cmp !== 0 ? cmp * dir : compareActividadesByTitulo(a, b)
      }
      if (sortCol === 'encargado') {
        const cmp = (encargadoName(a) || '\uffff').localeCompare(encargadoName(b) || '\uffff', 'es')
        return cmp !== 0 ? cmp * dir : compareActividadesByTitulo(a, b)
      }
      if (sortCol === 'periodo') {
        const cmp = mesesDeFrecuencia(a.frecuencia) - mesesDeFrecuencia(b.frecuencia)
        if (cmp !== 0) return cmp * dir
        return frecuenciaLabel(a.frecuencia).localeCompare(frecuenciaLabel(b.frecuencia), 'es') * dir
      }
      return compareActividadesByTitulo(a, b) * dir
    }

    const map = new Map<string, { label: string; rows: Actividad[] }>()
    for (const a of filtered) {
      const { key, label } = groupOf(a)
      const group = map.get(key) ?? { label, rows: [] }
      group.rows.push(a)
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
      const emptyA = a.key === '__none'
      const emptyB = b.key === '__none'
      if (emptyA && emptyB) return 0
      if (emptyA) return 1
      if (emptyB) return -1
      const cmp = a.label.localeCompare(b.label, 'es')
      return sortGroupsByColumn ? cmp * dir : cmp
    })

    return groups
  }, [filtered, encargadoMap, groupBy, sortCol, sortDir, tipos])

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
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn btn-add" to="/actividades/nueva">
            <Plus size={16} />
            Nueva
          </Link>
        </div>
      </div>

      {actividades.length > 0 ? (
        <label className="search-field" htmlFor="act-q">
          <Search size={16} aria-hidden />
          <input
            id="act-q"
            className="input"
            type="search"
            placeholder="Buscar por título o tipo"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
        </label>
      ) : null}

      {actividades.length === 0 ? (
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
          <p className="table-empty">No hay actividades con esos filtros.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-head table-cols-fichas">
            <span className="table-bar" aria-hidden />
            <SortHeader
              label="Actividad"
              active={sortCol === 'titulo'}
              dir={sortDir}
              onClick={() => setSort('titulo')}
            />
            <SortHeader
              label="Tipo"
              className="col-md"
              active={sortCol === 'tipo'}
              dir={sortDir}
              onClick={() => setSort('tipo')}
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
              {group.rows.map((a) => {
                const encargado = a.encargadoId ? encargadoMap[a.encargadoId] : undefined
                const vigente = estadoVigente(eventosByAct.get(a.id) ?? [])
                return (
                  <Link
                    key={a.id}
                    className="table-row table-cols-fichas"
                    to={`/actividades/${a.id}`}
                  >
                    <span
                      className="table-bar"
                      style={{ background: bloqueColorVar(tipoActividadColor(a.tipo, tipos)) }}
                    />
                    <span className="table-cell">
                      <span className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        <ActividadTitle actividad={a} />
                        {vigente ? <StatusBadge estado={vigente} /> : null}
                      </span>
                      <span className="muted col-sm-only">
                        {tipoActividadLabel(a.tipo, tipos)}
                        {encargado ? ` · ${encargado.nombre}` : ''}
                      </span>
                    </span>
                    <span className="col-md muted">
                      <TipoBadge tipo={a.tipo} />
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
