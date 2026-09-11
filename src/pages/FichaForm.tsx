import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X } from 'lucide-react'
import { db } from '../db'
import { FRECUENCIAS, normalizeFrecuencia, type FechaPrecision, type Frecuencia } from '../db/types'
import { currentMonthPrefix, monthValue } from '../lib/dates'
import { createId } from '../lib/ids'
import { siguienteNumero } from '../lib/fichas'
import { saveAdjuntos } from '../lib/files'
import { refreshEstados, syncOcurrenciasForFicha } from '../db/occurrences'
import { CrearBloqueForm } from '../components/CrearBloqueForm'
import { CrearEncargadoForm } from '../components/CrearEncargadoForm'
import { FilePicker } from '../components/FilePicker'
import { goBackOrFallback } from '../lib/nav'

export function FichaFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)

  const ficha = useLiveQuery(async () => {
    if (!id) return null
    return (await db.fichas.get(id)) ?? null
  }, [id])
  const bloques = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const todasFichas = useLiveQuery(() => db.fichas.toArray()) ?? []

  const [numero, setNumero] = useState('')
  const [nombre, setNombre] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [telefonos, setTelefonos] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('cada_1')
  const [fechaPrecision, setFechaPrecision] = useState<FechaPrecision>('mes')
  const [fechaInicio, setFechaInicio] = useState(`${currentMonthPrefix()}-01`)
  const [notas, setNotas] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCrearBloque, setShowCrearBloque] = useState(false)
  const [showCrearEncargado, setShowCrearEncargado] = useState(false)
  const [numeroTouched, setNumeroTouched] = useState(false)

  useEffect(() => {
    if (ficha) {
      setNumero(ficha.numero ?? '')
      setNombre(ficha.nombre)
      setGrupoId(ficha.grupoId)
      setEncargadoId(ficha.encargadoId ?? '')
      setTelefonos(ficha.telefonos ?? '')
      setFrecuencia(normalizeFrecuencia(ficha.frecuencia))
      setFechaPrecision(ficha.fechaPrecision === 'dia' ? 'dia' : 'mes')
      setFechaInicio(ficha.fechaInicio || `${currentMonthPrefix()}-01`)
      setNotas(ficha.notas ?? '')
    }
  }, [ficha])

  useEffect(() => {
    if (editing || numeroTouched) return
    setNumero(siguienteNumero(todasFichas))
  }, [editing, todasFichas, numeroTouched])

  useEffect(() => {
    if (!editing && bloques.length === 0) setShowCrearBloque(true)
  }, [editing, bloques.length])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!numero.trim()) {
      setError('El número de ficha es obligatorio.')
      return
    }
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!grupoId) {
      setError('Elige o crea un bloque.')
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
      const fichaId = id ?? createId()
      const record = {
        id: fichaId,
        numero: numero.trim(),
        nombre: nombre.trim(),
        grupoId,
        encargadoId: encargadoId || undefined,
        telefonos: telefonos.trim() || undefined,
        frecuencia,
        fechaInicio: inicio,
        fechaPrecision,
        notas: notas.trim() || undefined,
        createdAt: ficha?.createdAt ?? now,
        updatedAt: now,
      }
      await db.fichas.put(record)
      if (files.length) await saveAdjuntos(files, { tipo: 'ficha', fichaId })
      await syncOcurrenciasForFicha(record)
      await refreshEstados()
      navigate(`/fichas/${fichaId}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  if (editing && ficha === undefined) {
    return <p className="muted">Cargando…</p>
  }
  if (editing && ficha === null) {
    return (
      <div className="card">
        <p>No se encontró la ficha.</p>
        <Link to="/fichas">Volver</Link>
      </div>
    )
  }

  return (
    <form className="card ficha-form" onSubmit={(e) => void onSubmit(e)}>
      <div className="ficha-form-grid">
        <div className="field">
          <label htmlFor="numero">Número</label>
          <input
            id="numero"
            className="input"
            value={numero}
            onChange={(e) => {
              setNumeroTouched(true)
              setNumero(e.target.value)
            }}
            placeholder="12"
            inputMode="numeric"
          />
        </div>
        <div className="field">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Revisión ascensor"
          />
        </div>

        <div className="field">
          <label htmlFor="bloque">Bloque</label>
          <div className="combo-row">
            <select
              id="bloque"
              className="select"
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {bloques.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`btn btn-icon${showCrearBloque ? ' btn-primary' : ''}`}
              aria-label={showCrearBloque ? 'Cerrar crear bloque' : 'Crear bloque'}
              title="Crear bloque"
              onClick={() => {
                setShowCrearBloque((open) => !open)
                setShowCrearEncargado(false)
              }}
            >
              {showCrearBloque ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="encargado">Encargado</label>
          <div className="combo-row">
            <select
              id="encargado"
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
              className={`btn btn-icon${showCrearEncargado ? ' btn-primary' : ''}`}
              aria-label={showCrearEncargado ? 'Cerrar crear encargado' : 'Crear encargado'}
              title="Crear encargado"
              onClick={() => {
                setShowCrearEncargado((open) => !open)
                setShowCrearBloque(false)
              }}
            >
              {showCrearEncargado ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>
        </div>

        {showCrearBloque ? (
          <div className="span-2">
            <CrearBloqueForm
              compact
              onCreated={(createdId) => {
                setGrupoId(createdId)
                setShowCrearBloque(false)
              }}
            />
          </div>
        ) : null}

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

        <div className="field span-2">
          <label htmlFor="telefonos">Teléfono(s)</label>
          <input
            id="telefonos"
            className="input"
            value={telefonos}
            onChange={(e) => setTelefonos(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className="field">
          <label htmlFor="frecuencia">Periodo</label>
          <select
            id="frecuencia"
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

        <div className="field">
          <label htmlFor="inicio">Inicio</label>
          <div className="chip-row tight">
            <button
              type="button"
              className={`chip${fechaPrecision === 'mes' ? ' active' : ''}`}
              onClick={() => setFechaPrecision('mes')}
            >
              Mes
            </button>
            <button
              type="button"
              className={`chip${fechaPrecision === 'dia' ? ' active' : ''}`}
              onClick={() => setFechaPrecision('dia')}
            >
              Día
            </button>
          </div>
          {fechaPrecision === 'mes' ? (
            <input
              id="inicio"
              className="input"
              type="month"
              value={monthValue(fechaInicio)}
              onChange={(e) => setFechaInicio(`${e.target.value}-01`)}
            />
          ) : (
            <input
              id="inicio"
              className="input"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          )}
        </div>

        <div className="field span-2">
          <label htmlFor="notas">Notas</label>
          <textarea
            id="notas"
            className="textarea compact"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ubicación, instrucciones…"
          />
        </div>

        <div className="field span-2">
          <label>Adjuntos</label>
          <FilePicker onFiles={(list) => setFiles((prev) => [...prev, ...list])} />
          {files.length ? <p className="muted">{files.length} archivo(s)</p> : null}
        </div>
      </div>

      {error ? <p className="danger-text">{error}</p> : null}

      <div className="row" style={{ flexWrap: 'wrap', marginTop: '0.65rem' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear ficha'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => goBackOrFallback(navigate, id ? `/fichas/${id}` : '/fichas')}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
