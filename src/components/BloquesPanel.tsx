import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
import { bloqueColorVar } from '../lib/colors'
import { ColorPicker } from './ColorPicker'
import { CrearBloqueForm } from './CrearBloqueForm'

export function BloquesPanel() {
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const [error, setError] = useState('')
  const [editBloque, setEditBloque] = useState<string | null>(null)

  async function removeBloque(id: string) {
    if (fichas.some((f) => f.grupoId === id)) {
      setError('No se puede borrar un bloque que tiene fichas. Reasigna o elimina esas fichas antes.')
      return
    }
    await db.grupos.delete(id)
    setError('')
  }

  return (
    <section className="card">
      {error ? <p className="danger-text">{error}</p> : null}
      <h2 className="title-sm">Bloques</h2>
      <p className="muted">
        Los bloques agrupan fichas. Elige un color; se ajusta solo en modo claro y oscuro.
      </p>
      <CrearBloqueForm compact accordion defaultOpen={false} />
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
                  <button type="button" className="btn btn-primary" onClick={() => setEditBloque(null)}>
                    Listo
                  </button>
                </div>
              ) : (
                <>
                  <span className="table-cell row" style={{ gap: '0.5rem' }}>
                    <span className="color-dot" style={{ background: bloqueColorVar(b.color), marginTop: 0 }} />
                    <strong style={{ color: bloqueColorVar(b.color) }}>{b.nombre}</strong>
                  </span>
                  <span className="muted table-nowrap">
                    {fichas.filter((f) => f.grupoId === b.id).length}
                  </span>
                  <span className="table-actions">
                    <button
                      type="button"
                      className="icon-btn icon-btn-edit"
                      aria-label="Editar"
                      onClick={() => setEditBloque(b.id)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-delete"
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
      <Link className="btn btn-add" to="/fichas/nueva" style={{ marginTop: '0.85rem' }}>
        <Plus size={16} />
        Nueva ficha
      </Link>
    </section>
  )
}
