import { useState, type KeyboardEvent } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { db } from '../db'
import { createId } from '../lib/ids'
import { ColorPicker } from './ColorPicker'

export function CrearBloqueForm({
  onCreated,
  compact = false,
  accordion = false,
  defaultOpen = true,
}: {
  onCreated?: (id: string) => void
  compact?: boolean
  accordion?: boolean
  defaultOpen?: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('teal')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(accordion ? defaultOpen : true)

  async function submit() {
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
    setColor('teal')
    setError('')
    onCreated?.(created.id)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    e.stopPropagation()
    void submit()
  }

  const body = (
    <div onKeyDown={onKeyDown}>
      {accordion ? null : <h3 className="title-sm">Crear bloque</h3>}
      {compact || accordion ? null : (
        <p className="muted" style={{ marginTop: 0 }}>
          Un bloque agrupa fichas del mismo sector o sistema (p. ej. Edificio A, HVAC, Ascensores).
        </p>
      )}
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
      <ColorPicker id="bloque-nuevo-color" value={color} onChange={setColor} compact={compact} />
      {error ? <p className="danger-text">{error}</p> : null}
      <button className="btn btn-add" type="button" onClick={() => void submit()}>
        <Plus size={16} />
        Crear bloque
      </button>
    </div>
  )

  if (!accordion) {
    return <div className={`create-panel${compact ? ' compact-panel' : ''}`}>{body}</div>
  }

  return (
    <div className={`create-panel accordion-panel${compact ? ' compact-panel' : ''}${open ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span>Nuevo bloque</span>
        <ChevronDown size={18} className={open ? 'is-open' : ''} />
      </button>
      {open ? <div className="accordion-body">{body}</div> : null}
    </div>
  )
}
