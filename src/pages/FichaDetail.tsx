import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, CalendarRange, Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import { ESTADOS, esExtraordinaria, frecuenciaLabel, type EstadoOcurrencia } from '../db/types'
import { bloqueColorVar } from '../lib/colors'
import { formatFechaProgramada, todayISO } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { saveAdjuntos } from '../lib/files'
import { blobToFile } from '../lib/share'
import {
  addInspeccionExtraordinaria,
  aplicarDesdeFecha,
  deleteFichaCascade,
  ocurrenciasDesdeFecha,
} from '../db/occurrences'
import { AttachmentList, removeAdjunto } from '../components/AttachmentList'
import { FilePicker } from '../components/FilePicker'
import { ShareMenu } from '../components/ShareMenu'
import { ExtraBadge, Modal, StatusBadge } from '../components/ui'
import { FichaTitle } from '../components/FichaTitle'
import { AccionesPanel } from '../components/AccionesPanel'
import { CopyText } from '../components/CopyText'
import { EntityCard } from '../components/EntityCard'

export function FichaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ficha = useLiveQuery(async () => {
    if (!id) return null
    return (await db.fichas.get(id)) ?? null
  }, [id])
  const bloque = useLiveQuery(
    () => (ficha?.grupoId ? db.grupos.get(ficha.grupoId) : undefined),
    [ficha?.grupoId],
  )
  const encargado = useLiveQuery(
    () => (ficha?.encargadoId ? db.encargados.get(ficha.encargadoId) : undefined),
    [ficha?.encargadoId],
  )
  const ocurrencias =
    useLiveQuery(
      () => (id ? db.ocurrencias.where('fichaId').equals(id).sortBy('fechaProgramada') : []),
      [id],
    ) ?? []
  const adjuntos =
    useLiveQuery(
      () => (id ? db.adjuntos.where('fichaId').equals(id).toArray() : []),
      [id],
    ) ?? []

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
  if (ficha === undefined) return <p className="muted">Cargando…</p>
  if (ficha === null) {
    return (
      <div className="card">
        Ficha no encontrada. <Link to="/fichas">Volver</Link>
      </div>
    )
  }

  const current = ficha
  const plantilla = adjuntos.filter((a) => a.tipo === 'ficha')
  const telefonoEncargado = encargado?.telefonos || encargado?.contacto || ''
  const precision = ficha.fechaPrecision === 'dia' ? 'dia' : 'mes'
  const afectadas = ocurrenciasDesdeFecha(ocurrencias, desdeFecha, precision)
  const shareText = [
    `Ficha: ${fichaTitulo(current)}`,
    bloque ? `Bloque: ${bloque.nombre}` : '',
    encargado ? `Encargado: ${encargado.nombre}` : '',
    telefonoEncargado ? `Teléfono(s): ${telefonoEncargado}` : '',
    encargado?.congregacion ? `Congregación: ${encargado.congregacion}` : '',
    `Periodo: ${frecuenciaLabel(ficha.frecuencia)}`,
    ficha.notas ? `Notas: ${ficha.notas}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const shareFiles = plantilla.map((a) => blobToFile(a.blob, a.nombre, a.mimeType))

  async function remove() {
    if (!confirm('¿Eliminar esta ficha y su cronograma? Las ejecuciones también se borrarán en este dispositivo.')) {
      return
    }
    await deleteFichaCascade(current.id)
    navigate('/fichas', { replace: true })
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
      const result = await addInspeccionExtraordinaria(current, extraFecha)
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
      const label = precision === 'mes'
        ? formatFechaProgramada(desdeFecha, 'mes')
        : formatFechaProgramada(desdeFecha, 'dia')
      if (
        !confirm(
          `¿Eliminar ${afectadas.length} inspección(es) desde ${label} (esta y las posteriores)? No quedará registro. Las anteriores no se tocan.`,
        )
      ) {
        return
      }
    }
    setDesdeSaving(true)
    try {
      const result = await aplicarDesdeFecha(
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
            <FichaTitle ficha={ficha} color={bloque?.color} />
          </h2>
        }
        footer={
          <>
            <ShareMenu title={fichaTitulo(ficha)} text={shareText} files={shareFiles} />
            <div className="row">
              <Link
                className="icon-btn icon-btn-edit"
                to={`/fichas/${ficha.id}/editar`}
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
          <span
            className="color-dot"
            style={{
              display: 'inline-block',
              margin: '0 6px 0 0',
              verticalAlign: 'middle',
              background: bloqueColorVar(bloque?.color),
            }}
          />
          {bloque?.nombre}
          {encargado ? ` · ${encargado.nombre}` : ''}
          {` · ${frecuenciaLabel(ficha.frecuencia)}`}
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
        {ficha.notas ? <p>{ficha.notas}</p> : null}
      </EntityCard>

      <EntityCard title={<h3 className="title-sm">Adjuntos de la ficha</h3>}>
        <FilePicker
          onFiles={(files) => void saveAdjuntos(files, { tipo: 'ficha', fichaId: current.id })}
        />
        <AttachmentList
          adjuntos={plantilla}
          onDelete={(adjId) => void removeAdjunto(adjId)}
        />
      </EntityCard>

      <EntityCard
        title={<h3 className="title-sm">Cronograma</h3>}
        footer={
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.45rem' }}>
            <button type="button" className="btn btn-add" onClick={openExtra}>
              <CalendarPlus size={16} />
              Añadir inspección
            </button>
            <button type="button" className="btn" onClick={openDesde}>
              <CalendarRange size={16} />
              Desde esta fecha…
            </button>
            <Link to={`/cronograma?ficha=${ficha.id}`}>Filtrar</Link>
          </div>
        }
      >
        <div className="list">
          {ocurrencias.length === 0 ? (
            <p className="muted">
              Sin inspecciones. Añade una extraordinaria o espera al periodo programado.
            </p>
          ) : (
            ocurrencias.map((o) => (
              <Link key={o.id} className="card-click item" to={`/ocurrencias/${o.id}`}>
                <div className="grow">
                  <div className="row-spread">
                    <span className="occ-meta">
                      {formatFechaProgramada(o.fechaProgramada, ficha.fechaPrecision ?? 'mes')}
                      {esExtraordinaria(o) ? <ExtraBadge /> : null}
                      {o.estadoFijado ? <span className="muted">Fijado</span> : null}
                    </span>
                    <StatusBadge estado={o.estado} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </EntityCard>

      <AccionesPanel fichaId={ficha.id} />

      <Modal open={modal === 'extra'} title="Añadir inspección" onClose={() => setModal(null)}>
        <form onSubmit={(e) => void submitExtra(e)}>
          <p className="muted" style={{ marginTop: 0 }}>
            Inspección extraordinaria, fuera del periodo. No la regenera la frecuencia.
          </p>
          <div className="field">
            <label htmlFor="extra-fecha">Fecha</label>
            <input
              id="extra-fecha"
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
            <label htmlFor="desde-fecha">Fecha</label>
            <input
              id="desde-fecha"
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
              <label htmlFor="desde-estado">Estado</label>
              <select
                id="desde-estado"
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
              Se borra el registro (ejecución y fotos). Las programadas no volverán a aparecer.
            </p>
          )}
          <p className="muted">
            {afectadas.length
              ? `Se aplicará a ${afectadas.length} inspección(es).`
              : 'No hay inspecciones desde esa fecha.'}
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
