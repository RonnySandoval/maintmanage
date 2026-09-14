import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, List, Search, SlidersHorizontal } from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS,
  esExtraordinaria,
  tipoAccionLabel,
  tipoAccionOf,
  tipoActividadLabel,
  type EstadoOcurrencia,
} from '../db/types'
import { bloqueColorVar, kindActividadVar } from '../lib/colors'
import { formatFechaProgramada, formatDateLong } from '../lib/dates'
import { compareFichasByNumero, fichaTitulo } from '../lib/fichas'
import { accionHref, estadoAgendaCorrectiva } from '../lib/acciones'
import { compareActividadesByTitulo } from '../lib/actividades'
import { EmptyState, ExtraBadge, LeyendaSimbolos, StatusBadge, StatusWordsToggle, TipoBadge } from '../components/ui'
import { useStatusLabels } from '../hooks/useStatusLabels'
import { SIMBOLOS_ESTADO } from '../lib/simbolos'
import { GrillaAnual } from '../components/GrillaAnual'
import { FichaTitle } from '../components/FichaTitle'
import { ActividadTitle } from '../components/ActividadTitle'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { useAliases } from '../lib/labels'
import { InboxAlert } from '../components/InboxAlert'

type ListaItem =
  | { kind: 'occ'; id: string; fecha: string; occId: string; fichaId: string }
  | { kind: 'evt'; id: string; fecha: string; eventoId: string; actividadId: string }
  | { kind: 'acc'; id: string; fecha: string; accionId: string; fichaId?: string; actividadId?: string }

type Ambito = 'fichas' | 'actividades'

export function CronogramaPage() {
  const [params, setParams] = useSearchParams()
  const estado = (params.get('estado') ?? '') as EstadoOcurrencia | ''
  const bloqueId = params.get('bloque') ?? params.get('grupo') ?? ''
  const encargadoId = params.get('encargado') ?? ''
  const fichaId = params.get('ficha') ?? ''
  const tipoId = params.get('tipo') ?? ''
  const fecha = params.get('fecha') ?? ''
  const q = params.get('q') ?? ''
  const [searchText, setSearchText] = useState(q)
  const vista = params.get('vista') === 'lista' ? 'lista' : 'grilla'
  const ambito: Ambito = params.get('ambito') === 'actividades' ? 'actividades' : 'fichas'
  const year = Number(params.get('anio')) || new Date().getFullYear()
  const showBloque = params.get('verBloque') !== '0'
  const { showLabels } = useStatusLabels()

  const ocurrencias = useLiveQuery(() => db.ocurrencias.orderBy('fechaProgramada').toArray()) ?? []
  const eventos = useLiveQuery(() => db.eventos.orderBy('fechaProgramada').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const acciones = useLiveQuery(() => db.accionesCorrectivas.toArray()) ?? []
  const tipos = useTiposActividad()
  const aliases = useAliases()

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

  function set(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key === 'bloque') next.delete('grupo')
        next.delete('actividad')
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    setSearchText(q)
  }, [q])

  function onSearchChange(value: string) {
    setSearchText(value)
    set('q', value)
  }

  function clearFilters() {
    setSearchText('')
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const key of ['q', 'estado', 'bloque', 'grupo', 'encargado', 'ficha', 'tipo', 'actividad', 'fecha']) {
          next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  const qLower = q.toLowerCase()
  const fichasFiltradas = fichas.filter((ficha) => {
    if (bloqueId && ficha.grupoId !== bloqueId) return false
    if (encargadoId && ficha.encargadoId !== encargadoId) return false
    if (fichaId && ficha.id !== fichaId) return false
    if (q && !`${ficha.numero} ${ficha.nombre}`.toLowerCase().includes(qLower)) return false
    return true
  })

  const actividadesFiltradas = actividades.filter((act) => {
    if (tipoId && act.tipo !== tipoId) return false
    if (encargadoId && act.encargadoId !== encargadoId) return false
    if (q && !`${act.titulo} ${tipoActividadLabel(act.tipo, tipos)}`.toLowerCase().includes(qLower)) {
      return false
    }
    return true
  })

  const filteredOcc = ocurrencias.filter((o) => {
    const ficha = fichaMap[o.fichaId]
    if (!ficha) return false
    if (!fichasFiltradas.some((f) => f.id === ficha.id)) return false
    if (estado && o.estado !== estado) return false
    if (fecha && o.fechaProgramada !== fecha) return false
    return true
  })

  const filteredEvt = eventos.filter((e) => {
    const act = actividadMap[e.actividadId]
    if (!act) return false
    if (!actividadesFiltradas.some((a) => a.id === act.id)) return false
    if (estado && e.estado !== estado) return false
    if (fecha && e.fechaProgramada !== fecha) return false
    return true
  })

  const correctivasFechadas = acciones.filter((a) => {
    if (tipoAccionOf(a) !== 'correctiva' || !a.fechaObjetivo) return false
    const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
    const act = a.actividadId ? actividadMap[a.actividadId] : undefined
    if (encargadoId) {
      const enc = act?.encargadoId ?? ficha?.encargadoId
      if (enc !== encargadoId) return false
    }
    if (tipoId && (!act || act.tipo !== tipoId)) return false
    if (q) {
      const hay = `${a.texto} ${ficha ? `${ficha.numero} ${ficha.nombre}` : ''} ${act?.titulo ?? ''}`.toLowerCase()
      if (!hay.includes(qLower)) return false
    }
    if (estado && estadoAgendaCorrectiva(a) !== estado) return false
    if (fecha && a.fechaObjetivo !== fecha) return false
    return true
  })

  const correctivasSinProgramar = acciones.filter((a) => {
    if (tipoAccionOf(a) !== 'correctiva' || a.fechaObjetivo || a.estado === 'ejecutada') return false
    const ficha = a.fichaId ? fichaMap[a.fichaId] : undefined
    const act = a.actividadId ? actividadMap[a.actividadId] : undefined
    if (encargadoId) {
      const enc = act?.encargadoId ?? ficha?.encargadoId
      if (enc !== encargadoId) return false
    }
    if (tipoId && (!act || act.tipo !== tipoId)) return false
    if (q) {
      const hay = `${a.texto} ${ficha ? `${ficha.numero} ${ficha.nombre}` : ''} ${act?.titulo ?? ''}`.toLowerCase()
      if (!hay.includes(qLower)) return false
    }
    if (estado && estadoAgendaCorrectiva(a) !== estado) return false
    if (fecha) return false
    return true
  })

  const fichasOrdenadas = useMemo(() => [...fichas].sort(compareFichasByNumero), [fichas])

  const filterTools = useMemo<FilterTool[]>(
    () => [
      {
        id: 'filtrar',
        label: 'Filtrar',
        icon: SlidersHorizontal,
        active:
          ambito === 'fichas'
            ? Boolean(bloqueId || encargadoId || fichaId)
            : Boolean(encargadoId || tipoId),
        content: (
          <div className="stack" style={{ gap: '0.7rem' }}>
            {ambito === 'fichas' ? (
              <>
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="crono-bloque">Bloque</label>
                  <select
                    id="crono-bloque"
                    className="select"
                    value={bloqueId}
                    onChange={(e) => set('bloque', e.target.value)}
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
                  <label htmlFor="crono-ficha">Ficha</label>
                  <select
                    id="crono-ficha"
                    className="select"
                    value={fichaId}
                    onChange={(e) => set('ficha', e.target.value)}
                  >
                    <option value="">Todas</option>
                    {fichasOrdenadas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {fichaTitulo(f)}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="crono-tipo">Tipo de actividad</label>
                <select
                  id="crono-tipo"
                  className="select"
                  value={tipoId}
                  onChange={(e) => set('tipo', e.target.value)}
                >
                  <option value="">Todos</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="crono-encargado">Encargado</label>
              <select
                id="crono-encargado"
                className="select"
                value={encargadoId}
                onChange={(e) => set('encargado', e.target.value)}
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
    ],
    [ambito, bloqueId, encargadoId, fichaId, tipoId, bloques, encargados, fichasOrdenadas, tipos],
  )

  const listaItems: ListaItem[] =
    ambito === 'fichas'
      ? filteredOcc.map((o) => ({
          kind: 'occ' as const,
          id: o.id,
          fecha: o.fechaProgramada,
          occId: o.id,
          fichaId: o.fichaId,
        }))
      : [
          ...filteredEvt.map((e) => ({
            kind: 'evt' as const,
            id: e.id,
            fecha: e.fechaProgramada,
            eventoId: e.id,
            actividadId: e.actividadId,
          })),
          ...correctivasFechadas.map((a) => ({
            kind: 'acc' as const,
            id: a.id,
            fecha: a.fechaObjetivo as string,
            accionId: a.id,
            fichaId: a.fichaId,
            actividadId: a.actividadId,
          })),
        ]

  const grouped = new Map<string, ListaItem[]>()
  for (const item of listaItems) {
    const list = grouped.get(item.fecha) ?? []
    list.push(item)
    grouped.set(item.fecha, list)
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'occ' ? -1 : 1
      if (a.kind === 'occ' && b.kind === 'occ') {
        return compareFichasByNumero(fichaMap[a.fichaId], fichaMap[b.fichaId])
      }
      if (a.kind === 'evt' && b.kind === 'evt') {
        return compareActividadesByTitulo(actividadMap[a.actividadId], actividadMap[b.actividadId])
      }
      if (a.kind === 'acc' && b.kind === 'acc') {
        if (a.actividadId || b.actividadId) {
          return compareActividadesByTitulo(
            a.actividadId ? actividadMap[a.actividadId] : undefined,
            b.actividadId ? actividadMap[b.actividadId] : undefined,
          )
        }
        return compareFichasByNumero(
          a.fichaId ? fichaMap[a.fichaId] : undefined,
          b.fichaId ? fichaMap[b.fichaId] : undefined,
        )
      }
      if (a.kind === 'evt') return -1
      if (b.kind === 'evt') return 1
      return 0
    })
  }

  const sinDatos =
    !fichas.length && !actividades.length && !acciones.some((a) => tipoAccionOf(a) === 'correctiva' && a.fechaObjetivo)
  if (sinDatos) {
    return (
      <EmptyState
        icon={<CalendarDays size={36} />}
        title="Sin cronograma"
        text="Cuando existan fichas o actividades, aquí verás las fechas programadas."
        action={
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="btn btn-add" to="/fichas/nueva">
              Nueva ficha
            </Link>
            <Link className="btn btn-add" to="/actividades/nueva">
              Nueva actividad
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <div>
      <FilterDrawerSlot
        title="Cronograma"
        tools={filterTools}
        canClear={Boolean(q || estado || bloqueId || encargadoId || fichaId || tipoId || fecha)}
        onClear={clearFilters}
      />
      <div className="crono-toolbar">
        <div className="row crono-toolbar-toggles">
          <div className="seg-toggle compact" role="tablist" aria-label="Cronograma de fichas o actividades">
            <button
              type="button"
              role="tab"
              aria-selected={ambito === 'fichas'}
              className={ambito === 'fichas' ? 'active' : ''}
              onClick={() => set('ambito', '')}
            >
              Ficha
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ambito === 'actividades'}
              className={ambito === 'actividades' ? 'active' : ''}
              onClick={() => set('ambito', 'actividades')}
            >
              Actividad
            </button>
          </div>
          <div className="seg-toggle compact icon-only" role="tablist" aria-label="Vista del cronograma">
            <button
              type="button"
              role="tab"
              aria-selected={vista === 'grilla'}
              className={vista === 'grilla' ? 'active' : ''}
              onClick={() => set('vista', '')}
              aria-label="Grilla"
              title="Grilla"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={vista === 'lista'}
              className={vista === 'lista' ? 'active' : ''}
              onClick={() => set('vista', 'lista')}
              aria-label="Lista"
              title="Lista"
            >
              <List size={16} />
            </button>
          </div>
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

      <div className="estado-toolbar">
        <div className={`estado-toggle${showLabels ? '' : ' is-icons'}`} role="group" aria-label="Estado">
          <button type="button" className={!estado ? 'active' : ''} onClick={() => set('estado', '')}>
            <span className="sym" aria-hidden>
              ∗
            </span>
            <span>Todas</span>
          </button>
          {ESTADOS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={estado === e.id ? 'active' : ''}
              onClick={() => set('estado', e.id)}
            >
              <span className="sym" aria-hidden>
                {SIMBOLOS_ESTADO[e.id].glyph}
              </span>
              <span>{e.label}</span>
            </button>
          ))}
        </div>
        <StatusWordsToggle />
      </div>

      <label className="search-field" htmlFor="crono-q">
        <Search size={16} aria-hidden />
        <input
          id="crono-q"
          className="input"
          type="search"
          placeholder={ambito === 'fichas' ? 'Buscar ficha' : 'Buscar actividad o correctiva'}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
        />
      </label>

      {correctivasSinProgramar.length > 0 ? (
        <InboxAlert count={correctivasSinProgramar.length} label="sin programar · fuera de grilla" />
      ) : null}

      {vista === 'grilla' ? (
        <GrillaAnual
          year={year}
          modo={ambito}
          fichas={ambito === 'fichas' ? fichasFiltradas : fichas}
          actividades={ambito === 'actividades' ? actividadesFiltradas : []}
          bloques={bloques}
          encargados={encargados}
          ocurrencias={
            estado || fecha
              ? filteredOcc
              : ocurrencias.filter((o) => fichasFiltradas.some((f) => f.id === o.fichaId))
          }
          eventos={
            estado || fecha
              ? filteredEvt
              : eventos.filter((e) => actividadesFiltradas.some((a) => a.id === e.actividadId))
          }
          acciones={ambito === 'actividades' ? correctivasFechadas : acciones}
          showBloque={showBloque}
          onToggleBloque={
            ambito === 'fichas' ? () => set('verBloque', showBloque ? '0' : '') : undefined
          }
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

          {listaItems.length === 0 ? (
            <div className="table-card">
              <p className="table-empty">
                {ambito === 'fichas'
                  ? 'No hay inspecciones con esos filtros.'
                  : 'No hay actividades ni correctivas con esos filtros.'}
              </p>
            </div>
          ) : (
            <div className="table-card">
              {ambito === 'fichas' ? (
                <div className="row" style={{ justifyContent: 'flex-end', margin: '0.35rem 0.5rem' }}>
                  <button
                    type="button"
                    className={`chip compact${showBloque ? ' active' : ''}`}
                    onClick={() => set('verBloque', showBloque ? '0' : '')}
                    aria-pressed={showBloque}
                  >
                    Bloque
                  </button>
                </div>
              ) : null}
              <div className={`table-head table-cols-crono${ambito === 'fichas' && showBloque ? '' : ' no-bloque'}`}>
                <span className="table-bar" aria-hidden />
                <span>{ambito === 'fichas' ? 'Ficha' : 'Actividad'}</span>
                {ambito === 'fichas' && showBloque ? (
                  <span className="col-md">Bloque</span>
                ) : null}
                <span className="col-md">Encargado</span>
                <span>Estado</span>
              </div>
              {[...grouped.entries()].map(([day, items]) => {
                const firstOcc = items.find((i) => i.kind === 'occ')
                const firstEvt = items.find((i) => i.kind === 'evt')
                const firstAcc = items.find((i) => i.kind === 'acc')
                const precision =
                  (firstOcc && fichaMap[firstOcc.fichaId]?.fechaPrecision === 'dia') ||
                  (firstEvt && actividadMap[firstEvt.actividadId]?.fechaPrecision === 'dia') ||
                  firstAcc
                    ? 'dia'
                    : 'mes'
                return (
                  <section key={day}>
                    <div className="table-section">{formatFechaProgramada(day, precision)}</div>
                    {items.map((item) => {
                      if (item.kind === 'occ') {
                        const occ = filteredOcc.find((o) => o.id === item.occId)
                        const ficha = fichaMap[item.fichaId]
                        const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                        const encargado = ficha ? encargadoMap[ficha.encargadoId ?? ''] : undefined
                        if (!occ) return null
                        return (
                          <Link
                            key={item.id}
                            className={`table-row table-cols-crono${ambito === 'fichas' && showBloque ? '' : ' no-bloque'}`}
                            to={`/ocurrencias/${occ.id}`}
                          >
                            <span
                              className="table-bar"
                              style={{ background: bloqueColorVar(bloque?.color) }}
                            />
                            <span className="table-cell">
                              <span className="occ-meta">
                                <FichaTitle ficha={ficha} color={bloque?.color} />
                                {esExtraordinaria(occ) ? <ExtraBadge /> : null}
                              </span>
                              <span className="muted col-sm-only">
                                {showBloque && bloque?.nombre
                                  ? `${bloque.nombre}${encargado ? ` · ${encargado.nombre}` : ''}`
                                  : (encargado?.nombre ?? '')}
                              </span>
                            </span>
                            {showBloque ? (
                              <span className="col-md muted">{bloque?.nombre ?? '—'}</span>
                            ) : null}
                            <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                            <span className="table-nowrap">
                              <StatusBadge estado={occ.estado} />
                            </span>
                          </Link>
                        )
                      }
                      if (item.kind === 'evt') {
                        const evt = filteredEvt.find((e) => e.id === item.eventoId)
                        const act = actividadMap[item.actividadId]
                        const encargado = act ? encargadoMap[act.encargadoId ?? ''] : undefined
                        if (!evt || !act) return null
                        return (
                          <Link
                            key={item.id}
                            className="table-row table-cols-crono no-bloque"
                            to={`/eventos/${evt.id}`}
                          >
                            <span
                              className="table-bar"
                              style={{ background: kindActividadVar() }}
                            />
                            <span className="table-cell">
                              <span className="occ-meta">
                                <ActividadTitle actividad={act} />
                                <TipoBadge tipo={act.tipo} />
                                {esExtraordinaria(evt) ? <ExtraBadge /> : null}
                              </span>
                              <span className="muted col-sm-only">{encargado?.nombre ?? ''}</span>
                            </span>
                            <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                            <span className="table-nowrap">
                              <StatusBadge estado={evt.estado} />
                            </span>
                          </Link>
                        )
                      }
                      const accion = correctivasFechadas.find((a) => a.id === item.accionId)
                      const ficha = item.fichaId ? fichaMap[item.fichaId] : undefined
                      const act = item.actividadId ? actividadMap[item.actividadId] : undefined
                      const bloque = ficha ? bloqueMap[ficha.grupoId] : undefined
                      const encargado = act
                        ? encargadoMap[act.encargadoId ?? '']
                        : ficha
                          ? encargadoMap[ficha.encargadoId ?? '']
                          : undefined
                      if (!accion) return null
                      const parent = act ? act.titulo : ficha ? fichaTitulo(ficha) : ''
                      return (
                        <Link
                          key={item.id}
                          className="table-row table-cols-crono no-bloque"
                          to={accionHref(accion)}
                        >
                          <span
                            className="table-bar"
                            style={{
                              background: act ? kindActividadVar() : bloqueColorVar(bloque?.color),
                            }}
                          />
                          <span className="table-cell">
                            <span className="occ-meta">
                              <strong>{accion.texto}</strong>
                              <span className="badge badge-tipo">{tipoAccionLabel('correctiva', aliases)}</span>
                            </span>
                            <span className="muted col-sm-only">
                              {parent}
                            </span>
                          </span>
                          <span className="col-md muted">{encargado?.nombre ?? '—'}</span>
                          <span className="table-nowrap">
                            <StatusBadge estado={estadoAgendaCorrectiva(accion)} />
                          </span>
                        </Link>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}
          <LeyendaSimbolos />
        </>
      )}
    </div>
  )
}
