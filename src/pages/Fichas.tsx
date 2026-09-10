import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Plus } from 'lucide-react'
import { db } from '../db'
import { FRECUENCIAS } from '../db/types'
import { EmptyState } from '../components/ui'

const freqLabel = Object.fromEntries(FRECUENCIAS.map((f) => [f.id, f.label]))

export function FichasPage() {
  const [grupoId, setGrupoId] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [q, setQ] = useState('')

  const fichas = useLiveQuery(() => db.fichas.orderBy('nombre').toArray()) ?? []
  const grupos = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []

  const grupoMap = useMemo(
    () => Object.fromEntries(grupos.map((g) => [g.id, g])),
    [grupos],
  )
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )

  const filtered = fichas.filter((f) => {
    if (grupoId && f.grupoId !== grupoId) return false
    if (encargadoId && f.encargadoId !== encargadoId) return false
    if (q && !f.nombre.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="page-head">
        <p className="muted" style={{ margin: 0 }}>
          {fichas.length} ficha{fichas.length === 1 ? '' : 's'}
        </p>
        <Link className="btn btn-primary" to="/fichas/nueva">
          <Plus size={16} />
          Nueva
        </Link>
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
          <option value="">Grupo</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={encargadoId}
          onChange={(e) => setEncargadoId(e.target.value)}
        >
          <option value="">Encargado</option>
          {encargados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>

      {fichas.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={36} />}
          title="Sin fichas"
          text="Una ficha es la tarjeta de un equipo o procedimiento (foto, PDF o Word) con su frecuencia."
          action={
            <Link className="btn btn-primary" to="/fichas/nueva">
              Crear ficha
            </Link>
          }
        />
      ) : (
        <div className="list">
          {filtered.map((f) => {
            const grupo = grupoMap[f.grupoId]
            const encargado = encargadoMap[f.encargadoId]
            return (
              <Link key={f.id} className="card card-click item" to={`/fichas/${f.id}`}>
                <span className="bar" style={{ background: grupo?.color ?? 'var(--accent)' }} />
                <div className="grow">
                  <strong>{f.nombre}</strong>
                  <div className="muted">
                    {grupo?.nombre ?? 'Sin grupo'} · {encargado?.nombre ?? 'Sin encargado'} ·{' '}
                    {freqLabel[f.frecuencia]}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
