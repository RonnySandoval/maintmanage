import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CalendarRange, CircleCheck, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS,
  esExtraordinaria,
  frecuenciaLabel,
  tipoActividadLabel,
  type EstadoOcurrencia,
} from '../db/types'
import { formatFechaProgramada, todayISO } from '../lib/dates'
import { actividadTitulo, eventoVigente } from '../lib/actividades'
import { saveAdjuntos } from '../lib/files'
import { blobToFile } from '../lib/share'
import {
  addEventoExtraordinario,
  aplicarEventosDesdeFecha,
  deleteActividadCascade,
  eventosDesdeFecha,
} from '../db/activities'
import { AttachmentList, removeAdjunto } from '../components/AttachmentList'
import { FilePicker } from '../components/FilePicker'
import { ShareMenu } from '../components/ShareMenu'
import { AccionesPanel } from '../components/AccionesPanel'
import { ExtraBadge, Modal, StatusBadge, TipoBadge } from '../components/ui'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { ActividadTitle } from '../components/ActividadTitle'
import { CopyText } from '../components/CopyText'
import { EntityCard } from '../components/EntityCard'

export function ActividadDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const actividad = useLiveQuery(async () => {
    if (!id) return null
    return (await db.actividades.get(id)) ?? null
  }, [id])
  const encargado = useLiveQuery(
    () => (actividad?.encargadoId ? db.encargados.get(actividad.encargadoId) : undefined),
    [actividad?.encargadoId],
  )
  const eventos =
    useLiveQuery(
      () => (id ? db.eventos.where('actividadId').equals(id).sortBy('fechaProgramada') : []),
      [id],
    ) ?? []
  const adjuntos =
    useLiveQuery(
      () => (id ? db.adjuntos.where('actividadId').equals(id).toArray() : []),
      [id],
    ) ?? []
  const tipos = useTiposActividad()

  const [modal, setModal] = useState<'extra' | 'desde' | null>(null)
  const [extraFecha, setExtraFecha] = useState(todayISO())
  const [extraError, setExtraError] = useState('')
  const [extraSaving, setExtraSaving] = useState(false)
  const [desdeFecha, setDesdeFecha] = useState(todayISO())
  const [desdeModo, setDesdeModo] = useState<'fijar' | 'eliminar'>('fijar')
  const [desdeEstado, setDesdeEstado] = useState<EstadoOcurrencia>('pendiente')
  const [desdeError, setDesdeError] = useState('')
  const [desdeSaving, setDesdeSaving] = useState(false)

  if (!id) return null
  if (actividad === undefined) return <p className="muted">Cargando…</p>
  if (actividad === null) {
    return (
      <div className="card">
        Actividad no encontrada. <Link to="/fichas?tab=actividades">Volver</Link>
      </div>
    )
  }

  const current = actividad
  const eventoActual = eventoVigente(eventos)
  const plantilla = adjuntos.filter((a) => a.tipo === 'actividad')
  const telefonoEncargado = encargado?.telefonos || encargado?.contacto || ''
  const precision = actividad.fechaPrecision === 'dia' ? 'dia' : 'mes'
  const afectadas = eventosDesdeFecha(eventos, desdeFecha, precision)
  const shareText = [
    `Actividad: ${actividadTitulo(current)}`,
    `Tipo: ${tipoActividadLabel(current.tipo, tipos)}`,
    encargado ? `Encargado: ${encargado.nombre}` : '',
    telefonoEncargado ? `Teléfono(s): ${telefonoEncargado}` : '',
    encargado?.congregacion ? `Congregación: ${encargado.congregacion}` : '',
    `Periodo: ${frecuenciaLabel(actividad.frecuencia)}`,
    actividad.notas ? `Notas: ${actividad.notas}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const shareFiles = plantilla.map((a) => blobToFile(a.blob, a.nombre, a.mimeType))

  async function remove() {
    if (
      !confirm(
        '¿Eliminar esta actividad y su cronograma? Las ejecuciones también se borrarán en este dispositivo.',
      )
    ) {
      return
    }
    await deleteActividadCascade(current.id)
    navigate('/fichas?tab=actividades', { replace: true })
  }

  function openExtra() {
    setExtraFecha(todayISO())
    setExtraError('')
    setModal('extra')
  }

  function openDesde() {
    setDesdeFecha(todayISO())
    setDesdeModo('fijar')
    setDesdeEstado('pendiente')
    setDesdeError('')
    setModal('desde')
  }

  async function submitExtra(e: FormEvent) {
    e.preventDefault()
    setExtraError('')
    setExtraSaving(true)
    try {
      const result = await addEventoExtraordinario(current, extraFecha)
      if (!result.ok) {
        setExtraError(result.error)
        return
      }
      setModal(null)
    } finally {
      setExtraSaving(false)
    }
  }

  async function submitDesde(e: FormEvent) {
    e.preventDefault()
    setDesdeError('')
    if (desdeModo === 'eliminar') {
      const label = formatFechaProgramada(desdeFecha, precision)
      if (
        !confirm(
          `¿Eliminar ${afectadas.length} evento(s) desde ${label} (este y los posteriores)? No quedará registro. Los anteriores no se tocan.`,
        )
      ) {
        return
      }
    }
    setDesdeSaving(true)
    try {
      const result = await aplicarEventosDesdeFecha(
        current.id,
        desdeFecha,
        desdeModo === 'fijar' ? { tipo: 'fijar', estado: desdeEstado } : { tipo: 'eliminar' },
      )
      if (!result.ok) {
        setDesdeError(result.error)
        return
      }
      setModal(null)
    } finally {
      setDesdeSaving(false)
    }
  }

  return (
    <div className="stack">
      <EntityCard
        title={
          <h2>
            <ActividadTitle actividad={actividad} />
          </h2>
        }
        badge={eventoActual ? <StatusBadge estado={eventoActual.estado} /> : null}
        footer={
          <>
            <div className="row card-toolbar-actions">
              {eventoActual ? (
                <Link className="btn btn-primary" to={`/eventos/${eventoActual.id}?ejecutar=1`}>
                  <CircleCheck size={16} />
                  Ejecutar
                </Link>
              ) : null}
              <ShareMenu title={actividadTitulo(actividad)} text={shareText} files={shareFiles} />
            </div>
            <div className="row">
              <Link
                className="icon-btn icon-btn-edit"
                to={`/actividades/${actividad.id}/editar`}
                aria-label="Editar"
                title="Editar"
              >
                <Pencil size={16} />
              </Link>
              <button
                type="button"
                className="icon-btn icon-btn-delete"
                aria-label="Eliminar"
                title="Eliminar"
                onClick={() => void remove()}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </>
        }
      >
        <p className="muted occ-meta">
          <TipoBadge tipo={actividad.tipo} />
          {encargado ? ` · ${encargado.nombre}` : ''}
          {` · ${frecuenciaLabel(actividad.frecuencia)}`}
        </p>
        {telefonoEncargado ? (
          <p className="muted phone-line">
            Tel. {telefonoEncargado}
            <CopyText text={telefonoEncargado} label="Copiar teléfono" />
          </p>
        ) : null}
        {encargado?.congregacion ? (
          <p className="muted">Congregación: {encargado.congregacion}</p>
        ) : null}
        {actividad.notas ? <p>{actividad.notas}</p> : null}
      </EntityCard>

      <EntityCard title={<h3 className="title-sm">Adjuntos</h3>}>
        <FilePicker
          onFiles={(files) => void saveAdjuntos(files, { tipo: 'actividad', actividadId: current.id })}
        />
        <AttachmentList
          adjuntos={plantilla}
          onDelete={(adjId) => void removeAdjunto(adjId)}
          parentLabel={actividadTitulo(current)}
        />
      </EntityCard>

      <EntityCard
        title={<h3 className="title-sm">Cronograma</h3>}
        footer={
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.45rem' }}>
            <button type="button" className="btn btn-add" onClick={openExtra}>
              <CalendarPlus size={16} />
              Añadir evento
            </button>
            <button type="button" className="btn" onClick={openDesde}>
              <CalendarRange size={16} />
              Desde esta fecha…
            </button>
            <Link to={`/cronograma?ambito=actividades&tipo=${actividad.tipo}`}>Filtrar</Link>
          </div>
        }
      >
        <div className="list">
          {eventos.length === 0 ? (
            <p className="muted">Sin eventos. Añade uno o espera al periodo programado.</p>
          ) : (
            eventos.map((e) => (
              <Link key={e.id} className="card-click item" to={`/eventos/${e.id}`}>
                <div className="grow">
                  <div className="row-spread">
                    <span className="occ-meta">
                      {formatFechaProgramada(e.fechaProgramada, actividad.fechaPrecision ?? 'mes')}
                      {esExtraordinaria(e) ? <ExtraBadge /> : null}
                      {e.estadoFijado ? <span className="muted">Fijado</span> : null}
                    </span>
                    <StatusBadge estado={e.estado} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </EntityCard>

      <AccionesPanel actividadId={actividad.id} />

      <Modal open={modal === 'extra'} title="Añadir evento" onClose={() => setModal(null)}>
        <form onSubmit={(e) => void submitExtra(e)}>
          <p className="muted" style={{ marginTop: 0 }}>
            Evento extraordinario, fuera del periodo. No lo regenera la frecuencia.
          </p>
          <div className="field">
            <label htmlFor="act-extra-fecha">Fecha</label>
            <input
              id="act-extra-fecha"
              className="input"
              type="date"
              value={extraFecha}
              onChange={(e) => setExtraFecha(e.target.value)}
              required
            />
          </div>
          {extraError ? <p className="danger-text">{extraError}</p> : null}
          <div className="row" style={{ marginTop: '0.85rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="submit" disabled={extraSaving}>
              {extraSaving ? 'Guardando…' : 'Añadir'}
            </button>
            <button type="button" className="btn" onClick={() => setModal(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'desde'} title="Desde esta fecha…" onClose={() => setModal(null)}>
        <form onSubmit={(e) => void submitDesde(e)}>
          <p className="muted" style={{ marginTop: 0 }}>
            Aplica a esta fecha y las posteriores. Las anteriores no se tocan, estén hechas o no.
          </p>
          <div className="field">
            <label htmlFor="act-desde-fecha">Fecha</label>
            <input
              id="act-desde-fecha"
              className="input"
              type="date"
              value={desdeFecha}
              onChange={(e) => setDesdeFecha(e.target.value)}
              required
            />
          </div>
          <div className="chip-row tight" role="tablist" aria-label="Acción">
            <button
              type="button"
              className={`chip compact${desdeModo === 'fijar' ? ' active' : ''}`}
              onClick={() => setDesdeModo('fijar')}
            >
              Fijar estado
            </button>
            <button
              type="button"
              className={`chip compact${desdeModo === 'eliminar' ? ' active' : ''}`}
              onClick={() => setDesdeModo('eliminar')}
            >
              Eliminar
            </button>
          </div>
          {desdeModo === 'fijar' ? (
            <div className="field">
              <label htmlFor="act-desde-estado">Estado</label>
              <select
                id="act-desde-estado"
                className="select"
                value={desdeEstado}
                onChange={(e) => setDesdeEstado(e.target.value as EstadoOcurrencia)}
              >
                {ESTADOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="muted">
              Se borra el registro (ejecución y fotos). Los programados no volverán a aparecer.
            </p>
          )}
          <p className="muted">
            {afectadas.length
              ? `Se aplicará a ${afectadas.length} evento(s).`
              : 'No hay eventos desde esa fecha.'}
          </p>
          {desdeError ? <p className="danger-text">{desdeError}</p> : null}
          <div className="row" style={{ marginTop: '0.85rem', flexWrap: 'wrap' }}>
            <button
              className={desdeModo === 'eliminar' ? 'btn btn-danger' : 'btn btn-primary'}
              type="submit"
              disabled={desdeSaving || afectadas.length === 0}
            >
              {desdeSaving ? 'Aplicando…' : 'Aplicar'}
            </button>
            <button type="button" className="btn" onClick={() => setModal(null)}>
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
