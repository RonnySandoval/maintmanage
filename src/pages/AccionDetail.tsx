import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import { prioridadOf, tipoAccionLabel, tipoAccionOf } from '../db/types'
import { estadoAgendaCorrectiva } from '../lib/acciones'
import { formatDate, formatFechaProgramada } from '../lib/dates'
import { accionLabel, useAliases } from '../lib/labels'
import { ActividadTitle } from '../components/ActividadTitle'
import { EjecucionForm } from '../components/EjecucionForm'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { StatusBadge } from '../components/ui'
import { EntityCard } from '../components/EntityCard'

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
    <div className="stack">
      <EntityCard
        title={<h2 className="title-sm">{current.texto}</h2>}
        badge={<StatusBadge estado={estadoAgendaCorrectiva(current)} />}
        footer={
          <>
            <div className="row card-toolbar-actions">
              {canExecute ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setEjecOpen((was) => !was)}
                >
                  {ejecucion ? <Pencil size={16} /> : <CircleCheck size={16} />}
                  {ejecucion
                    ? ejecOpen
                      ? 'Ocultar ejecución'
                      : 'Editar ejecución'
                    : 'Marcar como ejecutada'}
                </button>
              ) : null}
            </div>
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
          </>
        }
      >
        <p className="muted occ-meta">
          <span>{tipoAccionLabel(tipo, aliases)}</span>
          {tipo === 'correctiva' ? <PrioridadMark prioridad={prioridadOf(current)} /> : null}
          {current.fechaObjetivo ? (
            <span>Programada: {formatFechaProgramada(current.fechaObjetivo, 'dia')}</span>
          ) : (
            <span>Sin fecha programada</span>
          )}
        </p>
        <p className="muted">
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
        {canExecute ? (
          ejecOpen ? (
            <EjecucionForm
              accionId={current.id}
              fichaId={current.fichaId}
              actividadId={current.actividadId}
              onSaved={() => setEjecOpen(false)}
            />
          ) : ejecucion ? (
            <p className="muted">
              Realizada el {formatDate(ejecucion.fechaReal)}
              {ejecucion.realizadoPor ? ` · ${ejecucion.realizadoPor}` : ''}
            </p>
          ) : null
        ) : (
          <p className="muted">
            Añade una fecha programada para poder ejecutar esta {accionLabel(tipo, aliases).toLowerCase()}.
          </p>
        )}
      </EntityCard>
    </div>
  )
}
