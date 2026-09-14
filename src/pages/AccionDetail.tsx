import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarClock, CircleCheck, Pencil, Trash2, Wrench } from 'lucide-react'
import { db } from '../db'
import { prioridadOf, tipoAccionLabel, tipoAccionOf } from '../db/types'
import {
  accionDetalle,
  accionTitulo,
  convertirAccionHref,
  estadoAgendaCorrectiva,
} from '../lib/acciones'
import { formatDate } from '../lib/dates'
import { accionLabel, useAliases } from '../lib/labels'
import { AccionEditor, ProgramarFechaForm } from '../components/AccionesPanel'
import { ActividadTitle } from '../components/ActividadTitle'
import { EjecucionForm } from '../components/EjecucionForm'
import { FichaTitle } from '../components/FichaTitle'
import { PrioridadMark } from '../components/PrioridadMark'
import { AccionFechaLabel, StatusBadge } from '../components/ui'
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
  const [panel, setPanel] = useState<'none' | 'edit' | 'schedule'>('none')

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
  const detalleTxt = accionDetalle(current)
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
  const needsSchedule = !current.fechaObjetivo && tipo === 'correctiva'

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
        leading={
          tipo === 'correctiva' ? (
            <PrioridadMark prioridad={prioridadOf(current)} iconOnly />
          ) : undefined
        }
        title={<h2 className="title-sm">{accionTitulo(current)}</h2>}
        badge={<StatusBadge estado={estadoAgendaCorrectiva(current)} />}
        footer={
          <div className="row accion-card-actions">
            {needsSchedule ? (
              <button
                type="button"
                className="btn btn-primary btn-schedule"
                onClick={() => setPanel((was) => (was === 'schedule' ? 'none' : 'schedule'))}
              >
                <CalendarClock size={16} />
                {panel === 'schedule' ? 'Ocultar fecha' : 'Programar fecha'}
              </button>
            ) : canExecute ? (
              <button
                type="button"
                className="btn btn-primary btn-schedule"
                onClick={() => {
                  setPanel('none')
                  setEjecOpen((was) => !was)
                }}
              >
                {ejecucion ? <Pencil size={16} /> : <CircleCheck size={16} />}
                {ejecucion
                  ? ejecOpen
                    ? 'Ocultar ejecución'
                    : 'Editar ejecución'
                  : 'Marcar como ejecutada'}
              </button>
            ) : null}
            {tipo === 'correctiva' ? (
              <Link
                className="icon-btn"
                to={convertirAccionHref(current)}
                aria-label="Convertir en actividad"
                title="Convertir en actividad"
              >
                <Wrench size={16} />
              </Link>
            ) : null}
            <button
              type="button"
              className="icon-btn icon-btn-edit"
              aria-label={panel === 'edit' ? 'Ocultar edición' : 'Editar'}
              title={panel === 'edit' ? 'Ocultar edición' : 'Editar'}
              onClick={() => setPanel((was) => (was === 'edit' ? 'none' : 'edit'))}
            >
              <Pencil size={16} />
            </button>
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
        }
      >
        {detalleTxt ? <p className="accion-detalle">{detalleTxt}</p> : null}
        <p className="muted occ-meta">
          <span>{tipoAccionLabel(tipo, aliases)}</span>
          <AccionFechaLabel fechaObjetivo={current.fechaObjetivo} />
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
        {panel === 'edit' ? (
          <AccionEditor
            accion={current}
            onlyCorrectiva={tipo === 'correctiva'}
            onDone={() => setPanel('none')}
          />
        ) : null}
        {panel === 'schedule' ? (
          <ProgramarFechaForm accion={current} onDone={() => setPanel('none')} />
        ) : null}
        {panel === 'none' && canExecute ? (
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
        ) : null}
        {panel === 'none' && !canExecute && !needsSchedule ? (
          <p className="muted">
            Añade una fecha programada para poder ejecutar esta {accionLabel(tipo, aliases).toLowerCase()}.
          </p>
        ) : null}
      </EntityCard>
    </div>
  )
}
