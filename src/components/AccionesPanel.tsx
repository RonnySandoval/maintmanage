import { useState, type FormEvent } from 'react'
import { ChevronDown, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  ESTADOS_CORRECTIVA,
  PRIORIDADES,
  prioridadOf,
  tipoAccionLabel,
  tipoAccionOf,
  type AccionCorrectiva,
  type EstadoCorrectiva,
  type PrioridadAccion,
  type TipoAccion,
} from '../db/types'
import { createId } from '../lib/ids'
import { formatDate } from '../lib/dates'
import { accionLabel, accionesTitulo, useAliases } from '../lib/labels'
import { PrioridadMark } from './PrioridadMark'

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
  const [estado, setEstado] = useState<EstadoCorrectiva>('pendiente')
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState<PrioridadAccion>('media')
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'todas' | TipoAccion>('todas')
  const [filtroFecha, setFiltroFecha] = useState<'todas' | 'con' | 'sin'>('todas')
  const [open, setOpen] = useState(false)

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
      setError('Escribe el texto.')
      return
    }
    const nextTipo = onlyCorrectiva ? 'correctiva' : tipo
    const now = Date.now()
    await db.accionesCorrectivas.add({
      id: createId(),
      fichaId: fichaId || undefined,
      ocurrenciaId: ocurrenciaId || undefined,
      actividadId: actividadId || undefined,
      eventoId: eventoId || undefined,
      tipo: nextTipo,
      texto: texto.trim(),
      estado,
      fechaObjetivo: fecha || undefined,
      prioridad: nextTipo === 'correctiva' ? prioridad : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setTexto('')
    setFecha('')
    setEstado('pendiente')
    setPrioridad('media')
    setTipo('correctiva')
  }

  async function remove(id: string) {
    if (!confirm('¿Borrar este registro?')) return
    await db.accionesCorrectivas.delete(id)
    if (editId === id) setEditId(null)
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
      <form onSubmit={(e) => void add(e)}>
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
          <label htmlFor="accion-texto">
            {accionLabel(tipo === 'recomendacion' ? 'recomendacion' : 'correctiva', aliases)}
          </label>
          <input
            id="accion-texto"
            className="input"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              tipo === 'recomendacion'
                ? 'p. ej. Revisar holgura en la próxima visita'
                : 'p. ej. Sustituir junta del tanque'
            }
          />
        </div>
        <div className="ficha-form-grid">
          <div className="field">
            <label htmlFor="accion-estado">Estado</label>
            <select
              id="accion-estado"
              className="select"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoCorrectiva)}
            >
              {ESTADOS_CORRECTIVA.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="accion-fecha">Fecha límite (opcional)</label>
            <input
              id="accion-fecha"
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        </div>
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
                  <PrioridadMark prioridad={p.id} />
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

      <div className="table-card" style={{ marginTop: '0.9rem', boxShadow: 'none' }}>
        {acciones.length > 0 ? (
          <div className="acciones-filtros">
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
          <>
            <div className="table-head table-cols-accion">
              <span>Texto</span>
              <span className="col-md">Tipo</span>
              <span className="col-md">Fecha</span>
              <span className="col-md">Prioridad</span>
              <span>Estado</span>
              <span className="table-actions"> </span>
            </div>
            {visibles.map((a) =>
            editId === a.id ? (
              <div key={a.id} className="table-row is-editing">
                <AccionEditor accion={a} onDone={() => setEditId(null)} onlyCorrectiva={onlyCorrectiva} />
              </div>
            ) : (
              <div key={a.id} className="table-row table-cols-accion">
                <span className="table-cell">
                  <strong>{a.texto}</strong>
                  <span className="muted col-sm-only">
                    {tipoAccionLabel(tipoAccionOf(a), aliases)}
                    {tipoAccionOf(a) === 'correctiva' ? (
                      <>
                        {' · '}
                        <PrioridadMark prioridad={prioridadOf(a)} />
                      </>
                    ) : null}
                    {a.fechaObjetivo ? ` · ${formatDate(a.fechaObjetivo)}` : ''}
                  </span>
                </span>
                <span className="col-md muted">{tipoAccionLabel(tipoAccionOf(a), aliases)}</span>
                <span className="col-md muted table-nowrap">
                  {a.fechaObjetivo ? formatDate(a.fechaObjetivo) : '—'}
                </span>
                <span className="col-md">
                  {tipoAccionOf(a) === 'correctiva' ? <PrioridadMark prioridad={prioridadOf(a)} /> : '—'}
                </span>
                <span className={`badge badge-${a.estado}`}>
                  {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                </span>
                <span className="table-actions">
                  <button
                    type="button"
                    className="icon-btn icon-btn-edit"
                    aria-label="Editar"
                    onClick={() => setEditId(a.id)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-delete"
                    aria-label="Borrar"
                    onClick={() => void remove(a.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </div>
            ),
          )}
          </>
        )}
      </div>
      </div>
      ) : null}
    </div>
  )
}

function AccionEditor({
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
  const [estado, setEstado] = useState<EstadoCorrectiva>(accion.estado)
  const [fecha, setFecha] = useState(accion.fechaObjetivo || '')
  const [prioridad, setPrioridad] = useState<PrioridadAccion>(prioridadOf(accion))
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!texto.trim()) {
      setError('Escribe el texto.')
      return
    }
    const nextTipo = onlyCorrectiva ? 'correctiva' : tipo
    const next: AccionCorrectiva = {
      ...accion,
      tipo: nextTipo,
      texto: texto.trim(),
      estado,
      updatedAt: Date.now(),
    }
    if (fecha) next.fechaObjetivo = fecha
    else delete next.fechaObjetivo
    if (nextTipo === 'correctiva') next.prioridad = prioridad
    else delete next.prioridad
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
          onClick={() => setTipo('recomendacion')}
        >
          {accionLabel('recomendacion', aliases)}
        </button>
      </div>
      )}
      <div className="field">
        <label>Texto</label>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="ficha-form-grid">
        <div className="field">
          <label>Estado</label>
          <select
            className="select"
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoCorrectiva)}
          >
            {ESTADOS_CORRECTIVA.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fecha límite (opcional)</label>
          <input
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>
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
                <PrioridadMark prioridad={p.id} />
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
