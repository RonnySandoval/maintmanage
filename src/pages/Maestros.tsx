import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
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
    <div className="split split-2">
      {error ? <p className="danger-text" style={{ gridColumn: '1 / -1' }}>{error}</p> : null}

      <section className="card">
        <h2 className="title-sm">Bloques</h2>
        <p className="muted">
          Los bloques agrupan fichas. Elige cualquier color con la paleta.
        </p>
        <CrearBloqueForm compact />
        <div className="list" style={{ marginTop: '1rem' }}>
          {bloques.length === 0 ? (
            <p className="muted">Aún no hay bloques.</p>
          ) : (
            bloques.map((b) => (
              <div key={b.id} className="card" style={{ boxShadow: 'none' }}>
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
                  <div className="row-spread">
                    <div className="row">
                      <span className="color-dot" style={{ background: b.color, marginTop: 0 }} />
                      <strong>{b.nombre}</strong>
                      <span className="muted">
                        {fichas.filter((f) => f.grupoId === b.id).length} ficha(s)
                      </span>
                    </div>
                    <div className="row">
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
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
        <Link className="btn" to="/fichas/nueva" style={{ marginTop: '0.85rem' }}>
          <Plus size={16} />
          Nueva ficha
        </Link>
      </section>

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
        <div className="list" style={{ marginTop: '1rem' }}>
          {encargados.map((p) => (
            <div key={p.id} className="row-spread">
              {editEnc === p.id ? (
                <div className="grow">
                  <input
                    className="input"
                    defaultValue={p.nombre}
                    onBlur={(e) => {
                      const nombre = e.target.value.trim()
                      if (nombre) void db.encargados.update(p.id, { nombre, updatedAt: Date.now() })
                      setEditEnc(null)
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <strong>{p.nombre}</strong>
                  {p.telefonos || p.contacto ? (
                    <div className="muted">{p.telefonos || p.contacto}</div>
                  ) : null}
                  {p.congregacion ? <div className="muted">{p.congregacion}</div> : null}
                </div>
              )}
              <div className="row">
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
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
