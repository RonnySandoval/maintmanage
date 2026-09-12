import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { addTipoActividad } from '../lib/tiposActividad'

export function TipoActividadField({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (tipo: string) => void
}) {
  const tipos = useTiposActividad()
  const [adding, setAdding] = useState(false)
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    setError('')
    setSaving(true)
    try {
      const created = await addTipoActividad(nombre)
      onChange(created.id)
      setNombre('')
      setAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el tipo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="combo-row">
        <select
          id={id}
          className="select"
          value={tipos.some((t) => t.id === value) ? value : value || 'otro'}
          onChange={(e) => onChange(e.target.value)}
        >
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`btn btn-icon btn-add${adding ? ' is-open' : ''}`}
          aria-label={adding ? 'Cerrar crear tipo' : 'Añadir tipo'}
          title="Añadir tipo"
          onClick={() => {
            setAdding((open) => !open)
            setError('')
          }}
        >
          {adding ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>
      {adding ? (
        <div className="create-panel compact-panel" style={{ marginTop: '0.55rem' }}>
          <div className="field" style={{ marginBottom: '0.45rem' }}>
            <label htmlFor={`${id}-nuevo`}>Nuevo tipo</label>
            <input
              id={`${id}-nuevo`}
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Pintura, jardinería…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
            />
          </div>
          {error ? <p className="danger-text">{error}</p> : null}
          <button
            className="btn btn-add"
            type="button"
            disabled={saving}
            onClick={() => void submit()}
          >
            <Plus size={16} />
            {saving ? 'Guardando…' : 'Añadir tipo'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
