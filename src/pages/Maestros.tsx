import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../db'
import { GRUPO_COLORS } from '../db/types'
import { createId } from '../lib/ids'

export function MaestrosPage() {
  const grupos = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []

  const [grupoNombre, setGrupoNombre] = useState('')
  const [grupoColor, setGrupoColor] = useState(GRUPO_COLORS[0])
  const [encNombre, setEncNombre] = useState('')
  const [encContacto, setEncContacto] = useState('')
  const [error, setError] = useState('')
  const [editGrupo, setEditGrupo] = useState<string | null>(null)
  const [editEnc, setEditEnc] = useState<string | null>(null)

  async function addGrupo(e: FormEvent) {
    e.preventDefault()
    if (!grupoNombre.trim()) return
    const now = Date.now()
    await db.grupos.add({
      id: createId(),
      nombre: grupoNombre.trim(),
      color: grupoColor,
      createdAt: now,
      updatedAt: now,
    })
    setGrupoNombre('')
  }

  async function addEncargado(e: FormEvent) {
    e.preventDefault()
    if (!encNombre.trim()) return
    const now = Date.now()
    await db.encargados.add({
      id: createId(),
      nombre: encNombre.trim(),
      contacto: encContacto.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    })
    setEncNombre('')
    setEncContacto('')
  }

  async function removeGrupo(id: string) {
    if (fichas.some((f) => f.grupoId === id)) {
      setError('No se puede borrar un grupo que tiene fichas. Reasigna o elimina esas fichas antes.')
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
        <h2 className="title-sm">Grupos de fichas</h2>
        <form onSubmit={(e) => void addGrupo(e)}>
          <div className="field">
            <label htmlFor="gn">Nombre</label>
            <input
              id="gn"
              className="input"
              value={grupoNombre}
              onChange={(e) => setGrupoNombre(e.target.value)}
              placeholder="Ascensores, HVAC…"
            />
          </div>
          <div className="field">
            <label>Color</label>
            <div className="color-pick">
              {GRUPO_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={grupoColor === c ? 'active' : ''}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setGrupoColor(c)}
                />
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            <Plus size={16} />
            Añadir grupo
          </button>
        </form>
        <div className="list" style={{ marginTop: '1rem' }}>
          {grupos.map((g) => (
            <div key={g.id} className="row-spread">
              {editGrupo === g.id ? (
                <input
                  className="input"
                  defaultValue={g.nombre}
                  onBlur={(e) => {
                    const nombre = e.target.value.trim()
                    if (nombre) void db.grupos.update(g.id, { nombre, updatedAt: Date.now() })
                    setEditGrupo(null)
                  }}
                  autoFocus
                />
              ) : (
                <div className="row">
                  <span className="color-dot" style={{ background: g.color, marginTop: 0 }} />
                  <strong>{g.nombre}</strong>
                </div>
              )}
              <div className="row">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Editar"
                  onClick={() => setEditGrupo(g.id)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Eliminar"
                  onClick={() => void removeGrupo(g.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
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
            <label htmlFor="ec">Contacto (opcional)</label>
            <input
              id="ec"
              className="input"
              value={encContacto}
              onChange={(e) => setEncContacto(e.target.value)}
              placeholder="Teléfono o correo"
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
              ) : (
                <div>
                  <strong>{p.nombre}</strong>
                  {p.contacto ? <div className="muted">{p.contacto}</div> : null}
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
