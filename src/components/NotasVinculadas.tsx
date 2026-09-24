import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen, Pin } from 'lucide-react'
import { db } from '../db'
import { compararNotas, fechaDeNota } from '../lib/notas'
import { formatDate } from '../lib/dates'
import { EntityCard } from './EntityCard'

/** Notas atadas a una ficha/inspección o a una actividad/evento. */
export function NotasVinculadas({
  fichaId,
  ocurrenciaId,
  actividadId,
  eventoId,
}: {
  fichaId?: string
  ocurrenciaId?: string
  actividadId?: string
  eventoId?: string
}) {
  const notas =
    useLiveQuery(async () => {
      let rows = await db.notas.toArray()
      if (ocurrenciaId) rows = rows.filter((n) => n.ocurrenciaId === ocurrenciaId)
      else if (eventoId) rows = rows.filter((n) => n.eventoId === eventoId)
      else if (fichaId) rows = rows.filter((n) => n.fichaId === fichaId && !n.ocurrenciaId)
      else if (actividadId) rows = rows.filter((n) => n.actividadId === actividadId && !n.eventoId)
      else return []
      return rows.filter((n) => !n.archivada).sort(compararNotas)
    }, [fichaId, ocurrenciaId, actividadId, eventoId]) ?? []

  if (!notas.length) return null

  const params = new URLSearchParams({ nueva: '1' })
  if (fichaId) params.set('ficha', fichaId)
  if (ocurrenciaId) params.set('ocurrencia', ocurrenciaId)
  if (actividadId) params.set('actividad', actividadId)
  if (eventoId) params.set('evento', eventoId)

  return (
    <EntityCard
      title={
        <h3 className="title-sm" style={{ margin: 0 }}>
          <NotebookPen size={16} aria-hidden /> Notas vinculadas · {notas.length}
        </h3>
      }
    >
      <div className="stack" style={{ gap: '0.4rem' }}>
        {notas.map((nota) => (
          <Link
            key={nota.id}
            to={`/notas?editar=${nota.id}`}
            className="row"
            style={{ gap: '0.45rem', alignItems: 'flex-start' }}
          >
            {nota.fijada ? <Pin size={14} aria-label="Fijada" /> : null}
            <span>
              <strong>{nota.titulo}</strong>{' '}
              <span className="muted" style={{ fontSize: '0.78rem' }}>
                {formatDate(fechaDeNota(nota))}
              </span>
              {nota.cuerpo ? (
                <span className="muted">
                  {' — '}
                  {nota.cuerpo.length > 80 ? `${nota.cuerpo.slice(0, 80)}…` : nota.cuerpo}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <Link className="btn btn-add" to={`/notas?${params.toString()}`}>
          Nueva vinculada
        </Link>
      </div>
    </EntityCard>
  )
}
