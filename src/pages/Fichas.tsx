import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Layers, Plus } from 'lucide-react'
import { db } from '../db'
import { frecuenciaLabel } from '../db/types'
import { fichaTitulo } from '../lib/fichas'
import { EmptyState } from '../components/ui'

export function FichasPage() {
  const [bloqueId, setBloqueId] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [q, setQ] = useState('')

  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []

  const bloqueMap = useMemo(
    () => Object.fromEntries(bloques.map((b) => [b.id, b])),
    [bloques],
  )
  const encargadoMap = useMemo(
    () => Object.fromEntries(encargados.map((e) => [e.id, e])),
    [encargados],
  )

  const filtered = fichas
    .filter((f) => {
      if (bloqueId && f.grupoId !== bloqueId) return false
      if (encargadoId && f.encargadoId !== encargadoId) return false
      if (q) {
        const hay = `${f.numero} ${f.nombre}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) return false
      }
      return true
    })
    .sort((a, b) => {
      const na = Number.parseInt(a.numero, 10)
      const nb = Number.parseInt(b.numero, 10)
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
      return fichaTitulo(a).localeCompare(fichaTitulo(b), 'es')
    })

  return (
    <div>
      <div className="page-head">
        <p className="muted" style={{ margin: 0 }}>
          {fichas.length} ficha{fichas.length === 1 ? '' : 's'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link className="btn" to="/bloques">
            <Layers size={16} />
            Bloques
          </Link>
          <Link className="btn btn-primary" to="/fichas/nueva">
            <Plus size={16} />
            Nueva
          </Link>
        </div>
      </div>

      <div className="filters">
        <input
          className="input"
          placeholder="Buscar"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="select" value={bloqueId} onChange={(e) => setBloqueId(e.target.value)}>
          <option value="">Bloque</option>
          {bloques.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
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
          text="Crea un bloque y luego las fichas (número, nombre, foto/PDF/Word y frecuencia)."
          action={
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link className="btn" to="/bloques">
                Crear bloque
              </Link>
              <Link className="btn btn-primary" to="/fichas/nueva">
                Crear ficha
              </Link>
            </div>
          }
        />
      ) : (
        <div className="list">
          {filtered.map((f) => {
            const bloque = bloqueMap[f.grupoId]
            const encargado = f.encargadoId ? encargadoMap[f.encargadoId] : undefined
            return (
              <Link key={f.id} className="card card-click item" to={`/fichas/${f.id}`}>
                <span className="bar" style={{ background: bloque?.color ?? 'var(--accent)' }} />
                <div className="grow">
                  <strong>
                    {f.numero ? <span className="ficha-num">N.º {f.numero}</span> : null}
                    {f.nombre}
                  </strong>
                  <div className="muted">
                    {bloque?.nombre ?? 'Sin bloque'}
                    {encargado ? ` · ${encargado.nombre}` : ''}
                    {` · ${frecuenciaLabel(f.frecuencia)}`}
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
