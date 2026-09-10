import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ESTADOS_CORRECTIVA, type EstadoCorrectiva } from '../db/types'
import { createId } from '../lib/ids'
import { formatFechaProgramada, todayISO } from '../lib/dates'
import { fichaTitulo } from '../lib/fichas'
import { saveAdjuntos } from '../lib/files'
import { blobToFile } from '../lib/share'
import { refreshEstados } from '../db/occurrences'
import { AttachmentList, removeAdjunto } from '../components/AttachmentList'
import { FilePicker } from '../components/FilePicker'
import { ShareMenu } from '../components/ShareMenu'
import { StatusBadge } from '../components/ui'

export function OcurrenciaDetailPage() {
  const { id } = useParams()
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
  const acciones =
    useLiveQuery(async () => {
      if (!occ?.fichaId) return []
      const rows = await db.accionesCorrectivas.where('fichaId').equals(occ.fichaId).toArray()
      return rows.sort((a, b) => b.createdAt - a.createdAt)
    }, [occ?.fichaId]) ?? []

  const [fechaReal, setFechaReal] = useState(todayISO())
  const [observaciones, setObservaciones] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [correctiva, setCorrectiva] = useState('')
  const [correctivaEstado, setCorrectivaEstado] = useState<EstadoCorrectiva>('pendiente')
  const [correctivaFecha, setCorrectivaFecha] = useState(todayISO())
  const [corrError, setCorrError] = useState('')

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
    `Estado: ${ocurrencia.estado}`,
    bloque ? `Bloque: ${bloque.nombre}` : '',
    encargado ? `Encargado: ${encargado.nombre}` : '',
    ejecucion?.observaciones ? `Observaciones: ${ejecucion.observaciones}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const shareFiles = [...plantilla, ...evidencia].map((a) =>
    blobToFile(a.blob, a.nombre, a.mimeType),
  )

  async function markDone(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const now = Date.now()
      const ejecucionId = ejecucion?.id ?? createId()
      await db.ejecuciones.put({
        id: ejecucionId,
        ocurrenciaId: ocurrencia.id,
        fechaReal,
        observaciones: observaciones.trim() || undefined,
        createdAt: ejecucion?.createdAt ?? now,
        updatedAt: now,
      })
      if (files.length) await saveAdjuntos(files, { tipo: 'ejecucion', ejecucionId, fichaId: currentFicha.id })
      await refreshEstados()
      setFiles([])
      setObservaciones('')
    } finally {
      setSaving(false)
    }
  }

  async function addCorrectiva(e: FormEvent) {
    e.preventDefault()
    setCorrError('')
    if (!correctiva.trim()) return
    if (!correctivaFecha) {
      setCorrError('Las reparaciones pendientes necesitan una fecha exacta.')
      return
    }
    const now = Date.now()
    await db.accionesCorrectivas.add({
      id: createId(),
      fichaId: currentFicha.id,
      ocurrenciaId: ocurrencia.id,
      texto: correctiva.trim(),
      estado: correctivaEstado,
      fechaObjetivo: correctivaFecha,
      createdAt: now,
      updatedAt: now,
    })
    setCorrectiva('')
    setCorrectivaFecha(todayISO())
    setCorrectivaEstado('pendiente')
  }

  async function setCorrectivaState(accionId: string, estado: EstadoCorrectiva) {
    await db.accionesCorrectivas.update(accionId, { estado, updatedAt: Date.now() })
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-spread" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          <div>
            <p className="muted" style={{ margin: 0, textTransform: 'capitalize' }}>
              {formatFechaProgramada(
                ocurrencia.fechaProgramada,
                currentFicha.fechaPrecision === 'dia' ? 'dia' : 'mes',
              )}
            </p>
            <h2>
              <Link to={`/fichas/${currentFicha.id}`}>{fichaTitulo(currentFicha)}</Link>
            </h2>
            <p className="muted">
              {bloque?.nombre} · {encargado?.nombre}
            </p>
          </div>
          <StatusBadge estado={ocurrencia.estado} />
        </div>
        <ShareMenu title={fichaTitulo(currentFicha)} text={shareText} files={shareFiles} />
      </div>

      <div className="card">
        <h3 className="title-sm">{ejecucion ? 'Ejecución' : 'Marcar como ejecutada'}</h3>
        {ejecucion ? (
          <div>
            <p>
              Realizada el <strong>{ejecucion.fechaReal}</strong>
            </p>
            {ejecucion.observaciones ? <p>{ejecucion.observaciones}</p> : <p className="muted">Sin observaciones.</p>}
            <FilePicker
              onFiles={(list) =>
                void saveAdjuntos(list, {
                  tipo: 'ejecucion',
                  ejecucionId: ejecucion.id,
                  fichaId: currentFicha.id,
                })
              }
            />
            <div style={{ marginTop: '0.75rem' }}>
              <AttachmentList
                adjuntos={evidencia}
                onDelete={(adjId) => void removeAdjunto(adjId)}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void markDone(e)}>
            <div className="field">
              <label htmlFor="fechaReal">Fecha real</label>
              <input
                id="fechaReal"
                className="input"
                type="date"
                value={fechaReal}
                onChange={(e) => setFechaReal(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="obs">Observaciones</label>
              <textarea
                id="obs"
                className="textarea"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Hallazgos, piezas, condiciones…"
              />
            </div>
            <div className="field">
              <label>Evidencia</label>
              <FilePicker onFiles={(list) => setFiles((prev) => [...prev, ...list])} />
              {files.length ? <p className="muted">{files.length} archivo(s)</p> : null}
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Registrar ejecución'}
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <h3 className="title-sm">Acciones correctivas</h3>
        <form onSubmit={(e) => void addCorrectiva(e)}>
          <div className="field">
            <label htmlFor="corr">Nueva acción</label>
            <input
              id="corr"
              className="input"
              value={correctiva}
              onChange={(e) => setCorrectiva(e.target.value)}
              placeholder="p. ej. Sustituir junta del tanque"
            />
          </div>
          <div className="split split-2">
            <div className="field">
              <label htmlFor="corrEstado">Estado</label>
              <select
                id="corrEstado"
                className="select"
                value={correctivaEstado}
                onChange={(e) => setCorrectivaEstado(e.target.value as EstadoCorrectiva)}
              >
                {ESTADOS_CORRECTIVA.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="corrFecha">Fecha (obligatoria)</label>
              <input
                id="corrFecha"
                className="input"
                type="date"
                value={correctivaFecha}
                onChange={(e) => setCorrectivaFecha(e.target.value)}
              />
            </div>
          </div>
          {corrError ? <p className="danger-text">{corrError}</p> : null}
          <button className="btn" type="submit">
            Añadir acción
          </button>
        </form>
        <div className="list" style={{ marginTop: '0.9rem' }}>
          {acciones.length === 0 ? (
            <p className="muted">Ninguna acción correctiva aún.</p>
          ) : (
            acciones.map((a) => (
              <div key={a.id} className="card">
                <div className="row-spread" style={{ flexWrap: 'wrap' }}>
                  <strong>{a.texto}</strong>
                  <select
                    className="select"
                    style={{ maxWidth: 180 }}
                    value={a.estado}
                    onChange={(e) =>
                      void setCorrectivaState(a.id, e.target.value as EstadoCorrectiva)
                    }
                  >
                    {ESTADOS_CORRECTIVA.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                {a.fechaObjetivo ? (
                  <p className="muted" style={{ margin: '0.3rem 0 0' }}>
                    Objetivo: {a.fechaObjetivo}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
