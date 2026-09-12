import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, CircleCheck, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import { prioridadOf, tipoAccionLabel, tipoAccionOf } from '../db/types'
import { estadoAgendaCorrectiva } from '../lib/acciones'
import { actividadTitulo } from '../lib/actividades'
import { formatDate, formatFechaProgramada } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { accionLabel, useAliases } from '../lib/labels'
import { ActividadTitle } from '../components/ActividadTitle'
import { EjecucionForm } from '../components/EjecucionForm'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { StatusBadge } from '../components/ui'

export function AccionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const aliases = useAliases()
  const accion = useLiveQuery(async () => {
    if (!id) return null
    return (await db.accionesCorrectivas.get(id)) ?? null
  }, [id])
  const ficha = useLiveQuery(async () => {
    if (!accion?.fichaId) return null
    return (await db.fichas.get(accion.fichaId)) ?? null
  }, [accion?.fichaId])
  const actividad = useLiveQuery(async () => {
    if (!accion?.actividadId) return null
    return (await db.actividades.get(accion.actividadId)) ?? null
  }, [accion?.actividadId])
  const bloque = useLiveQuery(
    () => (ficha?.grupoId ? db.grupos.get(ficha.grupoId) : undefined),
    [ficha?.grupoId],
  )
  const ejecucion = useLiveQuery(
    () => (id ? db.ejecuciones.where('accionId').equals(id).first() : undefined),
    [id],
  )
  const [ejecOpen, setEjecOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  if (!id) return null
  if (accion === undefined) return <p className="muted">Cargando…</p>
  if (accion === null) {
    return (
      <div className="card">
        Acción no encontrada. <Link to="/historicos">Volver</Link>
      </div>
    )
  }

  const current = accion
  const tipo = tipoAccionOf(current)
  const origenHref = current.ocurrenciaId
    ? `/ocurrencias/${current.ocurrenciaId}`
    : current.eventoId
      ? `/eventos/${current.eventoId}`
      : current.actividadId
        ? `/actividades/${current.actividadId}`
        : current.fichaId
          ? `/fichas/${current.fichaId}`
          : '/historicos'
  const canExecute = Boolean(current.fechaObjetivo)

  async function removeAccion() {
    if (!confirm('¿Eliminar esta acción? No se modifica la inspección ni la actividad de origen.')) return
    setRemoving(true)
    try {
      const ejec = await db.ejecuciones.where('accionId').equals(current.id).first()
      if (ejec) {
        await db.adjuntos.where('ejecucionId').equals(ejec.id).delete()
        await db.ejecuciones.delete(ejec.id)
      }
      await db.accionesCorrectivas.delete(current.id)
      navigate(origenHref, { replace: true })
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div>
      <div className="card">
        <div className="row-spread" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h2 className="title-sm" style={{ margin: 0 }}>
              {current.texto}
            </h2>
            <p className="muted occ-meta" style={{ margin: '0.35rem 0 0' }}>
              <span>{tipoAccionLabel(tipo, aliases)}</span>
              {tipo === 'correctiva' ? <PrioridadMark prioridad={prioridadOf(current)} /> : null}
              {current.fechaObjetivo ? (
                <span>Programada: {formatFechaProgramada(current.fechaObjetivo, 'dia')}</span>
              ) : (
                <span>Sin fecha programada</span>
              )}
            </p>
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>
              Origen:{' '}
              <Link to={origenHref}>
                {actividad ? (
                  <ActividadTitle actividad={actividad} />
                ) : ficha ? (
                  <FichaTitle ficha={ficha} color={bloque?.color} />
                ) : (
                  'Ver origen'
                )}
              </Link>
              <span> · Estado propio, independiente del origen</span>
            </p>
          </div>
          <StatusBadge estado={estadoAgendaCorrectiva(current)} />
        </div>
        <div className="card-toolbar">
          <button
            type="button"
            className="icon-btn icon-btn-delete"
            aria-label={removing ? 'Eliminando…' : 'Eliminar acción'}
            title="Eliminar acción"
            onClick={() => void removeAccion()}
            disabled={removing}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {canExecute ? (
        <div className={`card accordion-panel${ejecOpen ? '' : ' is-collapsed'}`}>
          <button
            type="button"
            className="accordion-trigger"
            aria-expanded={ejecOpen}
            onClick={() => setEjecOpen((was) => !was)}
          >
            <span className="accordion-label">
              {ejecucion ? <Pencil size={16} /> : <CircleCheck size={16} />}
              <span>
                {ejecucion ? 'Editar ejecución' : 'Marcar como ejecutada'}
                {ejecucion && !ejecOpen ? (
                  <span className="muted" style={{ fontWeight: 500 }}>
                    {' · '}
                    {formatDate(ejecucion.fechaReal)}
                    {ejecucion.realizadoPor ? ` · ${ejecucion.realizadoPor}` : ''}
                  </span>
                ) : null}
              </span>
            </span>
            <ChevronDown size={18} className={ejecOpen ? 'is-open' : ''} />
          </button>
          {ejecOpen ? (
            <div className="accordion-body">
              <EjecucionForm
                accionId={current.id}
                fichaId={current.fichaId}
                actividadId={current.actividadId}
                onSaved={() => setEjecOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Añade una fecha programada para poder ejecutar esta {accionLabel(tipo, aliases).toLowerCase()}.
          </p>
        </div>
      )}
    </div>
  )
}
