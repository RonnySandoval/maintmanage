import { useState, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { db } from '../db'
import { createId } from '../lib/ids'

export function CrearEncargadoForm({
  onCreated,
}: {
  onCreated?: (id: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefonos, setTelefonos] = useState('')
  const [congregacion, setCongregacion] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    const name = nombre.trim()
    if (!name) {
      setError('Escribe el nombre del encargado.')
      return
    }
    const now = Date.now()
    const created = {
      id: createId(),
      nombre: name,
      telefonos: telefonos.trim() || undefined,
      congregacion: congregacion.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await db.encargados.add(created)
    setNombre('')
    setTelefonos('')
    setCongregacion('')
    setError('')
    onCreated?.(created.id)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
    void submit()
  }

  return (
    <div className="create-panel compact-panel" onKeyDown={onKeyDown}>
      <h3 className="title-sm">Crear encargado</h3>
      <div className="field">
        <label htmlFor="enc-nuevo-nombre">Nombre</label>
        <input
          id="enc-nuevo-nombre"
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
        />
      </div>
      <div className="ficha-form-grid" style={{ marginBottom: '0.45rem' }}>
        <div className="field">
          <label htmlFor="enc-nuevo-tel">Teléfono(s)</label>
          <input
            id="enc-nuevo-tel"
            className="input"
            value={telefonos}
            onChange={(e) => setTelefonos(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="field">
          <label htmlFor="enc-nuevo-cong">Congregación</label>
          <input
            id="enc-nuevo-cong"
            className="input"
            value={congregacion}
            onChange={(e) => setCongregacion(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
      {error ? <p className="danger-text">{error}</p> : null}
      <button className="btn btn-add" type="button" onClick={() => void submit()}>
        <Plus size={16} />
        Crear encargado
      </button>
    </div>
  )
}
