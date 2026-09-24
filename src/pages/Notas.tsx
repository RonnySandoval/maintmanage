import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { db } from '../db'
import type { Nota } from '../db/types'
import { createId } from '../lib/ids'
import { compareFichasByNumero, fichaTitulo } from '../lib/fichas'
import { compareActividadesByTitulo, actividadTitulo } from '../lib/actividades'
import { formatDate, monthLabel, todayISO } from '../lib/dates'
import { compararNotas, fechaDeNota } from '../lib/notas'
import { EntityCard } from '../components/EntityCard'
import { ActividadTitle } from '../components/ActividadTitle'
import { FichaTitle } from '../components/FichaTitle'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import { EmptyState, Modal } from '../components/ui'

function parseEtiquetas(text: string): string[] {
  const seen = new Set<string>()
  for (const part of text.split(',')) {
    const tag = part.trim().toLowerCase()
    if (tag && !seen.has(tag)) seen.add(tag)
  }
  return [...seen]
}

function notaHay(nota: Nota, qLower: string): boolean {
  if (!qLower) return true
  return `${nota.titulo} ${nota.cuerpo} ${nota.etiquetas.join(' ')}`.toLowerCase().includes(qLower)
}

export function NotasPage() {
  const [params, setParams] = useSearchParams()
  const vista = params.get('vista') === 'archivadas' ? 'archivadas' : 'activas'
  const q = params.get('q') ?? ''
  const etiqueta = params.get('etiqueta') ?? ''
  const [searchText, setSearchText] = useState(q)

  const notas = useLiveQuery(() => db.notas.orderBy('updatedAt').reverse().toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const ocurrencias = useLiveQuery(() => db.ocurrencias.orderBy('fechaProgramada').toArray()) ?? []
  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const eventos = useLiveQuery(() => db.eventos.orderBy('fechaProgramada').toArray()) ?? []

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [fecha, setFecha] = useState('')
  const [etiquetasText, setEtiquetasText] = useState('')
  const [fichaId, setFichaId] = useState('')
  const [ocurrenciaId, setOcurrenciaId] = useState('')
  const [actividadId, setActividadId] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [fijada, setFijada] = useState(false)
  const [error, setError] = useState('')
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [mesFiltro, setMesFiltro] = useState('')
  const formRef = useRef<HTMLDivElement>(null)
  const tituloRef = useRef<HTMLInputElement>(null)

  const fichaMap = useMemo(() => Object.fromEntries(fichas.map((f) => [f.id, f])), [fichas])
  const fichasOrdenadas = useMemo(() => fichas.slice().sort(compareFichasByNumero), [fichas])
  const occsDeFicha = useMemo(
    () => ocurrencias.filter((o) => !fichaId || o.fichaId === fichaId),
    [ocurrencias, fichaId],
  )
  const actividadesOrdenadas = useMemo(
    () => actividades.slice().sort(compareActividadesByTitulo),
    [actividades],
  )
  const evtsDeActividad = useMemo(
    () => eventos.filter((e) => !actividadId || e.actividadId === actividadId),
    [eventos, actividadId],
  )
  const etiquetasUsadas = useMemo(() => {
    const set = new Set<string>()
    for (const n of notas) for (const t of n.etiquetas) set.add(t)
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [notas])

  // Apertura desde URL: /notas?nueva=1[…], /notas?editar=<id> o /notas?ver=<id> (solo lectura)
  useEffect(() => {
    const nueva = params.get('nueva')
    const editar = params.get('editar')
    const ver = params.get('ver')
    if (ver) {
      if (notas.some((n) => n.id === ver)) {
        setViewId(ver)
        const next = new URLSearchParams(params)
        next.delete('ver')
        setParams(next, { replace: true })
      }
      return
    }
    if (nueva === '1') {
      openNew()
      const presetFicha = params.get('ficha') ?? ''
      const presetOcc = params.get('ocurrencia') ?? ''
      const presetAct = params.get('actividad') ?? ''
      const presetEvt = params.get('evento') ?? ''
      if (presetFicha && fichas.some((f) => f.id === presetFicha)) {
        setFichaId(presetFicha)
        if (presetOcc && ocurrencias.some((o) => o.id === presetOcc && o.fichaId === presetFicha)) {
          setOcurrenciaId(presetOcc)
        }
      } else if (presetAct && actividades.some((a) => a.id === presetAct)) {
        setActividadId(presetAct)
        if (presetEvt && eventos.some((e) => e.id === presetEvt && e.actividadId === presetAct)) {
          setEventoId(presetEvt)
        }
      }
      const next = new URLSearchParams(params)
      next.delete('nueva')
      next.delete('ficha')
      next.delete('ocurrencia')
      next.delete('actividad')
      next.delete('evento')
      setParams(next, { replace: true })
      // Entrar directo a la escritura: llevar el form a la vista y enfocar.
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        tituloRef.current?.focus({ preventScroll: true })
      }, 120)
    } else if (editar) {
      const nota = notas.find((n) => n.id === editar)
      if (nota) {
        openEdit(nota)
        const next = new URLSearchParams(params)
        next.delete('editar')
        setParams(next, { replace: true })
      }
    }
    // Solo al llegar con esos parámetros (se consumen en la primera pasada).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from URL
  }, [notas, fichas, ocurrencias, actividades, eventos])

  useEffect(() => {
    setSearchText(q)
  }, [q])

  function patch(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }

  function openNew() {
    setEditingId(null)
    setTitulo('')
    setCuerpo('')
    setFecha(todayISO())
    setEtiquetasText('')
    setFichaId('')
    setOcurrenciaId('')
    setActividadId('')
    setEventoId('')
    setFijada(false)
    setError('')
    setFormOpen(true)
  }

  function openEdit(nota: Nota) {
    setEditingId(nota.id)
    setTitulo(nota.titulo)
    setCuerpo(nota.cuerpo)
    setFecha(fechaDeNota(nota))
    setEtiquetasText(nota.etiquetas.join(', '))
    setFichaId(nota.fichaId ?? '')
    setOcurrenciaId(nota.ocurrenciaId ?? '')
    setActividadId(nota.actividadId ?? '')
    setEventoId(nota.eventoId ?? '')
    setFijada(nota.fijada)
    setError('')
    setFormOpen(true)
  }

  function toggleEtiqueta(tag: string) {
    const current = parseEtiquetas(etiquetasText)
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
    setEtiquetasText(next.join(', '))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!titulo.trim() && !cuerpo.trim()) {
      setError('Escribe un título o un texto.')
      return
    }
    const now = Date.now()
    const etiquetas = parseEtiquetas(etiquetasText)
    const nextFichaId = fichaId || undefined
    // La inspección solo vale si pertenece a la ficha elegida.
    const occ = ocurrenciaId ? ocurrencias.find((o) => o.id === ocurrenciaId) : undefined
    const nextOcurrenciaId = occ && (!nextFichaId || occ.fichaId === nextFichaId) ? occ.id : undefined
    const nextActividadId = actividadId || undefined
    const evt = eventoId ? eventos.find((e) => e.id === eventoId) : undefined
    const nextEventoId = evt && (!nextActividadId || evt.actividadId === nextActividadId) ? evt.id : undefined
    // Ficha y actividad son excluyentes: manda la ficha si ambas quedaron puestas.
    const vinculaFicha = Boolean(nextFichaId)
    const saveFichaId = vinculaFicha ? nextFichaId : undefined
    const saveOcurrenciaId = vinculaFicha ? nextOcurrenciaId : undefined
    const saveActividadId = vinculaFicha ? undefined : nextActividadId
    const saveEventoId = vinculaFicha ? undefined : nextEventoId
    if (editingId) {
      await db.notas.update(editingId, {
        titulo: titulo.trim() || '(sin título)',
        cuerpo: cuerpo.trim(),
        fecha: fecha || todayISO(),
        etiquetas,
        fichaId: saveFichaId,
        ocurrenciaId: saveOcurrenciaId,
        actividadId: saveActividadId,
        eventoId: saveEventoId,
        fijada,
        updatedAt: now,
      })
    } else {
      await db.notas.add({
        id: createId(),
        titulo: titulo.trim() || '(sin título)',
        cuerpo: cuerpo.trim(),
        fecha: fecha || todayISO(),
        etiquetas,
        fichaId: saveFichaId,
        ocurrenciaId: saveOcurrenciaId,
        actividadId: saveActividadId,
        eventoId: saveEventoId,
        fijada,
        archivada: vista === 'archivadas',
        createdAt: now,
        updatedAt: now,
      })
    }
    setFormOpen(false)
  }

  async function toggleFijada(nota: Nota) {
    await db.notas.update(nota.id, { fijada: !nota.fijada, updatedAt: Date.now() })
  }

  async function toggleArchivada(nota: Nota) {
    await db.notas.update(nota.id, { archivada: !nota.archivada, updatedAt: Date.now() })
  }

  async function remove(nota: Nota) {
    if (!confirm(`¿Borrar la nota «${nota.titulo}»?`)) return
    await db.notas.delete(nota.id)
  }

  const qLower = q.trim().toLowerCase()
  const hayFiltros = Boolean(qLower || etiqueta || fechaFiltro || mesFiltro)
  const visibles = useMemo(() => {
    const rows = notas.filter((n) => {
      if (vista === 'archivadas' ? !n.archivada : n.archivada) return false
      if (etiqueta && !n.etiquetas.includes(etiqueta)) return false
      if (fechaFiltro && fechaDeNota(n) !== fechaFiltro) return false
      if (mesFiltro && fechaDeNota(n).slice(0, 7) !== mesFiltro) return false
      return notaHay(n, qLower)
    })
    return rows.sort(compararNotas)
  }, [notas, vista, etiqueta, fechaFiltro, mesFiltro, qLower])

  function limpiarFiltros() {
    setFechaFiltro('')
    setMesFiltro('')
    patch({ q: undefined, etiqueta: undefined })
  }

  const filterTools = useMemo<FilterTool[]>(
    () => [
      {
        id: 'fecha',
        label: 'Fecha',
        icon: CalendarDays,
        active: Boolean(fechaFiltro || mesFiltro),
        content: (
          <div className="stack" style={{ gap: '0.7rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="notas-fecha-filtro">Fecha concreta</label>
              <input
                id="notas-fecha-filtro"
                className="input"
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="notas-mes-filtro">Mes</label>
              <input
                id="notas-mes-filtro"
                className="input"
                type="month"
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
              />
            </div>
          </div>
        ),
      },
    ],
    [fechaFiltro, mesFiltro],
  )

  const formEtiquetas = parseEtiquetas(etiquetasText)
  const viewNota = viewId ? (notas.find((n) => n.id === viewId) ?? null) : null
  const viewFicha = viewNota?.fichaId ? fichaMap[viewNota.fichaId] : undefined
  const viewActividad = viewNota?.actividadId
    ? actividades.find((a) => a.id === viewNota.actividadId)
    : undefined

  return (
    <div className="stack">
      <FilterDrawerSlot
        title="Notas"
        tools={filterTools}
        canClear={hayFiltros}
        onClear={limpiarFiltros}
      />
      <Modal
        open={!!viewNota}
        title={viewNota?.titulo ?? 'Nota'}
        onClose={() => setViewId(null)}
        footer={
          viewNota ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setViewId(null)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openEdit(viewNota)
                  setViewId(null)
                }}
              >
                <Pencil size={16} /> Editar
              </button>
            </>
          ) : undefined
        }
      >
        {viewNota ? (
          <div className="stack" style={{ gap: '0.5rem' }}>
            <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
              {formatDate(fechaDeNota(viewNota))}
              {viewNota.etiquetas.length ? ` · ${viewNota.etiquetas.join(' · ')}` : ''}
            </p>
            {viewNota.cuerpo ? (
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{viewNota.cuerpo}</p>
            ) : null}
            {viewFicha || viewActividad ? (
              <div className="row" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                {viewFicha ? (
                  <Link className="chip compact" to={`/fichas/${viewFicha.id}`}>
                    <FichaTitle ficha={viewFicha} unified icon />
                  </Link>
                ) : null}
                {viewActividad ? (
                  <Link className="chip compact" to={`/actividades/${viewActividad.id}`}>
                    <ActividadTitle actividad={viewActividad} />
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
      <div className="page-head">
        <p className="muted" style={{ margin: 0 }}>
          {notas.filter((n) => !n.archivada).length} activa
          {notas.filter((n) => !n.archivada).length === 1 ? '' : 's'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-add" onClick={openNew}>
            <Plus size={16} />
            Nueva
          </button>
        </div>
      </div>

      <div className="seg-toggle tabs-2" role="tablist" aria-label="Notas activas o archivadas">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'activas'}
          className={vista === 'activas' ? 'active' : ''}
          onClick={() => patch({ vista: '' })}
        >
          Activas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'archivadas'}
          className={vista === 'archivadas' ? 'active' : ''}
          onClick={() => patch({ vista: 'archivadas' })}
        >
          Archivadas
        </button>
      </div>

      <label className="search-field" htmlFor="notas-q">
        <Search size={16} aria-hidden />
        <input
          id="notas-q"
          className="input"
          type="search"
          placeholder="Buscar en título, texto o etiqueta"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value)
            patch({ q: e.target.value || undefined })
          }}
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
        />
      </label>

      {etiquetasUsadas.length ? (
        <div className="chip-row tight" aria-label="Filtrar por etiqueta">
          {etiqueta ? (
            <button type="button" className="chip compact active" onClick={() => patch({ etiqueta: undefined })}>
              ✕ {etiqueta}
            </button>
          ) : null}
          {etiquetasUsadas
            .filter((t) => t !== etiqueta)
            .map((t) => (
              <button
                key={t}
                type="button"
                className="chip compact"
                onClick={() => patch({ etiqueta: t })}
              >
                {t}
              </button>
            ))}
        </div>
      ) : null}

      {formOpen ? (
        <div ref={formRef} style={{ scrollMarginTop: '4rem' }}>
        <EntityCard
          title={
            <h3 className="title-sm" style={{ margin: 0 }}>
              <NotebookPen size={16} aria-hidden /> {editingId ? 'Editar nota' : 'Nueva nota'}
            </h3>
          }
        >
          <form onSubmit={(e) => void save(e)}>
            <div className="field">
              <label htmlFor="nota-titulo">Título</label>
              <input
                id="nota-titulo"
                ref={tituloRef}
                className="input"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="p. ej. Comprar juntas para el tanque"
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="nota-cuerpo">Texto</label>
              <textarea
                id="nota-cuerpo"
                className="textarea"
                rows={4}
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                placeholder="Detalles, medidas, pendientes…"
              />
            </div>
            <div className="field">
              <label htmlFor="nota-etiquetas">Etiquetas (separadas por comas)</label>
              <input
                id="nota-etiquetas"
                className="input"
                value={etiquetasText}
                onChange={(e) => setEtiquetasText(e.target.value)}
                placeholder="compras, urgente…"
                autoComplete="off"
              />
            </div>
      {etiquetasUsadas.length ? (
              <div className="chip-row tight" aria-label="Etiquetas existentes">
                {etiquetasUsadas.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip compact${formEtiquetas.includes(t) ? ' active' : ''}`}
                    onClick={() => toggleEtiqueta(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="muted" style={{ margin: '0.7rem 0 0.3rem' }}>
              Vincular a ficha o a actividad (solo uno).
            </p>
            <div className="ficha-form-grid">
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="nota-fecha">Fecha</label>
                <input
                  id="nota-fecha"
                  className="input"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="nota-ficha">Ficha (opcional)</label>
                <select
                  id="nota-ficha"
                  className="select"
                  value={fichaId}
                  onChange={(e) => {
                    setFichaId(e.target.value)
                    setOcurrenciaId('')
                    if (e.target.value) {
                      setActividadId('')
                      setEventoId('')
                    }
                  }}
                >
                  <option value="">Sin ficha</option>
                  {fichasOrdenadas.map((f) => (
                    <option key={f.id} value={f.id}>
                      {fichaTitulo(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="nota-inspeccion">Inspección (opcional)</label>
                <select
                  id="nota-inspeccion"
                  className="select"
                  value={ocurrenciaId}
                  disabled={!occsDeFicha.length}
                  onChange={(e) => setOcurrenciaId(e.target.value)}
                >
                  <option value="">Toda la ficha</option>
                  {occsDeFicha.map((o) => (
                    <option key={o.id} value={o.id}>
                      {monthLabel(o.fechaProgramada)} · {o.estado}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="nota-actividad">Actividad (opcional)</label>
                <select
                  id="nota-actividad"
                  className="select"
                  value={actividadId}
                  onChange={(e) => {
                    setActividadId(e.target.value)
                    setEventoId('')
                    if (e.target.value) {
                      setFichaId('')
                      setOcurrenciaId('')
                    }
                  }}
                >
                  <option value="">Sin actividad</option>
                  {actividadesOrdenadas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {actividadTitulo(a)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="nota-evento">Evento (opcional)</label>
                <select
                  id="nota-evento"
                  className="select"
                  value={eventoId}
                  disabled={!evtsDeActividad.length}
                  onChange={(e) => setEventoId(e.target.value)}
                >
                  <option value="">Toda la actividad</option>
                  {evtsDeActividad.map((e) => (
                    <option key={e.id} value={e.id}>
                      {monthLabel(e.fechaProgramada)} · {e.estado}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="row" style={{ gap: '0.5rem', margin: '0.7rem 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={fijada} onChange={(e) => setFijada(e.target.checked)} />
              Fijar arriba
            </label>
            {error ? <p className="danger-text">{error}</p> : null}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary">
                Guardar
              </button>
              <button type="button" className="btn" onClick={() => setFormOpen(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </EntityCard>
        </div>
      ) : null}

      {visibles.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={36} />}
          title={notas.length === 0 ? 'Sin notas' : 'Sin resultados'}
          text={
            notas.length === 0
              ? 'Guarda avisos, compras o pendientes con etiquetas y fíjalos arriba.'
              : 'Ninguna nota coincide con ese filtro.'
          }
          action={
            notas.length === 0 ? (
              <button type="button" className="btn btn-add" onClick={openNew}>
                <Plus size={16} /> Nueva nota
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="stack">
          {visibles.map((nota) => {
            const ficha = nota.fichaId ? fichaMap[nota.fichaId] : undefined
            const occ = nota.ocurrenciaId
              ? ocurrencias.find((o) => o.id === nota.ocurrenciaId)
              : undefined
            const actividad = nota.actividadId
              ? actividades.find((a) => a.id === nota.actividadId)
              : undefined
            const evt = nota.eventoId ? eventos.find((e) => e.id === nota.eventoId) : undefined
            return (
              <div
                key={nota.id}
                className="nota-card"
                role="button"
                tabIndex={0}
                aria-label={`Ver nota: ${nota.titulo}`}
                onClick={() => setViewId(nota.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setViewId(nota.id)
                  }
                }}
              >
              <EntityCard
                className="mensajes-msg"
                title={
                  <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                    {nota.fijada ? <Pin size={15} aria-label="Fijada" /> : null}
                    <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {nota.titulo}
                    </strong>
                  </div>
                }
                badge={
                  <span className="muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                    {formatDate(fechaDeNota(nota))}
                  </span>
                }
                footer={
                  <div className="row" style={{ gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="icon-btn"
                      title={nota.fijada ? 'Soltar' : 'Fijar arriba'}
                      aria-label={nota.fijada ? 'Soltar' : 'Fijar arriba'}
                      onClick={() => void toggleFijada(nota)}
                    >
                      {nota.fijada ? <PinOff size={16} /> : <Pin size={16} />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-edit"
                      title="Editar"
                      aria-label="Editar nota"
                      onClick={() => openEdit(nota)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title={nota.archivada ? 'Desarchivar' : 'Archivar'}
                      aria-label={nota.archivada ? 'Desarchivar' : 'Archivar'}
                      onClick={() => void toggleArchivada(nota)}
                    >
                      {nota.archivada ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-delete"
                      title="Borrar"
                      aria-label="Borrar nota"
                      onClick={() => void remove(nota)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                }
              >
                {nota.cuerpo ? (
                  <p className="nota-snippet">{nota.cuerpo}</p>
                ) : null}
                <div
                  className="row"
                  style={{ flexWrap: 'wrap', gap: '0.35rem', marginTop: nota.cuerpo ? '0.4rem' : 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {nota.etiquetas.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="chip compact"
                      onClick={() => patch({ etiqueta: t })}
                      title={`Filtrar por ${t}`}
                    >
                      {t}
                    </button>
                  ))}
                  {ficha ? (
                    <Link className="chip compact" to={`/fichas/${ficha.id}`}>
                      <FichaTitle ficha={ficha} unified icon />
                    </Link>
                  ) : null}
                  {occ ? (
                    <Link className="chip compact" to={`/ocurrencias/${occ.id}`}>
                      {monthLabel(occ.fechaProgramada)}
                    </Link>
                  ) : null}
                  {actividad ? (
                    <Link className="chip compact" to={`/actividades/${actividad.id}`}>
                      <ActividadTitle actividad={actividad} />
                    </Link>
                  ) : null}
                  {evt ? (
                    <Link className="chip compact" to={`/eventos/${evt.id}`}>
                      {monthLabel(evt.fechaProgramada)}
                    </Link>
                  ) : null}
                </div>
              </EntityCard>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
