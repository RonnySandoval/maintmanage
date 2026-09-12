import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import type { Encargado } from '../db/types'
import { congregacionDe, congregacionLabel } from '../lib/fichas'
import { CopyText } from './CopyText'
import { CrearEncargadoForm } from './CrearEncargadoForm'

export function EncargadosPanel() {
  const [params] = useSearchParams()
  const openNuevo = params.get('nuevo') === '1'
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const [error, setError] = useState('')
  const [editEnc, setEditEnc] = useState<string | null>(null)

  async function removeEncargado(id: string) {
    if (fichas.some((f) => f.encargadoId === id) || actividades.some((a) => a.encargadoId === id)) {
      setError('No se puede borrar un encargado asignado a fichas o actividades.')
      return
    }
    await db.encargados.delete(id)
    setError('')
  }

  const encargadosPorCongregacion = useMemo(() => {
    const map = new Map<string, Encargado[]>()
    for (const enc of encargados) {
      const key = congregacionDe(enc)
      const list = map.get(key) ?? []
      list.push(enc)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (!a) return 1
        if (!b) return -1
        return a.localeCompare(b, 'es')
      })
      .map(([key, rows]) => ({
        key: key || '__none',
        label: congregacionLabel(key),
        rows,
      }))
  }, [encargados])

  return (
    <section className="card">
      {error ? <p className="danger-text">{error}</p> : null}
      <h2 className="title-sm">Encargados</h2>
      <CrearEncargadoForm accordion defaultOpen={openNuevo} />
      <div className="table-card" style={{ marginTop: '1rem' }}>
        {encargados.length === 0 ? (
          <p className="table-empty">Aún no hay encargados.</p>
        ) : (
          <>
            <div className="table-head table-cols-encargados">
              <span>Nombre</span>
              <span>Teléfono</span>
              <span className="table-actions">Acciones</span>
            </div>
            {encargadosPorCongregacion.map((group) => (
              <section key={group.key}>
                <div className="table-section">{group.label}</div>
                {group.rows.map((p) => {
                  const phone = p.telefonos || p.contacto || ''
                  return (
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
                          </span>
                          <span className="phone-cell">
                            {phone ? (
                              <>
                                <span className="muted">{phone}</span>
                                <CopyText text={phone} label="Copiar teléfono" />
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </span>
                          <span className="table-actions">
                            <button
                              type="button"
                              className="icon-btn icon-btn-edit"
                              aria-label="Editar"
                              onClick={() => setEditEnc(p.id)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-delete"
                              aria-label="Eliminar"
                              onClick={() => void removeEncargado(p.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
          </>
        )}
      </div>
    </section>
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
