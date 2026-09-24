import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import { esExtraordinaria, esOcurrenciaProgramada, tipoActividadLabel } from '../db/types'
import { formatFechaProgramada, monthLabel } from '../lib/dates'
import { actividadTitulo } from '../lib/actividades'
import { blobToFile } from '../lib/share'
import { deleteEvento } from '../db/activities'
import { ShareMenu } from '../components/ShareMenu'
import { AccionesPanel } from '../components/AccionesPanel'
import { NotasVinculadas } from '../components/NotasVinculadas'
import { ExtraBadge, StatusBadge, TipoBadge } from '../components/ui'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { ActividadTitle } from '../components/ActividadTitle'
import { EjecucionForm } from '../components/EjecucionForm'
import { EntityCard } from '../components/EntityCard'

export function EventoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const evento = useLiveQuery(async () => {
    if (!id) return null
    return (await db.eventos.get(id)) ?? null
  }, [id])
  const actividad = useLiveQuery(async () => {
    if (!evento?.actividadId) return null
    return (await db.actividades.get(evento.actividadId)) ?? null
  }, [evento?.actividadId])
  const encargado = useLiveQuery(
    () => (actividad?.encargadoId ? db.encargados.get(actividad.encargadoId) : undefined),
    [actividad?.encargadoId],
  )
  const ejecucion = useLiveQuery(
    () => (id ? db.ejecuciones.where('eventoId').equals(id).first() : undefined),
    [id],
  )
  const evidencia =
    useLiveQuery(
      () => (ejecucion?.id ? db.adjuntos.where('ejecucionId').equals(ejecucion.id).toArray() : []),
      [ejecucion?.id],
    ) ?? []
  const plantilla =
    useLiveQuery(
      () =>
        evento?.actividadId
          ? db.adjuntos
              .where('actividadId')
              .equals(evento.actividadId)
              .filter((a) => a.tipo === 'actividad')
              .toArray()
          : [],
      [evento?.actividadId],
    ) ?? []

  const [params] = useSearchParams()
  const tipos = useTiposActividad()
  const [removing, setRemoving] = useState(false)
  const [ejecOpen, setEjecOpen] = useState(() => params.get('ejecutar') === '1')

  if (!id) return null
  if (evento === undefined) return <p className="muted">Cargando…</p>
  if (evento === null) {
    return (
      <div className="card">
        Evento no encontrado. <Link to="/cronograma">Volver</Link>
      </div>
    )
  }
  if (actividad === undefined) return <p className="muted">Cargando…</p>
  if (!actividad) {
    return (
      <div className="card">
        Evento no encontrado. <Link to="/cronograma">Volver</Link>
      </div>
    )
  }

  const current = evento
  const currentActividad = actividad

  const shareText = [
    `Actividad: ${actividadTitulo(currentActividad)}`,
    `Tipo: ${tipoActividadLabel(currentActividad.tipo, tipos)}`,
    `Programada: ${current.fechaProgramada}`,
    esExtraordinaria(current) ? 'Origen: Extraordinaria' : '',
    `Estado: ${current.estado}`,
    encargado ? `Encargado: ${encargado.nombre}` : '',
    ejecucion?.realizadoPor ? `Realizado por: ${ejecucion.realizadoPor}` : '',
    ejecucion?.observaciones ? `Observaciones: ${ejecucion.observaciones}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const shareFiles = [...plantilla, ...evidencia].map((a) =>
    blobToFile(a.blob, a.nombre, a.mimeType),
  )

  async function removeEvt() {
    const extra = esOcurrenciaProgramada(current)
      ? ' Si era programado, no volverá a aparecer en el cronograma.'
      : ''
    if (!confirm(`¿Eliminar este evento? No se borra la actividad.${extra}`)) return
    setRemoving(true)
    try {
      const actividadId = await deleteEvento(current.id)
      navigate(actividadId ? `/actividades/${actividadId}` : '/cronograma', { replace: true })
    } finally {
      setRemoving(false)
    }
  }

  const periodo = monthLabel(current.fechaProgramada)

  return (
    <div className="stack">
      <EntityCard
        className="occ-head-card"
        title={
          <h2>
            <Link to={`/actividades/${currentActividad.id}`}>
              <ActividadTitle actividad={currentActividad} />
            </Link>
          </h2>
        }
        badge={<StatusBadge estado={current.estado} />}
        footer={
          <>
            <div className="row card-toolbar-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEjecOpen((was) => !was)}
              >
                {ejecucion ? <Pencil size={16} /> : <CircleCheck size={16} />}
                {ejecOpen
                  ? 'Ocultar'
                  : ejecucion
                    ? 'Editar ejecución'
                    : 'Registrar ejecución'}
              </button>
              <ShareMenu title={actividadTitulo(currentActividad)} text={shareText} files={shareFiles} />
            </div>
            <button
              type="button"
              className="icon-btn icon-btn-delete"
              aria-label={removing ? 'Eliminando…' : 'Eliminar evento'}
              title="Eliminar evento"
              onClick={() => void removeEvt()}
              disabled={removing}
            >
              <Trash2 size={16} />
            </button>
          </>
        }
      >
        <p className="occ-period">{periodo}</p>
        <p className="muted occ-meta">
          {formatFechaProgramada(
            current.fechaProgramada,
            currentActividad.fechaPrecision === 'dia' ? 'dia' : 'mes',
          )}
          {' · '}
          <TipoBadge tipo={currentActividad.tipo} />
          {encargado?.nombre ? ` · ${encargado.nombre}` : ''}
          {esExtraordinaria(current) ? <ExtraBadge /> : null}
          {current.estadoFijado ? <span>Fijado</span> : null}
        </p>
        {ejecOpen ? (
          <EjecucionForm
            eventoId={current.id}
            actividadId={currentActividad.id}
            onSaved={() => setEjecOpen(false)}
          />
        ) : ejecucion ? (
          <p className="muted">
            Realizada el {ejecucion.fechaReal}
            {ejecucion.realizadoPor ? ` · ${ejecucion.realizadoPor}` : ''}
          </p>
        ) : null}
      </EntityCard>

      <AccionesPanel
        actividadId={currentActividad.id}
        eventoId={current.id}
      />

      <NotasVinculadas actividadId={currentActividad.id} eventoId={current.id} />
    </div>
  )
}
