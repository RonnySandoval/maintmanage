import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { db } from '../db'
import { createId } from '../lib/ids'
import { ColorPicker } from './ColorPicker'

export function CrearBloqueForm({
  onCreated,
  compact = false,
}: {
  onCreated?: (id: string) => void
  compact?: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#0f766e')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const name = nombre.trim()
    if (!name) {
      setError('Escribe el nombre del bloque.')
      return
    }
    const now = Date.now()
    const created = {
      id: createId(),
      nombre: name,
      color,
      createdAt: now,
      updatedAt: now,
    }
    await db.grupos.add(created)
    setNombre('')
    setColor('#0f766e')
    setError('')
    onCreated?.(created.id)
  }

  return (
    <form className={compact ? '' : 'create-panel'} onSubmit={(e) => void onSubmit(e)}>
      {!compact ? <h3 className="title-sm">Crear bloque</h3> : null}
      <p className="muted" style={{ marginTop: compact ? 0 : undefined }}>
        Un bloque agrupa fichas del mismo sector o sistema (p. ej. Edificio A, HVAC, Ascensores).
      </p>
      <div className="field">
        <label htmlFor="bloque-nuevo-nombre">Nombre del bloque</label>
        <input
          id="bloque-nuevo-nombre"
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="p. ej. Planta baja, Eléctrico…"
        />
      </div>
      <ColorPicker id="bloque-nuevo-color" value={color} onChange={setColor} />
      {error ? <p className="danger-text">{error}</p> : null}
      <button className="btn btn-primary" type="submit">
        <Plus size={16} />
        Crear bloque
      </button>
    </form>
  )
}
