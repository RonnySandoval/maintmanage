import { useState, type KeyboardEvent } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { db } from '../db'
import { createId } from '../lib/ids'

export function CrearEncargadoForm({
  onCreated,
  accordion = false,
  defaultOpen = true,
}: {
  onCreated?: (id: string) => void
  accordion?: boolean
  defaultOpen?: boolean
}) {
  const [nombre, setNombre] = useState('')
  const [telefonos, setTelefonos] = useState('')
  const [congregacion, setCongregacion] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(accordion ? defaultOpen : true)

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

  const body = (
    <div onKeyDown={onKeyDown}>
      {accordion ? null : <h3 className="title-sm">Crear encargado</h3>}
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

  if (!accordion) {
    return <div className="create-panel compact-panel">{body}</div>
  }

  return (
    <div className={`create-panel compact-panel accordion-panel${open ? '' : ' is-collapsed'}`}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span>Nuevo encargado</span>
        <ChevronDown size={18} className={open ? 'is-open' : ''} />
      </button>
      {open ? <div className="accordion-body">{body}</div> : null}
    </div>
  )
}
