import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Layers, Plus, Users } from 'lucide-react'
import { db } from '../db'
import { frecuenciaLabel, mesesDeFrecuencia } from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { compareFichasByNumero, congregacionDe, congregacionLabel } from '../lib/fichas'
import { BloquesPanel } from '../components/BloquesPanel'
import { EncargadosPanel } from '../components/EncargadosPanel'
import { FichaTitle } from '../components/FichaTitle'
import { SortHeader } from '../components/SortHeader'
import { EmptyState } from '../components/ui'
import type { Ficha } from '../db/types'

type FichasTab = 'fichas' | 'encargados' | 'bloques'
type GroupBy = 'bloque' | 'encargado' | 'congregacion'
type SortCol = 'ficha' | 'bloque' | 'encargado' | 'periodo'
type SortDir = 'asc' | 'desc'

function tabFromParam(value: string | null): FichasTab {
  if (value === 'encargados' || value === 'bloques') return value
  return 'fichas'
}

function groupFromParam(value: string | null): GroupBy {
  if (value === 'encargado' || value === 'congregacion') return value
  return 'bloque'
}

function sortColFromParam(value: string | null): SortCol {
  if (value === 'bloque' || value === 'encargado' || value === 'periodo') return value
  return 'ficha'
}

function sortDirFromParam(value: string | null): SortDir {
  return value === 'desc' ? 'desc' : 'asc'
}

export function FichasPage() {
  const [params, setParams] = useSearchParams()
  const tab = tabFromParam(params.get('tab'))
  const bloqueId = params.get('bloque') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const q = params.get('q') ?? ''
  const groupBy = groupFromParam(params.get('agrupar'))
  const sortCol = sortColFromParam(params.get('col'))
  const sortDir = sortDirFromParam(params.get('dir'))

  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []

  const bloqueMap = useMemo(
    () => Object.fromEntries(bloques.map((b) => [b.id, b])),
    [bloques],
  )
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )

  function setTab(next: FichasTab) {
    const nextParams = new URLSearchParams()
    if (next !== 'fichas') nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  function patch(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    next.delete('tab')
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  function setFilter(key: string, value: string) {
    patch({ [key]: value || undefined })
  }

  function setGroup(next: GroupBy) {
    patch({ agrupar: next === 'bloque' ? undefined : next })
  }

  function setSort(column: SortCol) {
    if (sortCol === column) {
      const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc'
      if (column === 'ficha' && nextDir === 'asc') patch({ col: undefined, dir: undefined })
      else patch({ col: column === 'ficha' ? undefined : column, dir: nextDir === 'asc' ? undefined : nextDir })
      return
    }
    patch({ col: column === 'ficha' ? undefined : column, dir: undefined })
  }

  const filtered = useMemo(() => {
    return fichas.filter((f) => {
      if (bloqueId && f.grupoId !== bloqueId) return false
      if (encargadoId && f.encargadoId !== encargadoId) return false
      if (q) {
        const hay = `${f.numero} ${f.nombre}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
  }, [fichas, bloqueId, encargadoId, q])

  const grouped = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1

    function bloqueName(f: Ficha) {
      return bloqueMap[f.grupoId]?.nombre ?? ''
    }
    function encargadoName(f: Ficha) {
      return (f.encargadoId ? encargadoMap[f.encargadoId]?.nombre : '') ?? ''
    }
    function groupOf(f: Ficha): { key: string; label: string } {
      if (groupBy === 'encargado') {
        const name = encargadoName(f)
        return { key: f.encargadoId || '__none', label: name || 'Sin encargado' }
      }
      if (groupBy === 'congregacion') {
        const key = congregacionDe(f.encargadoId ? encargadoMap[f.encargadoId] : undefined)
        return { key: key || '__none', label: congregacionLabel(key) }
      }
      const bloque = bloqueMap[f.grupoId]
      return { key: f.grupoId || '__none', label: bloque?.nombre ?? 'Sin bloque' }
    }

    function compareRows(a: Ficha, b: Ficha) {
      if (sortCol === 'bloque') {
        const cmp = (bloqueName(a) || '\uffff').localeCompare(bloqueName(b) || '\uffff', 'es')
        return cmp !== 0 ? cmp * dir : compareFichasByNumero(a, b)
      }
      if (sortCol === 'encargado') {
        const cmp = (encargadoName(a) || '\uffff').localeCompare(encargadoName(b) || '\uffff', 'es')
        return cmp !== 0 ? cmp * dir : compareFichasByNumero(a, b)
      }
      if (sortCol === 'periodo') {
        const cmp = mesesDeFrecuencia(a.frecuencia) - mesesDeFrecuencia(b.frecuencia)
        if (cmp !== 0) return cmp * dir
        return frecuenciaLabel(a.frecuencia).localeCompare(frecuenciaLabel(b.frecuencia), 'es') * dir
      }
      return compareFichasByNumero(a, b) * dir
    }

    const map = new Map<string, { label: string; rows: Ficha[] }>()
    for (const f of filtered) {
      const { key, label } = groupOf(f)
      const group = map.get(key) ?? { label, rows: [] }
      group.rows.push(f)
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
      (groupBy === 'bloque' && sortCol === 'bloque') ||
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
  }, [filtered, bloqueMap, encargadoMap, groupBy, sortCol, sortDir])

  return (
    <div>
      <div className="seg-toggle tabs-3" role="tablist" aria-label="Fichas, encargados o bloques">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'fichas'}
          className={tab === 'fichas' ? 'active' : ''}
          onClick={() => setTab('fichas')}
        >
          <ClipboardList size={16} />
          Fichas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'encargados'}
          className={tab === 'encargados' ? 'active' : ''}
          onClick={() => setTab('encargados')}
        >
          <Users size={16} />
          Encargados
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'bloques'}
          className={tab === 'bloques' ? 'active' : ''}
          onClick={() => setTab('bloques')}
        >
          <Layers size={16} />
          Bloques
        </button>
      </div>

      {tab === 'encargados' ? <EncargadosPanel /> : null}
      {tab === 'bloques' ? <BloquesPanel /> : null}
      {tab !== 'fichas' ? null : (
        <>
          <div className="page-head">
            <p className="muted" style={{ margin: 0 }}>
              {fichas.length} ficha{fichas.length === 1 ? '' : 's'}
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Link className="btn btn-add" to="/fichas/nueva">
                <Plus size={16} />
                Nueva
              </Link>
            </div>
          </div>

          <div className="filters">
            <input
              className="input"
              placeholder="Buscar"
              value={q}
              onChange={(e) => setFilter('q', e.target.value)}
            />
            <select className="select" value={bloqueId} onChange={(e) => setFilter('bloque', e.target.value)}>
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
              onChange={(e) => setFilter('encargado', e.target.value)}
            >
              <option value="">Encargado</option>
              {encargados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>

          <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.78rem' }}>
            Agrupar por
          </p>
          <div className="seg-toggle tabs-3 compact" role="group" aria-label="Agrupar fichas">
            <button
              type="button"
              className={groupBy === 'bloque' ? 'active' : ''}
              onClick={() => setGroup('bloque')}
            >
              Bloque
            </button>
            <button
              type="button"
              className={groupBy === 'encargado' ? 'active' : ''}
              onClick={() => setGroup('encargado')}
            >
              Encargado
            </button>
            <button
              type="button"
              className={groupBy === 'congregacion' ? 'active' : ''}
              onClick={() => setGroup('congregacion')}
            >
              Congregación
            </button>
          </div>

          {fichas.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={36} />}
              title="Sin fichas"
              text="Crea un bloque y luego las fichas (número, nombre, foto/PDF/Word y frecuencia)."
              action={
                <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-add" onClick={() => setTab('bloques')}>
                    Crear bloque
                  </button>
                  <Link className="btn btn-add" to="/fichas/nueva">
                    Crear ficha
                  </Link>
                </div>
              }
            />
          ) : filtered.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">No hay fichas con esos filtros.</p>
            </div>
          ) : (
            <div className="table-card">
              <div className="table-head table-cols-fichas">
                <span className="table-bar" aria-hidden />
                <SortHeader
                  label="Ficha"
                  active={sortCol === 'ficha'}
                  dir={sortDir}
                  onClick={() => setSort('ficha')}
                />
                <SortHeader
                  label="Bloque"
                  className="col-md"
                  active={sortCol === 'bloque'}
                  dir={sortDir}
                  onClick={() => setSort('bloque')}
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
                  {group.rows.map((f) => {
                    const bloque = bloqueMap[f.grupoId]
                    const encargado = f.encargadoId ? encargadoMap[f.encargadoId] : undefined
                    return (
                      <Link key={f.id} className="table-row table-cols-fichas" to={`/fichas/${f.id}`}>
                        <span
                          className="table-bar"
                          style={{ background: bloqueColorVar(bloque?.color) }}
                        />
                        <span className="table-cell">
                          <FichaTitle ficha={f} color={bloque?.color} />
                          <span className="muted col-sm-only">
                            {bloque?.nombre ?? 'Sin bloque'}
                            {encargado ? ` · ${encargado.nombre}` : ''}
                          </span>
                        </span>
                        <span className="col-md muted">{bloque?.nombre ?? 'Sin bloque'}</span>
                        <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                        <span className="muted table-nowrap">{frecuenciaLabel(f.frecuencia)}</span>
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
