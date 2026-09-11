import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { db } from '../db'
import type { Encargado } from '../db/types'
import { createId } from '../lib/ids'
import { ColorPicker } from '../components/ColorPicker'
import { CrearBloqueForm } from '../components/CrearBloqueForm'

export function MaestrosPage() {
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []

  const [encNombre, setEncNombre] = useState('')
  const [encTelefonos, setEncTelefonos] = useState('')
  const [encCongregacion, setEncCongregacion] = useState('')
  const [error, setError] = useState('')
  const [editBloque, setEditBloque] = useState<string | null>(null)
  const [editEnc, setEditEnc] = useState<string | null>(null)
  const [tab, setTab] = useState<'bloques' | 'encargados'>('bloques')

  async function addEncargado(e: FormEvent) {
    e.preventDefault()
    if (!encNombre.trim()) return
    const now = Date.now()
    await db.encargados.add({
      id: createId(),
      nombre: encNombre.trim(),
      telefonos: encTelefonos.trim() || undefined,
      congregacion: encCongregacion.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    })
    setEncNombre('')
    setEncTelefonos('')
    setEncCongregacion('')
  }

  async function removeBloque(id: string) {
    if (fichas.some((f) => f.grupoId === id)) {
      setError('No se puede borrar un bloque que tiene fichas. Reasigna o elimina esas fichas antes.')
      return
    }
    await db.grupos.delete(id)
    setError('')
  }

  async function removeEncargado(id: string) {
    if (fichas.some((f) => f.encargadoId === id)) {
      setError('No se puede borrar un encargado asignado a fichas.')
      return
    }
    await db.encargados.delete(id)
    setError('')
  }

  return (
    <div>
      {error ? <p className="danger-text">{error}</p> : null}

      <div className="seg-toggle" role="tablist" aria-label="Bloques o encargados">
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
      </div>

      {tab === 'bloques' ? (
      <section className="card">
        <h2 className="title-sm">Bloques</h2>
        <p className="muted">
          Los bloques agrupan fichas. Elige cualquier color con la paleta.
        </p>
        <CrearBloqueForm compact />
        {bloques.length === 0 ? (
          <p className="muted" style={{ marginTop: '1rem' }}>
            Aún no hay bloques.
          </p>
        ) : (
          <div className="table-card" style={{ marginTop: '1rem' }}>
            <div className="table-head table-cols-bloques">
              <span>Bloque</span>
              <span>Fichas</span>
              <span className="table-actions">Acciones</span>
            </div>
            {bloques.map((b) => (
              <div
                key={b.id}
                className={`table-row table-cols-bloques${editBloque === b.id ? ' is-editing' : ''}`}
              >
                {editBloque === b.id ? (
                  <div>
                    <input
                      className="input"
                      defaultValue={b.nombre}
                      onBlur={(e) => {
                        const nombre = e.target.value.trim()
                        if (nombre) void db.grupos.update(b.id, { nombre, updatedAt: Date.now() })
                      }}
                      autoFocus
                    />
                    <ColorPicker
                      value={b.color}
                      onChange={(color) => void db.grupos.update(b.id, { color, updatedAt: Date.now() })}
                    />
                    <button type="button" className="btn" onClick={() => setEditBloque(null)}>
                      Listo
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="table-cell row" style={{ gap: '0.5rem' }}>
                      <span className="color-dot" style={{ background: b.color, marginTop: 0 }} />
                      <strong style={{ color: b.color }}>{b.nombre}</strong>
                    </span>
                    <span className="muted table-nowrap">
                      {fichas.filter((f) => f.grupoId === b.id).length}
                    </span>
                    <span className="table-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() => setEditBloque(b.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Eliminar"
                        onClick={() => void removeBloque(b.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <Link className="btn" to="/fichas/nueva" style={{ marginTop: '0.85rem' }}>
          <Plus size={16} />
          Nueva ficha
        </Link>
      </section>
      ) : (
      <section className="card">
        <h2 className="title-sm">Encargados</h2>
        <form onSubmit={(e) => void addEncargado(e)}>
          <div className="field">
            <label htmlFor="en">Nombre</label>
            <input
              id="en"
              className="input"
              value={encNombre}
              onChange={(e) => setEncNombre(e.target.value)}
              placeholder="Nombre"
            />
          </div>
          <div className="field">
            <label htmlFor="et">Teléfono(s) (opcional)</label>
            <input
              id="et"
              className="input"
              value={encTelefonos}
              onChange={(e) => setEncTelefonos(e.target.value)}
              placeholder="Varios, separados por coma"
            />
          </div>
          <div className="field">
            <label htmlFor="eco">Congregación (opcional)</label>
            <input
              id="eco"
              className="input"
              value={encCongregacion}
              onChange={(e) => setEncCongregacion(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            <Plus size={16} />
            Añadir encargado
          </button>
        </form>
        <div className="table-card" style={{ marginTop: '1rem' }}>
          {encargados.length === 0 ? (
            <p className="table-empty">Aún no hay encargados.</p>
          ) : (
            <>
              <div className="table-head table-cols-encargados">
                <span>Nombre</span>
                <span className="col-md">Teléfono</span>
                <span className="col-md">Congregación</span>
                <span className="table-actions">Acciones</span>
              </div>
              {encargados.map((p) => (
                <div
                  key={p.id}
                  className={`table-row table-cols-encargados${editEnc === p.id ? ' is-editing' : ''}`}
                >
                  {editEnc === p.id ? (
                    <EncargadoEditor enc={p} onDone={() => setEditEnc(null)} />
                  ) : (
                    <>
                      <span className="table-cell">
                        <strong>{p.nombre}</strong>
                        <span className="muted col-sm-only">
                          {[p.telefonos || p.contacto, p.congregacion].filter(Boolean).join(' · ') ||
                            'Sin teléfono ni congregación'}
                        </span>
                      </span>
                      <span className="col-md muted">{p.telefonos || p.contacto || '—'}</span>
                      <span className="col-md muted">{p.congregacion || '—'}</span>
                      <span className="table-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Editar"
                          onClick={() => setEditEnc(p.id)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Eliminar"
                          onClick={() => void removeEncargado(p.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </span>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </section>
      )}
    </div>
  )
}

function EncargadoEditor({
  enc,
  onDone,
}: {
  enc: Encargado
  onDone: () => void
}) {
  const [nombre, setNombre] = useState(enc.nombre)
  const [telefonos, setTelefonos] = useState(enc.telefonos || enc.contacto || '')
  const [congregacion, setCongregacion] = useState(enc.congregacion || '')
  const [error, setError] = useState('')

  async function save() {
    const name = nombre.trim()
    if (!name) {
      setError('Escribe el nombre del encargado.')
      return
    }
    await db.encargados.update(enc.id, {
      nombre: name,
      telefonos: telefonos.trim() || undefined,
      congregacion: congregacion.trim() || undefined,
      updatedAt: Date.now(),
    })
    onDone()
  }

  return (
    <div>
      <div className="field">
        <label htmlFor={`enc-edit-nombre-${enc.id}`}>Nombre</label>
        <input
          id={`enc-edit-nombre-${enc.id}`}
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />
      </div>
      <div className="ficha-form-grid" style={{ marginBottom: '0.5rem' }}>
        <div className="field">
          <label htmlFor={`enc-edit-tel-${enc.id}`}>Teléfono(s)</label>
          <input
            id={`enc-edit-tel-${enc.id}`}
            className="input"
            value={telefonos}
            onChange={(e) => setTelefonos(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="field">
          <label htmlFor={`enc-edit-cong-${enc.id}`}>Congregación</label>
          <input
            id={`enc-edit-cong-${enc.id}`}
            className="input"
            value={congregacion}
            onChange={(e) => setCongregacion(e.target.value)}
            placeholder="Opcional"
          />
        </div>
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
