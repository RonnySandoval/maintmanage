import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen, Pin } from 'lucide-react'
import { db } from '../db'
import { formatDate } from '../lib/dates'
import { compararNotas, fechaDeNota } from '../lib/notas'

/** Resumen de notas en Inicio, con acceso a la sección completa. */
export function NotasWidget() {
  const notas = useLiveQuery(() => db.notas.orderBy('updatedAt').reverse().toArray()) ?? []
  const activas = notas.filter((n) => !n.archivada)
  const items = activas.slice().sort(compararNotas).slice(0, 4)

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <div className="page-head">
        <h2 className="title-sm">
          <NotebookPen size={16} aria-hidden style={{ verticalAlign: '-2px' }} /> Notas
        </h2>
        <div className="row" style={{ gap: '0.9rem' }}>
          <Link to="/notas?nueva=1">Nueva</Link>
          <Link to="/notas">Ver todas</Link>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="card muted">
          Sin notas. Guarda avisos, compras o pendientes con etiquetas.
        </div>
      ) : (
        <div className="list">
          {items.map((nota) => (
            <Link key={nota.id} className="card card-click dash-item" to={`/notas?ver=${nota.id}`}>
              <div className="row-spread" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="occ-meta" style={{ alignItems: 'flex-start' }}>
                  {nota.fijada ? <Pin size={15} aria-label="Fijada" /> : null}
                  <strong>{nota.titulo}</strong>
                </span>
                <span className="muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                  {formatDate(fechaDeNota(nota))}
                </span>
              </div>
              {nota.cuerpo ? (
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  {nota.cuerpo.length > 90 ? `${nota.cuerpo.slice(0, 90)}…` : nota.cuerpo}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
