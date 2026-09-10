import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Trash2 } from 'lucide-react'
import { db } from '../db'
import { FRECUENCIAS } from '../db/types'
import { formatDate } from '../lib/dates'
import { saveAdjuntos } from '../lib/files'
import { blobToFile } from '../lib/share'
import { deleteFichaCascade } from '../db/occurrences'
import { AttachmentList, removeAdjunto } from '../components/AttachmentList'
import { FilePicker } from '../components/FilePicker'
import { ShareMenu } from '../components/ShareMenu'
import { StatusBadge } from '../components/ui'

const freqLabel = Object.fromEntries(FRECUENCIAS.map((f) => [f.id, f.label]))

export function FichaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ficha = useLiveQuery(async () => {
    if (!id) return null
    return (await db.fichas.get(id)) ?? null
  }, [id])
  const grupo = useLiveQuery(
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
  const acciones =
    useLiveQuery(async () => {
      if (!id) return []
      const rows = await db.accionesCorrectivas.where('fichaId').equals(id).toArray()
      return rows.sort((a, b) => b.createdAt - a.createdAt)
    }, [id]) ?? []

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
  const shareText = [
    `Ficha: ${current.nombre}`,
    grupo ? `Grupo: ${grupo.nombre}` : '',
    encargado ? `Encargado: ${encargado.nombre}` : '',
    `Frecuencia: ${freqLabel[ficha.frecuencia]}`,
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
    navigate('/fichas')
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-spread" style={{ marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>{ficha.nombre}</h2>
            <p className="muted" style={{ margin: 0 }}>
              <span
                className="color-dot"
                style={{
                  display: 'inline-block',
                  margin: '0 6px 0 0',
                  verticalAlign: 'middle',
                  background: grupo?.color ?? 'var(--accent)',
                }}
              />
              {grupo?.nombre} · {encargado?.nombre} · {freqLabel[ficha.frecuencia]}
            </p>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link className="btn" to={`/fichas/${ficha.id}/editar`}>
              <Pencil size={16} />
              Editar
            </Link>
            <button type="button" className="btn btn-danger" onClick={() => void remove()}>
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        </div>
        {ficha.notas ? <p>{ficha.notas}</p> : null}
        <ShareMenu title={ficha.nombre} text={shareText} files={shareFiles} />
      </div>

      <div className="card">
        <h3 className="title-sm">Adjuntos de la ficha</h3>
        <FilePicker
          onFiles={(files) => void saveAdjuntos(files, { tipo: 'ficha', fichaId: current.id })}
        />
        <div style={{ marginTop: '0.75rem' }}>
          <AttachmentList
            adjuntos={plantilla}
            onDelete={(adjId) => void removeAdjunto(adjId)}
          />
        </div>
      </div>

      <div className="card">
        <div className="row-spread">
          <h3 className="title-sm" style={{ margin: 0 }}>
            Cronograma
          </h3>
          <Link to={`/cronograma?ficha=${ficha.id}`}>Filtrar</Link>
        </div>
        <div className="list" style={{ marginTop: '0.7rem' }}>
          {ocurrencias.slice(0, 18).map((o) => (
            <Link key={o.id} className="card-click item" to={`/ocurrencias/${o.id}`}>
              <div className="grow">
                <div className="row-spread">
                  <span>{formatDate(o.fechaProgramada)}</span>
                  <StatusBadge estado={o.estado} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {acciones.length ? (
        <div className="card">
          <h3 className="title-sm">Acciones correctivas</h3>
          <div className="list">
            {acciones.map((a) => (
              <div key={a.id} className="row-spread">
                <span>{a.texto}</span>
                <span className="badge badge-pendiente">{a.estado}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
