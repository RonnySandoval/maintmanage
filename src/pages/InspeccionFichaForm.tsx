import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { addInspeccionExtraordinaria } from '../db/occurrences'
import { todayISO } from '../lib/dates'
import { compareFichasByNumero, fichaTitulo } from '../lib/fichas'
import { goBackOrFallback } from '../lib/nav'
import { EmptyState } from '../components/ui'
import { ClipboardList } from 'lucide-react'

export function InspeccionFichaFormPage() {
  const navigate = useNavigate()
  const fichas = useLiveQuery(() => db.fichas.toArray())
  const ordenadas = (fichas ?? []).slice().sort(compareFichasByNumero)

  const [fichaId, setFichaId] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const ficha = ordenadas.find((f) => f.id === fichaId)
    if (!ficha) {
      setError('Elige una ficha.')
      return
    }
    setSaving(true)
    try {
      const result = await addInspeccionExtraordinaria(ficha, fecha)
      if (!result.ok) {
        setError(result.error)
        return
      }
      navigate(`/ocurrencias/${result.id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  if (fichas === undefined) return <p className="muted">Cargando…</p>

  if (ordenadas.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={36} />}
        title="No hay fichas"
        text="Una inspección de ficha necesita una plantilla. Crea la ficha o programa una inspección sin ficha."
        action={
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="btn btn-add" to="/fichas/nueva">
              Nueva ficha
            </Link>
            <Link className="btn" to="/actividades/nueva?tipo=inspeccion">
              Sin ficha
            </Link>
          </div>
        }
      />
    )
  }

  return (
    <form className="card ficha-form" onSubmit={(e) => void onSubmit(e)}>
      <p className="muted" style={{ marginTop: 0 }}>
        Extraordinaria de una ficha, fuera del periodo. No la regenera la frecuencia.
      </p>
      <div className="ficha-form-grid">
        <div className="field">
          <label htmlFor="insp-ficha">Ficha</label>
          <select
            id="insp-ficha"
            className="select"
            value={fichaId}
            onChange={(e) => setFichaId(e.target.value)}
            required
          >
            <option value="">Elige una ficha</option>
            {ordenadas.map((f) => (
              <option key={f.id} value={f.id}>
                {fichaTitulo(f)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="insp-fecha">Fecha</label>
          <input
            id="insp-fecha"
            className="input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
      </div>
      {error ? <p className="danger-text">{error}</p> : null}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Programar'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => goBackOrFallback(navigate, '/cronograma')}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
