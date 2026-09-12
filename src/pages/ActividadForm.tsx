import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { db } from '../db'
import { refreshEstados } from '../db/occurrences'
import { syncEventosForActividad } from '../db/activities'
import {
  FRECUENCIAS,
  normalizeFrecuencia,
  tipoActividadOf,
  type Actividad,
  type FechaPrecision,
  type Frecuencia,
  type TipoActividad,
} from '../db/types'
import { currentMonthPrefix, monthValue, todayISO } from '../lib/dates'
import { createId } from '../lib/ids'
import { saveAdjuntos } from '../lib/files'
import { CrearEncargadoForm } from '../components/CrearEncargadoForm'
import { TipoActividadField } from '../components/TipoActividadField'
import { FilePicker } from '../components/FilePicker'
import { goBackOrFallback } from '../lib/nav'

export function ActividadFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = Boolean(id)
  const tipoParam = params.get('tipo')
  const tipoQuery = tipoParam ? tipoActividadOf(tipoParam) : ''

  const actividad = useLiveQuery(async () => {
    if (!id) return null
    return (await db.actividades.get(id)) ?? null
  }, [id])
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []

  const [tipo, setTipo] = useState<TipoActividad>(() => tipoQuery || 'reparacion')
  const [titulo, setTitulo] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('unica')
  const [fechaPrecision, setFechaPrecision] = useState<FechaPrecision>('dia')
  const [fechaInicio, setFechaInicio] = useState(todayISO())
  const [notas, setNotas] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCrearEncargado, setShowCrearEncargado] = useState(false)

  useEffect(() => {
    if (actividad) {
      setTipo(tipoActividadOf(actividad.tipo))
      setTitulo(actividad.titulo)
      setEncargadoId(actividad.encargadoId ?? '')
      setFrecuencia(normalizeFrecuencia(actividad.frecuencia))
      setFechaPrecision(actividad.fechaPrecision === 'mes' ? 'mes' : 'dia')
      setFechaInicio(actividad.fechaInicio || todayISO())
      setNotas(actividad.notas ?? '')
    }
  }, [actividad])

  useEffect(() => {
    if (editing || !tipoQuery) return
    setTipo(tipoQuery)
  }, [editing, tipoQuery])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!titulo.trim()) {
      setError('El título es obligatorio.')
      return
    }
    const inicio = fechaPrecision === 'mes' ? `${monthValue(fechaInicio)}-01` : fechaInicio
    if (!inicio || inicio.length < 7) {
      setError('Indica la fecha o el mes de inicio.')
      return
    }
    setSaving(true)
    try {
      const now = Date.now()
      const actividadId = id ?? createId()
      const record: Actividad = {
        id: actividadId,
        tipo,
        titulo: titulo.trim(),
        encargadoId: encargadoId || undefined,
        frecuencia,
        fechaInicio: inicio,
        fechaPrecision,
        notas: notas.trim() || undefined,
        createdAt: actividad?.createdAt ?? now,
        updatedAt: now,
      }
      if (actividad?.fechasOmitidas?.length) record.fechasOmitidas = actividad.fechasOmitidas
      await db.actividades.put(record)
      if (files.length) await saveAdjuntos(files, { tipo: 'actividad', actividadId })
      await syncEventosForActividad(record)
      await refreshEstados()
      navigate(`/actividades/${actividadId}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  if (editing && actividad === undefined) {
    return <p className="muted">Cargando…</p>
  }
  if (editing && actividad === null) {
    return (
      <div className="card">
        <p>No se encontró la actividad.</p>
        <Link to="/fichas?tab=actividades">Volver</Link>
      </div>
    )
  }

  return (
    <form className="card ficha-form" onSubmit={(e) => void onSubmit(e)}>
      <div className="ficha-form-grid">
        <div className="field">
          <label htmlFor="act-tipo">Tipo</label>
          <TipoActividadField id="act-tipo" value={tipo} onChange={setTipo} />
        </div>
        <div className="field">
          <label htmlFor="act-titulo">Título</label>
          <input
            id="act-titulo"
            className="input"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={tipo === 'inspeccion' ? 'Revisión de…' : 'Compra de filtros, limpieza salón…'}
          />
        </div>

        <div className="field">
          <label htmlFor="act-encargado">Encargado</label>
          <div className="combo-row">
            <select
              id="act-encargado"
              className="select"
              value={encargadoId}
              onChange={(e) => setEncargadoId(e.target.value)}
            >
              <option value="">Sin encargado</option>
              {encargados.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`btn btn-icon btn-add${showCrearEncargado ? ' is-open' : ''}`}
              aria-label={showCrearEncargado ? 'Cerrar crear encargado' : 'Crear encargado'}
              title="Crear encargado"
              onClick={() => setShowCrearEncargado((open) => !open)}
            >
              {showCrearEncargado ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="act-frecuencia">Periodo</label>
          <select
            id="act-frecuencia"
            className="select"
            value={frecuencia}
            onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
          >
            {FRECUENCIAS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {showCrearEncargado ? (
          <div className="span-2">
            <CrearEncargadoForm
              onCreated={(createdId) => {
                setEncargadoId(createdId)
                setShowCrearEncargado(false)
              }}
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="act-inicio">Inicio</label>
          <div className="form-seg" role="group" aria-label="Precisión de inicio">
            <button
              type="button"
              className={fechaPrecision === 'mes' ? 'active' : ''}
              onClick={() => {
                setFechaPrecision('mes')
                setFechaInicio(`${monthValue(fechaInicio || currentMonthPrefix())}-01`)
              }}
            >
              Mes
            </button>
            <button
              type="button"
              className={fechaPrecision === 'dia' ? 'active' : ''}
              onClick={() => setFechaPrecision('dia')}
            >
              Día
            </button>
          </div>
          {fechaPrecision === 'mes' ? (
            <input
              id="act-inicio"
              className="input"
              type="month"
              value={monthValue(fechaInicio)}
              onChange={(e) => setFechaInicio(`${e.target.value}-01`)}
            />
          ) : (
            <input
              id="act-inicio"
              className="input"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          )}
        </div>

        <div className="field span-2">
          <label htmlFor="act-notas">Notas</label>
          <textarea
            id="act-notas"
            className="textarea compact"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Insumos, lugar, instrucciones…"
          />
        </div>

        <div className="field span-2">
          <label>Adjuntos</label>
          <FilePicker
            files={files}
            onFiles={(list) => setFiles((prev) => [...prev, ...list])}
            onRemoveFile={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
          />
        </div>
      </div>

      {error ? <p className="danger-text">{error}</p> : null}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear actividad'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            goBackOrFallback(navigate, id ? `/actividades/${id}` : '/fichas?tab=actividades')
          }
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
