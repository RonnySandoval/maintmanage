import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CalendarRange, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import {
  ESTADOS,
  esExtraordinaria,
  frecuenciaLabel,
  tipoActividadColor,
  tipoActividadLabel,
  type EstadoOcurrencia,
} from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { formatFechaProgramada, todayISO } from '../lib/dates'
import { actividadTitulo } from '../lib/actividades'
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
import { ExtraBadge, Modal, StatusBadge, TipoBadge } from '../components/ui'
import { useTiposActividad } from '../hooks/useTiposActividad'
import { ActividadTitle } from '../components/ActividadTitle'
import { CopyText } from '../components/CopyText'

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
      <div className="card">
        <div className="row-spread" style={{ marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>
              <ActividadTitle actividad={actividad} />
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              <span
                className="color-dot"
                style={{
                  display: 'inline-block',
                  margin: '0 6px 0 0',
                  verticalAlign: 'middle',
                  background: bloqueColorVar(tipoActividadColor(actividad.tipo, tipos)),
                }}
              />
              <TipoBadge tipo={actividad.tipo} />
              {encargado ? ` · ${encargado.nombre}` : ''}
              {` · ${frecuenciaLabel(actividad.frecuencia)}`}
            </p>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="btn btn-edit" to={`/actividades/${actividad.id}/editar`}>
              <Pencil size={16} />
              Editar
            </Link>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </div>
        {telefonoEncargado || encargado?.congregacion ? (
          <p className="muted phone-line">
            {telefonoEncargado ? (
              <>
                Tel. {telefonoEncargado}
                <CopyText text={telefonoEncargado} label="Copiar teléfono" />
              </>
            ) : null}
            {encargado?.congregacion && telefonoEncargado ? ' · ' : ''}
            {encargado?.congregacion ? `Congregación: ${encargado.congregacion}` : ''}
          </p>
        ) : null}
        {actividad.notas ? <p>{actividad.notas}</p> : null}
        <ShareMenu title={actividadTitulo(actividad)} text={shareText} files={shareFiles} />
      </div>

      <div className="card">
        <h3 className="title-sm">Adjuntos</h3>
        <FilePicker
          onFiles={(files) => void saveAdjuntos(files, { tipo: 'actividad', actividadId: current.id })}
        />
        <div style={{ marginTop: '0.75rem' }}>
          <AttachmentList adjuntos={plantilla} onDelete={(adjId) => void removeAdjunto(adjId)} />
        </div>
      </div>

      <div className="card">
        <div className="row-spread" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="title-sm" style={{ margin: 0 }}>
            Cronograma
          </h3>
          <div className="row" style={{ flexWrap: 'wrap' }}>
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
        </div>
        <div className="list" style={{ marginTop: '0.7rem' }}>
          {eventos.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Sin eventos. Añade uno o espera al periodo programado.
            </p>
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
      </div>

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
