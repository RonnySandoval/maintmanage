import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  CircleCheck,
  CalendarClock,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  PRIORIDADES,
  prioridadOf,
  tipoAccionLabel,
  tipoAccionOf,
  type AccionCorrectiva,
  type EstadoCorrectiva,
  type PrioridadAccion,
  type TipoAccion,
} from '../db/types'
import {
  accionDetalle,
  accionHref,
  accionTitulo,
  convertirAccionHref,
  convertirRecomendacionACorrectiva,
  estadoAgendaCorrectiva,
  limpiarTrazabilidadAlBorrar,
} from '../lib/acciones'
import { createId } from '../lib/ids'
import { accionLabel, accionesTitulo, useAliases } from '../lib/labels'
import { PrioridadMark } from './PrioridadMark'
import { ExpandableText } from './ExpandableText'
import { AccionFechaLabel, AccionFechasToggle, StatusBadge } from './ui'
import { EntityCard } from './EntityCard'

export function AccionesPanel({
  fichaId,
  actividadId,
  ocurrenciaId,
  eventoId,
  onlyCorrectiva = false,
}: {
  fichaId?: string
  actividadId?: string
  ocurrenciaId?: string
  eventoId?: string
  onlyCorrectiva?: boolean
}) {
  const aliases = useAliases()
  const acciones =
    useLiveQuery(async () => {
      const rows = fichaId
        ? await db.accionesCorrectivas.where('fichaId').equals(fichaId).toArray()
        : actividadId
          ? await db.accionesCorrectivas.where('actividadId').equals(actividadId).toArray()
          : []
      const scoped = eventoId
        ? rows.filter((a) => a.eventoId === eventoId)
        : ocurrenciaId
          ? rows.filter((a) => a.ocurrenciaId === ocurrenciaId)
          : rows
      const typed = onlyCorrectiva
        ? scoped.filter((a) => tipoAccionOf(a) === 'correctiva')
        : scoped
      return typed.sort((a, b) => b.createdAt - a.createdAt)
    }, [fichaId, actividadId, ocurrenciaId, eventoId, onlyCorrectiva]) ?? []

  const [tipo, setTipo] = useState<TipoAccion>('correctiva')
  const [texto, setTexto] = useState('')
  const [detalle, setDetalle] = useState('')
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadAccion>('media')
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todas' | TipoAccion>('todas')
  const [filtroFecha, setFiltroFecha] = useState<'todas' | 'con' | 'sin'>('todas')
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const visibles = acciones.filter((a) => {
    if (!onlyCorrectiva && filtroTipo !== 'todas' && tipoAccionOf(a) !== filtroTipo) return false
    if (filtroFecha === 'con' && !a.fechaObjetivo) return false
    if (filtroFecha === 'sin' && a.fechaObjetivo) return false
    return true
  })

  async function add(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!texto.trim()) {
      setError('Escribe el título.')
      return
    }
    const nextTipo = onlyCorrectiva ? 'correctiva' : tipo
    const now = Date.now()
    // La recomendación no lleva fecha: siempre pendiente hasta convertirse.
    const nextFecha = nextTipo === 'recomendacion' ? '' : fecha
    const nextEstado: EstadoCorrectiva = nextFecha ? 'programada' : 'pendiente'
    const detalleTrim = detalle.trim()
    await db.accionesCorrectivas.add({
      id: createId(),
      fichaId: fichaId || undefined,
      ocurrenciaId: ocurrenciaId || undefined,
      actividadId: actividadId || undefined,
      eventoId: eventoId || undefined,
      tipo: nextTipo,
      texto: texto.trim(),
      detalle: detalleTrim || undefined,
      estado: nextEstado,
      fechaObjetivo: nextFecha || undefined,
      prioridad: nextTipo === 'correctiva' ? prioridad : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setTexto('')
    setDetalle('')
    setFecha('')
    setPrioridad('media')
    setTipo('correctiva')
    setShowForm(false)
  }

  async function convertir(id: string) {
    const rec = acciones.find((a) => a.id === id)
    if (!rec || tipoAccionOf(rec) !== 'recomendacion' || convertingId) return
    setConvertingId(id)
    try {
      await convertirRecomendacionACorrectiva(rec)
    } finally {
      setConvertingId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Borrar este registro?')) return
    const target = acciones.find((a) => a.id === id)
    if (target) await limpiarTrazabilidadAlBorrar(target)
    const ejec = await db.ejecuciones.where('accionId').equals(id).first()
    if (ejec) {
      await db.adjuntos.where('ejecucionId').equals(ejec.id).delete()
      await db.ejecuciones.delete(ejec.id)
    }
    await db.accionesCorrectivas.delete(id)
    if (editId === id) setEditId(null)
    if (scheduleId === id) setScheduleId(null)
  }

  const titulo = accionesTitulo(onlyCorrectiva, aliases)

  return (
    <div className={`card accordion-panel${open ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="accordion-label">
          <ListChecks size={16} />
          <span>
            {titulo}
            {!open && acciones.length ? (
              <span className="muted" style={{ fontWeight: 500 }}>
                {' · '}
                {acciones.length}
              </span>
            ) : null}
          </span>
        </span>
        <ChevronDown size={18} className={open ? 'is-open' : ''} />
      </button>
      {open ? (
        <div className="accordion-body">
          <div>
            {acciones.length > 0 ? (
              <div className="acciones-filtros">
                <div className="row-spread" style={{ marginBottom: '0.35rem' }}>
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    Lista
                  </span>
                  <AccionFechasToggle />
                </div>
                {onlyCorrectiva ? null : (
                  <div className="chip-row tight" role="tablist" aria-label="Tipo en la lista">
                    <button
                      type="button"
                      className={`chip compact${filtroTipo === 'todas' ? ' active' : ''}`}
                      onClick={() => setFiltroTipo('todas')}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      className={`chip compact${filtroTipo === 'correctiva' ? ' active' : ''}`}
                      onClick={() => setFiltroTipo('correctiva')}
                    >
                      {accionLabel('correctiva', aliases)}
                    </button>
                    <button
                      type="button"
                      className={`chip compact${filtroTipo === 'recomendacion' ? ' active' : ''}`}
                      onClick={() => setFiltroTipo('recomendacion')}
                    >
                      {accionLabel('recomendacion', aliases)}
                    </button>
                  </div>
                )}
                <div className="chip-row tight" role="tablist" aria-label="Fecha límite">
                  <button
                    type="button"
                    className={`chip compact${filtroFecha === 'todas' ? ' active' : ''}`}
                    onClick={() => setFiltroFecha('todas')}
                  >
                    Con o sin fecha
                  </button>
                  <button
                    type="button"
                    className={`chip compact${filtroFecha === 'con' ? ' active' : ''}`}
                    onClick={() => setFiltroFecha('con')}
                  >
                    Con fecha
                  </button>
                  <button
                    type="button"
                    className={`chip compact${filtroFecha === 'sin' ? ' active' : ''}`}
                    onClick={() => setFiltroFecha('sin')}
                  >
                    Sin fecha
                  </button>
                </div>
              </div>
            ) : null}
            {acciones.length === 0 ? (
              <p className="table-empty">Ningún registro aún.</p>
            ) : visibles.length === 0 ? (
              <p className="table-empty">Ninguna coincide con el filtro.</p>
            ) : (
              <div className="stack" style={{ gap: '0.5rem' }}>
                {visibles.map((a) => {
                  const detalleTxt = accionDetalle(a)
                  const isCorrectiva = tipoAccionOf(a) === 'correctiva'
                  if (editId === a.id) {
                    return (
                      <EntityCard
                        key={a.id}
                        compact
                        nested
                        leading={
                          isCorrectiva ? (
                            <PrioridadMark prioridad={prioridadOf(a)} iconOnly />
                          ) : undefined
                        }
                        title={<strong>{accionTitulo(a)}</strong>}
                      >
                        <AccionEditor
                          accion={a}
                          onDone={() => setEditId(null)}
                          onlyCorrectiva={onlyCorrectiva}
                        />
                      </EntityCard>
                    )
                  }
                  if (scheduleId === a.id) {
                    return (
                      <EntityCard
                        key={a.id}
                        compact
                        nested
                        leading={
                          isCorrectiva ? (
                            <PrioridadMark prioridad={prioridadOf(a)} iconOnly />
                          ) : undefined
                        }
                        title={<strong>{accionTitulo(a)}</strong>}
                      >
                        <ProgramarFechaForm accion={a} onDone={() => setScheduleId(null)} />
                      </EntityCard>
                    )
                  }
                  return (
                    <EntityCard
                      key={a.id}
                      compact
                      nested
                      leading={
                        isCorrectiva ? (
                          <PrioridadMark prioridad={prioridadOf(a)} iconOnly />
                        ) : undefined
                      }
                        title={
                          <Link to={accionHref(a)} className="accion-title-link">
                            <ExpandableText text={accionTitulo(a)} maxLines={2} maxChars={120} />
                          </Link>
                        }
                      badge={<StatusBadge estado={estadoAgendaCorrectiva(a)} />}
                      footer={
                        <div className="row accion-card-actions">
                          {!a.fechaObjetivo && isCorrectiva ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-schedule"
                              onClick={() => {
                                setEditId(null)
                                setScheduleId(a.id)
                              }}
                            >
                              <CalendarClock size={16} />
                              Programar fecha
                            </button>
                          ) : a.fechaObjetivo ? (
                            <Link
                              className="icon-btn"
                              to={accionHref(a)}
                              aria-label={a.estado === 'ejecutada' ? 'Ver ejecución' : 'Ejecutar'}
                              title={a.estado === 'ejecutada' ? 'Ver ejecución' : 'Ejecutar'}
                            >
                              <CircleCheck size={16} />
                            </Link>
                          ) : null}
                          {isCorrectiva ? (
                            <Link
                              className="icon-btn"
                              to={convertirAccionHref(a)}
                              aria-label="Convertir en actividad"
                              title="Convertir en actividad"
                            >
                              <Wrench size={16} />
                            </Link>
                          ) : a.convertidaEnId ? (
                            <Link
                              className="icon-btn"
                              to={accionHref({ id: a.convertidaEnId })}
                              aria-label="Ver acción correctiva"
                              title="Ver acción correctiva"
                            >
                              <ArrowRight size={16} />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Convertir en acción correctiva"
                              title="Convertir en acción correctiva"
                              disabled={convertingId === a.id}
                              onClick={() => void convertir(a.id)}
                            >
                              <ArrowRight size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn icon-btn-edit"
                            aria-label="Editar"
                            title="Editar"
                            onClick={() => {
                              setScheduleId(null)
                              setEditId(a.id)
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-delete"
                            aria-label="Borrar"
                            title="Borrar"
                            onClick={() => void remove(a.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      }
                    >
                      {detalleTxt ? (
                        <ExpandableText
                          text={detalleTxt}
                          className="accion-detalle"
                          maxLines={3}
                          maxChars={180}
                        />
                      ) : null}
                      <p className="muted occ-meta">
                        {tipoAccionLabel(tipoAccionOf(a), aliases)}
                        {isCorrectiva ? (
                          <AccionFechaLabel fechaObjetivo={a.fechaObjetivo} gated />
                        ) : null}
                      </p>
                      {!isCorrectiva && a.convertidaEnId ? (
                        <p className="muted occ-meta">
                          Convertida en correctiva:{' '}
                          <Link to={accionHref({ id: a.convertidaEnId })}>ver</Link>
                        </p>
                      ) : null}
                      {isCorrectiva && a.origenId ? (
                        <p className="muted occ-meta">
                          Proviene de recomendación:{' '}
                          <Link to={accionHref({ id: a.origenId })}>ver</Link>
                        </p>
                      ) : null}
                    </EntityCard>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ marginTop: '0.8rem' }}>
            <button
              type="button"
              className="btn btn-add"
              aria-expanded={showForm}
              onClick={() => setShowForm((was) => !was)}
            >
              <Plus size={16} />
              {showForm ? 'Ocultar' : 'Añadir'}
            </button>
          </div>
          {showForm ? (
            <form onSubmit={(e) => void add(e)} style={{ marginTop: '0.8rem' }}>
              {onlyCorrectiva ? null : (
                <div className="chip-row tight" role="tablist" aria-label="Tipo">
                  <button
                    type="button"
                    className={`chip compact${tipo === 'correctiva' ? ' active' : ''}`}
                    onClick={() => setTipo('correctiva')}
                  >
                    {accionLabel('correctiva', aliases)}
                  </button>
                  <button
                    type="button"
                    className={`chip compact${tipo === 'recomendacion' ? ' active' : ''}`}
                    onClick={() => setTipo('recomendacion')}
                  >
                    {accionLabel('recomendacion', aliases)}
                  </button>
                </div>
              )}
              <div className="field">
                <label htmlFor="accion-texto">Título</label>
                <textarea
                  id="accion-texto"
                  className="textarea compact"
                  rows={2}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={
                    tipo === 'recomendacion'
                      ? 'p. ej. Revisar holgura en la próxima visita'
                      : 'p. ej. Sustituir junta del tanque'
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="accion-detalle">Detalle</label>
                <textarea
                  id="accion-detalle"
                  className="textarea compact"
                  rows={3}
                  value={detalle}
                  onChange={(e) => setDetalle(e.target.value)}
                  placeholder="Opcional: contexto, materiales, ubicación…"
                />
              </div>
              {onlyCorrectiva || tipo === 'correctiva' ? (
                <div className="field">
                  <label htmlFor="accion-fecha">Fecha programada (opcional)</label>
                  <input
                    id="accion-fecha"
                    className="input"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                </div>
              ) : (
                <p className="muted" style={{ marginTop: 0 }}>
                  La recomendación no lleva fecha. Podrás convertirla en correctiva después.
                </p>
              )}
              {onlyCorrectiva || tipo === 'correctiva' ? (
                <div className="field">
                  <label id="accion-prioridad">Prioridad</label>
                  <div className="chip-row tight" role="radiogroup" aria-labelledby="accion-prioridad">
                    {PRIORIDADES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={prioridad === p.id}
                        className={`chip compact${prioridad === p.id ? ' active' : ''}`}
                        onClick={() => setPrioridad(p.id)}
                      >
                        <PrioridadMark prioridad={p.id} forceLabel />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {error ? <p className="danger-text">{error}</p> : null}
              <button className="btn btn-add" type="submit">
                <Plus size={16} />
                Añadir
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ProgramarFechaForm({
  accion,
  onDone,
}: {
  accion: AccionCorrectiva
  onDone: () => void
}) {
  const [fecha, setFecha] = useState(accion.fechaObjetivo || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    if (!fecha) {
      setError('Elige una fecha.')
      return
    }
    setSaving(true)
    try {
      const next: AccionCorrectiva = {
        ...accion,
        fechaObjetivo: fecha,
        updatedAt: Date.now(),
      }
      if (next.estado !== 'ejecutada') next.estado = 'programada'
      await db.accionesCorrectivas.put(next)
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="field">
        <label htmlFor={`prog-${accion.id}`}>Fecha programada</label>
        <input
          id={`prog-${accion.id}`}
          className="input"
          type="date"
          value={fecha}
          autoFocus
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      {error ? <p className="danger-text">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Guardando…' : 'Programar'}
        </button>
        <button type="button" className="btn" disabled={saving} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

export function AccionEditor({
  accion,
  onDone,
  onlyCorrectiva = false,
}: {
  accion: AccionCorrectiva
  onDone: () => void
  onlyCorrectiva?: boolean
}) {
  const aliases = useAliases()
  const [tipo, setTipo] = useState<TipoAccion>(tipoAccionOf(accion))
  const [texto, setTexto] = useState(accion.texto)
  const [detalle, setDetalle] = useState(accion.detalle ?? '')
  const estado = accion.estado
  const [fecha, setFecha] = useState(accion.fechaObjetivo || '')
  const [prioridad, setPrioridad] = useState<PrioridadAccion>(prioridadOf(accion))
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!texto.trim()) {
      setError('Escribe el título.')
      return
    }
    const nextTipo = onlyCorrectiva ? 'correctiva' : tipo
    const detalleTrim = detalle.trim()
    const next: AccionCorrectiva = {
      ...accion,
      tipo: nextTipo,
      texto: texto.trim(),
      estado,
      updatedAt: Date.now(),
    }
    if (detalleTrim) next.detalle = detalleTrim
    else delete next.detalle
    if (fecha) next.fechaObjetivo = fecha
    else delete next.fechaObjetivo
    if (estado !== 'ejecutada') {
      next.estado = fecha ? 'programada' : 'pendiente'
    }
    if (nextTipo === 'correctiva') next.prioridad = prioridad
    else delete next.prioridad
    if (next.estado !== 'ejecutada') {
      const ejec = await db.ejecuciones.where('accionId').equals(accion.id).first()
      if (ejec) {
        await db.adjuntos.where('ejecucionId').equals(ejec.id).delete()
        await db.ejecuciones.delete(ejec.id)
      }
    }
    await db.accionesCorrectivas.put(next)
    onDone()
  }

  return (
    <div>
      {onlyCorrectiva ? null : (
        <div className="chip-row tight">
          <button
            type="button"
            className={`chip compact${tipo === 'correctiva' ? ' active' : ''}`}
            onClick={() => setTipo('correctiva')}
          >
            {accionLabel('correctiva', aliases)}
          </button>
          <button
            type="button"
            className={`chip compact${tipo === 'recomendacion' ? ' active' : ''}`}
            onClick={() => {
              setTipo('recomendacion')
              setFecha('')
            }}
          >
            {accionLabel('recomendacion', aliases)}
          </button>
        </div>
      )}
      <div className="field">
        <label>Título</label>
        <textarea
          className="textarea compact"
          rows={2}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Detalle</label>
        <textarea
          className="textarea compact"
          rows={3}
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          placeholder="Opcional: contexto, materiales, ubicación…"
        />
      </div>
      {onlyCorrectiva || tipo === 'correctiva' ? (
        <div className="field">
          <label>Fecha programada (opcional)</label>
          <input
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      ) : null}
      {onlyCorrectiva || tipo === 'correctiva' ? (
        <p className="muted" style={{ marginTop: 0 }}>
          El estado se calcula por esa fecha, no por la inspección o actividad de origen.
          {fecha ? (
            <>
              {' '}
              <Link to={accionHref(accion)}>
                {accion.estado === 'ejecutada' ? 'Ver o editar ejecución' : 'Ejecutar'}
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <p className="muted" style={{ marginTop: 0 }}>
          La recomendación no lleva fecha. Podrás convertirla en correctiva después.
        </p>
      )}
      {onlyCorrectiva || tipo === 'correctiva' ? (
        <div className="field">
          <label>Prioridad</label>
          <div className="chip-row tight" role="radiogroup" aria-label="Prioridad">
            {PRIORIDADES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={prioridad === p.id}
                className={`chip compact${prioridad === p.id ? ' active' : ''}`}
                onClick={() => setPrioridad(p.id)}
              >
                <PrioridadMark prioridad={p.id} forceLabel />
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {error ? <p className="danger-text">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          Guardar
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
