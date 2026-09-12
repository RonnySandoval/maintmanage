import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, Trash2 } from 'lucide-react'
import { db } from '../db'
import { esExtraordinaria, esOcurrenciaProgramada } from '../db/types'
import { formatFechaProgramada, monthLabel } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { blobToFile } from '../lib/share'
import { deleteOcurrencia } from '../db/occurrences'
import { ShareMenu } from '../components/ShareMenu'
import { ExtraBadge, StatusBadge } from '../components/ui'
import { FichaTitle } from '../components/FichaTitle'
import { AccionesPanel } from '../components/AccionesPanel'
import { EjecucionForm } from '../components/EjecucionForm'

export function OcurrenciaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const occ = useLiveQuery(async () => {
    if (!id) return null
    return (await db.ocurrencias.get(id)) ?? null
  }, [id])
  const ficha = useLiveQuery(async () => {
    if (!occ?.fichaId) return null
    return (await db.fichas.get(occ.fichaId)) ?? null
  }, [occ?.fichaId])
  const bloque = useLiveQuery(
    () => (ficha?.grupoId ? db.grupos.get(ficha.grupoId) : undefined),
    [ficha?.grupoId],
  )
  const encargado = useLiveQuery(
    () => (ficha?.encargadoId ? db.encargados.get(ficha.encargadoId) : undefined),
    [ficha?.encargadoId],
  )
  const ejecucion = useLiveQuery(
    () => (id ? db.ejecuciones.where('ocurrenciaId').equals(id).first() : undefined),
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
        occ?.fichaId
          ? db.adjuntos.where('fichaId').equals(occ.fichaId).filter((a) => a.tipo === 'ficha').toArray()
          : [],
      [occ?.fichaId],
    ) ?? []

  const [removing, setRemoving] = useState(false)
  const [ejecOpen, setEjecOpen] = useState(false)

  if (!id) return null
  if (occ === undefined) return <p className="muted">Cargando…</p>
  if (occ === null) {
    return (
      <div className="card">
        Ocurrencia no encontrada. <Link to="/cronograma">Volver</Link>
      </div>
    )
  }
  if (ficha === undefined) return <p className="muted">Cargando…</p>
  if (!ficha) {
    return (
      <div className="card">
        Ocurrencia no encontrada. <Link to="/cronograma">Volver</Link>
      </div>
    )
  }

  const ocurrencia = occ
  const currentFicha = ficha

  const shareText = [
    `Ficha: ${fichaTitulo(currentFicha)}`,
    `Programada: ${ocurrencia.fechaProgramada}`,
    esExtraordinaria(ocurrencia) ? 'Origen: Extraordinaria' : '',
    `Estado: ${ocurrencia.estado}`,
    bloque ? `Bloque: ${bloque.nombre}` : '',
    encargado ? `Encargado: ${encargado.nombre}` : '',
    ejecucion?.realizadoPor ? `Realizado por: ${ejecucion.realizadoPor}` : '',
    ejecucion?.observaciones ? `Observaciones: ${ejecucion.observaciones}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const shareFiles = [...plantilla, ...evidencia].map((a) =>
    blobToFile(a.blob, a.nombre, a.mimeType),
  )

  async function removeOcc() {
    const extra = esOcurrenciaProgramada(ocurrencia)
      ? ' Si era programada, no volverá a aparecer en el cronograma.'
      : ''
    if (!confirm(`¿Eliminar esta inspección? No se borra la ficha.${extra}`)) return
    setRemoving(true)
    try {
      const fichaId = await deleteOcurrencia(ocurrencia.id)
      navigate(fichaId ? `/fichas/${fichaId}` : '/cronograma', { replace: true })
    } finally {
      setRemoving(false)
    }
  }

  const periodo = monthLabel(ocurrencia.fechaProgramada)

  return (
    <div className="stack">
      <div className="card occ-head-card">
        <div className="row-spread" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>
              <Link to={`/fichas/${currentFicha.id}`}>
                <FichaTitle ficha={currentFicha} color={bloque?.color} />
              </Link>
            </h2>
            <p className="occ-period">{periodo}</p>
            <p className="muted occ-meta" style={{ marginBottom: 0 }}>
              {formatFechaProgramada(
                ocurrencia.fechaProgramada,
                currentFicha.fechaPrecision === 'dia' ? 'dia' : 'mes',
              )}
              {bloque?.nombre ? ` · ${bloque.nombre}` : ''}
              {encargado?.nombre ? ` · ${encargado.nombre}` : ''}
              {esExtraordinaria(ocurrencia) ? <ExtraBadge /> : null}
              {ocurrencia.estadoFijado ? <span>Fijado</span> : null}
            </p>
          </div>
          <StatusBadge estado={ocurrencia.estado} />
        </div>
        <ShareMenu title={fichaTitulo(currentFicha)} text={shareText} files={shareFiles} />
        <div className="card-delete-corner">
          <button
            type="button"
            className="icon-btn icon-btn-delete discreet"
            aria-label={removing ? 'Eliminando…' : 'Eliminar inspección'}
            title="Eliminar inspección"
            onClick={() => void removeOcc()}
            disabled={removing}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className={`card accordion-panel${ejecOpen ? '' : ' is-collapsed'}`}>
        <button
          type="button"
          className="accordion-trigger"
          aria-expanded={ejecOpen}
          onClick={() => setEjecOpen((was) => !was)}
        >
          <span>
            {ejecucion ? 'Editar ejecución' : 'Marcar como ejecutada'}
            {ejecucion && !ejecOpen ? (
              <span className="muted" style={{ fontWeight: 500 }}>
                {' · '}
                {ejecucion.fechaReal}
                {ejecucion.realizadoPor ? ` · ${ejecucion.realizadoPor}` : ''}
              </span>
            ) : null}
          </span>
          <ChevronDown size={18} className={ejecOpen ? 'is-open' : ''} />
        </button>
        {ejecOpen ? (
          <div className="accordion-body">
            <EjecucionForm
              ocurrenciaId={ocurrencia.id}
              fichaId={currentFicha.id}
              onSaved={() => setEjecOpen(false)}
            />
          </div>
        ) : null}
      </div>

      <AccionesPanel fichaId={currentFicha.id} ocurrenciaId={ocurrencia.id} onlyCorrectiva />
    </div>
  )
}
