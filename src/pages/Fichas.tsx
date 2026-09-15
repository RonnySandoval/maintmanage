import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, ChevronDown, Layers, Paperclip, Plus, Search, SlidersHorizontal, Users, Wrench } from 'lucide-react'
import { db } from '../db'
import { frecuenciaLabel, mesesDeFrecuencia, type Adjunto } from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { compareFichasByNumero, congregacionDe, congregacionLabel, fichaTitulo } from '../lib/fichas'
import { saveAdjuntos } from '../lib/files'
import { ActividadesPanel } from '../components/ActividadesPanel'
import { BloquesPanel } from '../components/BloquesPanel'
import { EncargadosPanel } from '../components/EncargadosPanel'
import { FichaTitle } from '../components/FichaTitle'
import { FilePicker } from '../components/FilePicker'
import { AdjuntosMark } from '../components/AdjuntosMark'
import { DocumentosAgrupados, type DocumentosGrupo } from '../components/DocumentosAgrupados'
import { DocumentosAsignacionPanel } from '../components/DocumentosAsignacionPanel'
import { SortHeader } from '../components/SortHeader'
import { EmptyState } from '../components/ui'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import { EMPTY_COUNTS, buildAdjuntoCounts } from '../lib/adjuntos'
import { etiquetasOf } from '../lib/etiquetasAdjuntos'
import type { Ficha } from '../db/types'

const DOCS_LIBRES_KEY = '__sin_ficha__'

type FichasTab = 'fichas' | 'actividades' | 'bloques' | 'encargados' | 'documentos'
type GroupBy = 'bloque' | 'encargado' | 'congregacion'
type SortCol = 'ficha' | 'bloque' | 'encargado' | 'periodo'
type SortDir = 'asc' | 'desc'

function tabFromParam(tab: string | null, vista: string | null): FichasTab {
  if (tab === 'documentos' || vista === 'documentos') return 'documentos'
  if (tab === 'actividades' || tab === 'encargados' || tab === 'bloques') return tab
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

function adjuntoMatchesQuery(adjunto: Adjunto, qLower: string): boolean {
  if (!qLower) return true
  const hay = `${adjunto.nombre} ${etiquetasOf(adjunto.etiquetas).join(' ')}`.toLowerCase()
  return hay.includes(qLower)
}

export function FichasPage() {
  const [params, setParams] = useSearchParams()
  const tab = tabFromParam(params.get('tab'), params.get('vista'))
  const bloqueId = params.get('bloque') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const q = params.get('q') ?? ''
  const openNuevoDoc = params.get('nuevo') === '1'
  const conFichaFromUrl = params.get('conFicha') === '1'
  const [searchText, setSearchText] = useState(q)
  const [docsUploadOpen, setDocsUploadOpen] = useState(openNuevoDoc)
  const [docRequireFicha, setDocRequireFicha] = useState(conFichaFromUrl)
  const [docFichaId, setDocFichaId] = useState('')
  const [docUploadError, setDocUploadError] = useState('')
  const [assignIds, setAssignIds] = useState<string[]>([])
  const [assignDefaultFichaId, setAssignDefaultFichaId] = useState('')
  const [assignRequireFicha, setAssignRequireFicha] = useState(false)
  const docsUploadRef = useRef<HTMLDivElement>(null)
  const groupBy = groupFromParam(params.get('agrupar'))
  const sortCol = sortColFromParam(params.get('col'))
  const sortDir = sortDirFromParam(params.get('dir'))

  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const adjuntos =
    useLiveQuery(async () => {
      const all = await db.adjuntos.toArray()
      return all.filter((a) => a.tipo === 'ficha' || a.tipo === 'manual')
    }) ?? []
  const adjuntoCounts =
    useLiveQuery(async () => buildAdjuntoCounts(await db.adjuntos.toArray())) ?? EMPTY_COUNTS

  const bloqueMap = useMemo(
    () => Object.fromEntries(bloques.map((b) => [b.id, b])),
    [bloques],
  )
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )
  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const fichasOrdenadas = useMemo(
    () => fichas.slice().sort(compareFichasByNumero),
    [fichas],
  )

  useEffect(() => {
    if (tab !== 'documentos' || !openNuevoDoc) return
    setDocsUploadOpen(true)
    setDocRequireFicha(conFichaFromUrl)
    if (!conFichaFromUrl) setDocFichaId('')
    const frame = window.requestAnimationFrame(() => {
      docsUploadRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    const next = new URLSearchParams(params)
    next.delete('nuevo')
    next.delete('conFicha')
    setParams(next, { replace: true })
    return () => window.cancelAnimationFrame(frame)
    // Solo al llegar con ?nuevo=1 (p. ej. desde el FAB).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from URL
  }, [tab, openNuevoDoc])

  function setTab(next: FichasTab) {
    const nextParams = new URLSearchParams()
    if (next !== 'fichas') nextParams.set('tab', next)
    if (next === 'fichas' || next === 'documentos') {
      for (const key of ['q', 'bloque', 'encargado', 'agrupar', 'col', 'dir'] as const) {
        const value = params.get(key)
        if (value) nextParams.set(key, value)
      }
    }
    setParams(nextParams, { replace: true })
  }

  async function onUploadDocumentos(files: File[]) {
    if (!files.length) return
    setDocUploadError('')
    const ids = docFichaId
      ? await saveAdjuntos(files, { tipo: 'ficha', fichaId: docFichaId })
      : await saveAdjuntos(files, { tipo: 'manual' })
    setAssignDefaultFichaId(docFichaId)
    setAssignRequireFicha(docRequireFicha)
    setAssignIds(ids)
    setDocsUploadOpen(false)
  }

  function patch(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    next.delete('vista')
    if (tab !== 'fichas') next.set('tab', tab)
    else next.delete('tab')
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
    const qLower = q.toLowerCase()
    return fichas.filter((f) => {
      if (bloqueId && f.grupoId !== bloqueId) return false
      if (encargadoId && f.encargadoId !== encargadoId) return false
      if (q) {
        const hay = `${f.numero} ${f.nombre} ${adjuntoCounts.searchFicha[f.id] ?? ''}`.toLowerCase()
        if (!hay.includes(qLower)) return false
      }
      return true
    })
  }, [fichas, bloqueId, encargadoId, q, adjuntoCounts.searchFicha])

  const documentosGrupos = useMemo(() => {
    const qLower = q.trim().toLowerCase()
    const byFicha = new Map<string, Adjunto[]>()
    const libres: Adjunto[] = []
    const filtroBloqueOEncargado = Boolean(bloqueId || encargadoId)

    for (const adj of adjuntos) {
      if (!adjuntoMatchesQuery(adj, qLower)) continue

      if (!adj.fichaId || !fichaMap[adj.fichaId]) {
        // Documentos sin ficha: no aplican filtros de bloque/encargado.
        if (filtroBloqueOEncargado) continue
        libres.push(adj)
        continue
      }

      const ficha = fichaMap[adj.fichaId]
      if (bloqueId && ficha.grupoId !== bloqueId) continue
      if (encargadoId && ficha.encargadoId !== encargadoId) continue
      const list = byFicha.get(adj.fichaId) ?? []
      list.push(adj)
      byFicha.set(adj.fichaId, list)
    }

    const groups: DocumentosGrupo[] = []

    if (libres.length) {
      groups.push({
        key: DOCS_LIBRES_KEY,
        title: 'Documentos generales',
        shareTitle: 'Documentos generales',
        meta: 'Sin ficha · puedes etiquetarlos',
        adjuntos: libres.sort((a, b) => b.createdAt - a.createdAt),
      })
    }

    const fichaIds = [...byFicha.keys()].sort((a, b) => {
      const fa = fichaMap[a]
      const fb = fichaMap[b]
      if (!fa || !fb) return 0
      return compareFichasByNumero(fa, fb)
    })
    for (const fichaId of fichaIds) {
      const ficha = fichaMap[fichaId]
      if (!ficha) continue
      const bloque = bloqueMap[ficha.grupoId]
      const encargado = ficha.encargadoId ? encargadoMap[ficha.encargadoId] : undefined
      const rows = (byFicha.get(fichaId) ?? []).sort((a, b) => b.createdAt - a.createdAt)
      groups.push({
        key: fichaId,
        title: <FichaTitle ficha={ficha} color={bloque?.color} />,
        shareTitle: fichaTitulo(ficha),
        href: `/fichas/${fichaId}`,
        meta: [bloque?.nombre ?? 'Sin bloque', encargado?.nombre].filter(Boolean).join(' · '),
        adjuntos: rows,
      })
    }
    return groups
  }, [adjuntos, fichaMap, bloqueMap, encargadoMap, bloqueId, encargadoId, q])

  const docsCount = documentosGrupos.reduce((n, g) => n + g.adjuntos.length, 0)
  const docsLibresCount =
    documentosGrupos.find((g) => g.key === DOCS_LIBRES_KEY)?.adjuntos.length ?? 0
  const docsFichasCount = documentosGrupos.filter((g) => g.key !== DOCS_LIBRES_KEY).length

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

  const filterTools = useMemo<FilterTool[]>(() => {
    if (tab !== 'fichas' && tab !== 'documentos') return []
    return [
      {
        id: 'filtrar',
        label: 'Filtrar',
        icon: SlidersHorizontal,
        active: Boolean(bloqueId || encargadoId),
        content: (
          <div className="stack" style={{ gap: '0.7rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="fichas-bloque">Bloque</label>
              <select
                id="fichas-bloque"
                className="select"
                value={bloqueId}
                onChange={(e) => setFilter('bloque', e.target.value)}
              >
                <option value="">Todos</option>
                {bloques.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="fichas-encargado">Encargado</label>
              <select
                id="fichas-encargado"
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
      ...(tab === 'documentos'
        ? []
        : [
            {
              id: 'agrupar',
              label: 'Agrupar',
              icon: Layers,
              active: groupBy !== 'bloque',
              content: (
                <div className="chip-row tight" role="tablist" aria-label="Agrupar">
                  <button
                    type="button"
                    className={`chip compact${groupBy === 'bloque' ? ' active' : ''}`}
                    onClick={() => setGroup('bloque')}
                  >
                    Bloque
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
            } satisfies FilterTool,
          ]),
    ]
  }, [tab, bloqueId, encargadoId, groupBy, bloques, encargados])

  return (
    <div>
      {filterTools.length ? (
        <FilterDrawerSlot
          title={tab === 'documentos' ? 'Documentos' : 'Fichas'}
          tools={filterTools}
          canClear={Boolean(q || bloqueId || encargadoId || (tab === 'fichas' && groupBy !== 'bloque'))}
          onClear={() => {
            setSearchText('')
            patch({
              q: undefined,
              bloque: undefined,
              encargado: undefined,
              agrupar: undefined,
            })
          }}
        />
      ) : null}
      <div
        className="seg-toggle tabs-5 fichas-main-tabs"
        role="tablist"
        aria-label="Fichas, actividades, bloques, encargados o documentos"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'fichas'}
          className={tab === 'fichas' ? 'active' : ''}
          onClick={() => setTab('fichas')}
        >
          <ClipboardList size={16} />
          <span className="tab-label">Fichas</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'actividades'}
          className={tab === 'actividades' ? 'active' : ''}
          onClick={() => setTab('actividades')}
        >
          <Wrench size={16} />
          <span className="tab-label">Actividades</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'bloques'}
          className={tab === 'bloques' ? 'active' : ''}
          onClick={() => setTab('bloques')}
        >
          <Layers size={16} />
          <span className="tab-label">Bloques</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'encargados'}
          className={tab === 'encargados' ? 'active' : ''}
          onClick={() => setTab('encargados')}
        >
          <Users size={16} />
          <span className="tab-label">Encargados</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'documentos'}
          className={tab === 'documentos' ? 'active' : ''}
          onClick={() => setTab('documentos')}
          title="Documentos adjuntos"
        >
          <Paperclip size={16} />
          <span className="tab-label">Documentos</span>
        </button>
      </div>

      {tab === 'actividades' ? <ActividadesPanel /> : null}
      {tab === 'encargados' ? <EncargadosPanel /> : null}
      {tab === 'bloques' ? <BloquesPanel /> : null}

      {tab === 'documentos' ? (
        <>
          <div className="page-head">
            <p className="muted" style={{ margin: 0 }}>
              {docsCount} documento{docsCount === 1 ? '' : 's'}
              {docsLibresCount
                ? ` · ${docsLibresCount} general${docsLibresCount === 1 ? '' : 'es'}`
                : ''}
              {docsFichasCount
                ? ` · ${docsFichasCount} ficha${docsFichasCount === 1 ? '' : 's'}`
                : ''}
            </p>
          </div>

          <div
            ref={docsUploadRef}
            className={`create-panel accordion-panel docs-upload-card${docsUploadOpen ? '' : ' is-collapsed'}`}
          >
            <button
              type="button"
              className="accordion-trigger"
              aria-expanded={docsUploadOpen}
              onClick={() =>
                setDocsUploadOpen((was) => {
                  if (was) {
                    setDocRequireFicha(false)
                    setDocUploadError('')
                  }
                  return !was
                })
              }
            >
              <span className="accordion-label">
                <Plus size={16} />
                Añadir documento
              </span>
              <ChevronDown size={18} className={docsUploadOpen ? 'is-open' : ''} />
            </button>
            {docsUploadOpen ? (
              <div className="accordion-body">
                <div className="field" style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="docs-upload-ficha">
                    Ficha por defecto{docRequireFicha ? '' : ' (opcional)'}
                  </label>
                  <select
                    id="docs-upload-ficha"
                    className="select"
                    value={docFichaId}
                    onChange={(e) => {
                      setDocFichaId(e.target.value)
                      setDocUploadError('')
                    }}
                  >
                    <option value="">
                      {docRequireFicha
                        ? 'Asignar después en la tabla'
                        : 'Sin ficha (se puede asignar después)'}
                    </option>
                    {fichasOrdenadas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {fichaTitulo(f)}
                      </option>
                    ))}
                  </select>
                </div>
                {docUploadError ? <p className="danger-text">{docUploadError}</p> : null}
                <FilePicker onFiles={(files) => void onUploadDocumentos(files)} />
              </div>
            ) : null}
          </div>

          {assignIds.length ? (
            <DocumentosAsignacionPanel
              ids={assignIds}
              fichas={fichasOrdenadas}
              defaultFichaId={assignDefaultFichaId}
              requireFicha={assignRequireFicha}
              onDone={() => {
                setAssignIds([])
                setAssignDefaultFichaId('')
                setAssignRequireFicha(false)
                setDocRequireFicha(false)
              }}
            />
          ) : null}

          <label className="search-field" htmlFor="fichas-docs-q">
            <Search size={16} aria-hidden />
            <input
              id="fichas-docs-q"
              className="input"
              type="search"
              placeholder="Buscar documento o etiqueta"
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
              inputMode="search"
            />
          </label>

          <DocumentosAgrupados
            groups={documentosGrupos}
            emptyText={
              q || bloqueId || encargadoId
                ? 'No hay documentos con esos filtros.'
                : 'Aún no hay documentos. Añade uno arriba o desde una ficha.'
            }
          />
        </>
      ) : null}

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

          {fichas.length > 0 ? (
            <label className="search-field" htmlFor="fichas-q">
              <Search size={16} aria-hidden />
              <input
                id="fichas-q"
                className="input"
                type="search"
                placeholder="Buscar por número, nombre o etiqueta"
                value={searchText}
                onChange={(e) => onSearchChange(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
                inputMode="search"
              />
            </label>
          ) : null}

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
                          <span className="row" style={{ flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                            <FichaTitle ficha={f} color={bloque?.color} />
                            <AdjuntosMark count={adjuntoCounts.ficha[f.id] ?? 0} />
                          </span>
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
