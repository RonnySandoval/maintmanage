import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  ESTADOS_CORRECTIVA,
  tipoAccionLabel,
  tipoAccionOf,
  type AccionCorrectiva,
  type EstadoCorrectiva,
  type TipoAccion,
} from '../db/types'
import { createId } from '../lib/ids'
import { formatDate, todayISO } from '../lib/dates'

export function AccionesPanel({
  fichaId,
  ocurrenciaId,
  onlyCorrectiva = false,
}: {
  fichaId: string
  ocurrenciaId?: string
  onlyCorrectiva?: boolean
}) {
  const acciones =
    useLiveQuery(async () => {
      const rows = await db.accionesCorrectivas.where('fichaId').equals(fichaId).toArray()
      const scoped = ocurrenciaId
        ? rows.filter((a) => a.ocurrenciaId === ocurrenciaId)
        : rows
      const typed = onlyCorrectiva
        ? scoped.filter((a) => tipoAccionOf(a) === 'correctiva')
        : scoped
      return typed.sort((a, b) => b.createdAt - a.createdAt)
    }, [fichaId, ocurrenciaId, onlyCorrectiva]) ?? []

  const [tipo, setTipo] = useState<TipoAccion>('correctiva')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<EstadoCorrectiva>('pendiente')
  const [fecha, setFecha] = useState(todayISO())
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!texto.trim()) {
      setError('Escribe el texto.')
      return
    }
    const nextTipo = onlyCorrectiva ? 'correctiva' : tipo
    if (nextTipo === 'correctiva' && !fecha) {
      setError('La acción correctiva necesita una fecha.')
      return
    }
    const now = Date.now()
    await db.accionesCorrectivas.add({
      id: createId(),
      fichaId,
      ocurrenciaId,
      tipo: nextTipo,
      texto: texto.trim(),
      estado,
      fechaObjetivo: nextTipo === 'correctiva' ? fecha : undefined,
      createdAt: now,
      updatedAt: now,
    })
    setTexto('')
    setFecha(todayISO())
    setEstado('pendiente')
    setTipo('correctiva')
  }

  async function remove(id: string) {
    if (!confirm('¿Borrar este registro?')) return
    await db.accionesCorrectivas.delete(id)
    if (editId === id) setEditId(null)
  }

  return (
    <div className="card">
      <h3 className="title-sm">{onlyCorrectiva ? 'Acciones correctivas' : 'Acciones y recomendaciones'}</h3>
      <form onSubmit={(e) => void add(e)}>
        {onlyCorrectiva ? null : (
        <div className="chip-row tight" role="tablist" aria-label="Tipo">
          <button
            type="button"
            className={`chip compact${tipo === 'correctiva' ? ' active' : ''}`}
            onClick={() => setTipo('correctiva')}
          >
            Acción correctiva
          </button>
          <button
            type="button"
            className={`chip compact${tipo === 'recomendacion' ? ' active' : ''}`}
            onClick={() => setTipo('recomendacion')}
          >
            Recomendación
          </button>
        </div>
        )}
        <div className="field">
          <label htmlFor="accion-texto">
            {tipo === 'recomendacion' ? 'Recomendación' : 'Acción correctiva'}
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
        <div className={tipo === 'correctiva' ? 'ficha-form-grid' : ''}>
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
          {tipo === 'correctiva' ? (
            <div className="field">
              <label htmlFor="accion-fecha">Fecha (obligatoria)</label>
              <input
                id="accion-fecha"
                className="input"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              Las recomendaciones no llevan fecha.
            </p>
          )}
        </div>
        {error ? <p className="danger-text">{error}</p> : null}
        <button className="btn btn-primary" type="submit">
          <Plus size={16} />
          Añadir
        </button>
      </form>

      <div className="table-card" style={{ marginTop: '0.9rem', boxShadow: 'none' }}>
        {acciones.length === 0 ? (
          <p className="table-empty">Ningún registro aún.</p>
        ) : (
          <>
            <div className="table-head table-cols-accion">
              <span>Texto</span>
              <span className="col-md">Tipo</span>
              <span className="col-md">Fecha</span>
              <span>Estado</span>
              <span className="table-actions"> </span>
            </div>
            {acciones.map((a) =>
            editId === a.id ? (
              <div key={a.id} className="table-row is-editing">
                <AccionEditor accion={a} onDone={() => setEditId(null)} onlyCorrectiva={onlyCorrectiva} />
              </div>
            ) : (
              <div key={a.id} className="table-row table-cols-accion">
                <span className="table-cell">
                  <strong>{a.texto}</strong>
                  <span className="muted col-sm-only">
                    {tipoAccionLabel(tipoAccionOf(a))}
                    {a.fechaObjetivo ? ` · ${formatDate(a.fechaObjetivo)}` : ''}
                  </span>
                </span>
                <span className="col-md muted">{tipoAccionLabel(tipoAccionOf(a))}</span>
                <span className="col-md muted table-nowrap">
                  {a.fechaObjetivo ? formatDate(a.fechaObjetivo) : '—'}
                </span>
                <span className={`badge badge-${a.estado}`}>
                  {ESTADOS_CORRECTIVA.find((s) => s.id === a.estado)?.label ?? a.estado}
                </span>
                <span className="table-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Editar"
                    onClick={() => setEditId(a.id)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
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
  const [tipo, setTipo] = useState<TipoAccion>(tipoAccionOf(accion))
  const [texto, setTexto] = useState(accion.texto)
  const [estado, setEstado] = useState<EstadoCorrectiva>(accion.estado)
  const [fecha, setFecha] = useState(accion.fechaObjetivo || todayISO())
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!texto.trim()) {
      setError('Escribe el texto.')
      return
    }
    const nextTipo = onlyCorrectiva ? 'correctiva' : tipo
    if (nextTipo === 'correctiva' && !fecha) {
      setError('La acción correctiva necesita una fecha.')
      return
    }
    const next: AccionCorrectiva = {
      ...accion,
      tipo: nextTipo,
      texto: texto.trim(),
      estado,
      updatedAt: Date.now(),
    }
    if (nextTipo === 'correctiva') next.fechaObjetivo = fecha
    else delete next.fechaObjetivo
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
          Acción correctiva
        </button>
        <button
          type="button"
          className={`chip compact${tipo === 'recomendacion' ? ' active' : ''}`}
          onClick={() => setTipo('recomendacion')}
        >
          Recomendación
        </button>
      </div>
      )}
      <div className="field">
        <label>Texto</label>
        <input className="input" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className={tipo === 'correctiva' ? 'ficha-form-grid' : ''}>
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
        {tipo === 'correctiva' ? (
          <div className="field">
            <label>Fecha</label>
            <input
              className="input"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
        ) : null}
      </div>
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
