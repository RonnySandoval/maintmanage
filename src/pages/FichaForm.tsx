import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { FRECUENCIAS, normalizeFrecuencia, type FechaPrecision, type Frecuencia } from '../db/types'
import { currentMonthPrefix, monthValue } from '../lib/dates'
import { siguienteNumero } from '../lib/fichas'
import { saveAdjuntos } from '../lib/files'
import { refreshEstados, syncOcurrenciasForFicha } from '../db/occurrences'
import { createId } from '../lib/ids'
import { CrearBloqueForm } from '../components/CrearBloqueForm'
import { FilePicker } from '../components/FilePicker'

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
  const [congregacion, setCongregacion] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('cada_1')
  const [fechaPrecision, setFechaPrecision] = useState<FechaPrecision>('mes')
  const [fechaInicio, setFechaInicio] = useState(`${currentMonthPrefix()}-01`)
  const [notas, setNotas] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [newEncargado, setNewEncargado] = useState('')
  const [newEncTel, setNewEncTel] = useState('')
  const [newEncCong, setNewEncCong] = useState('')
  const [showCrearBloque, setShowCrearBloque] = useState(false)
  const [numeroTouched, setNumeroTouched] = useState(false)

  useEffect(() => {
    if (ficha) {
      setNumero(ficha.numero ?? '')
      setNombre(ficha.nombre)
      setGrupoId(ficha.grupoId)
      setEncargadoId(ficha.encargadoId ?? '')
      setTelefonos(ficha.telefonos ?? '')
      setCongregacion(ficha.congregacion ?? '')
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

  async function addEncargado() {
    const name = newEncargado.trim()
    if (!name) return
    const now = Date.now()
    const created = {
      id: createId(),
      nombre: name,
      telefonos: newEncTel.trim() || undefined,
      congregacion: newEncCong.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await db.encargados.add(created)
    setEncargadoId(created.id)
    setNewEncargado('')
    setNewEncTel('')
    setNewEncCong('')
  }

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
    const inicio =
      fechaPrecision === 'mes' ? `${monthValue(fechaInicio)}-01` : fechaInicio
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
        congregacion: congregacion.trim() || undefined,
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
      navigate(`/fichas/${fichaId}`)
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
    <form className="card" onSubmit={(e) => void onSubmit(e)}>
      <div className="split split-2">
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
            placeholder="p. ej. 12"
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
            placeholder="p. ej. Revisión mensual del ascensor"
          />
        </div>
      </div>

      <div className="field">
        <div className="row-spread" style={{ marginBottom: 6 }}>
          <label htmlFor="bloque" style={{ margin: 0 }}>
            Bloque
          </label>
          <Link to="/bloques" className="muted">
            Ver todos los bloques
          </Link>
        </div>
        {bloques.length === 0 ? (
          <p className="muted">Todavía no hay bloques. Crea el primero aquí mismo.</p>
        ) : (
          <select
            id="bloque"
            className="select"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
          >
            <option value="">Seleccionar bloque…</option>
            {bloques.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        )}
        {showCrearBloque || bloques.length === 0 ? (
          <CrearBloqueForm
            onCreated={(createdId) => {
              setGrupoId(createdId)
              setShowCrearBloque(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 8 }}
            onClick={() => setShowCrearBloque(true)}
          >
            Crear otro bloque
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor="encargado">Encargado (opcional)</label>
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
        <div className="create-panel" style={{ marginTop: 8 }}>
          <p className="muted">Añadir un encargado nuevo, si hace falta</p>
          <input
            className="input"
            placeholder="Nombre"
            value={newEncargado}
            onChange={(e) => setNewEncargado(e.target.value)}
          />
          <div className="split split-2" style={{ marginTop: 8 }}>
            <input
              className="input"
              placeholder="Teléfono(s)"
              value={newEncTel}
              onChange={(e) => setNewEncTel(e.target.value)}
            />
            <input
              className="input"
              placeholder="Congregación"
              value={newEncCong}
              onChange={(e) => setNewEncCong(e.target.value)}
            />
          </div>
          <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => void addEncargado()}>
            Añadir encargado
          </button>
        </div>
      </div>

      <div className="split split-2">
        <div className="field">
          <label htmlFor="telefonos">Teléfono(s) (opcional)</label>
          <input
            id="telefonos"
            className="input"
            value={telefonos}
            onChange={(e) => setTelefonos(e.target.value)}
            placeholder="Varios, separados por coma"
          />
        </div>
        <div className="field">
          <label htmlFor="congregacion">Congregación (opcional)</label>
          <input
            id="congregacion"
            className="input"
            value={congregacion}
            onChange={(e) => setCongregacion(e.target.value)}
          />
        </div>
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
        <label>Inicio de la programación</label>
        <div className="chip-row">
          <button
            type="button"
            className={`chip${fechaPrecision === 'mes' ? ' active' : ''}`}
            onClick={() => setFechaPrecision('mes')}
          >
            Solo mes
          </button>
          <button
            type="button"
            className={`chip${fechaPrecision === 'dia' ? ' active' : ''}`}
            onClick={() => setFechaPrecision('dia')}
          >
            Fecha exacta
          </button>
        </div>
        {fechaPrecision === 'mes' ? (
          <input
            className="input"
            type="month"
            value={monthValue(fechaInicio)}
            onChange={(e) => setFechaInicio(`${e.target.value}-01`)}
          />
        ) : (
          <input
            className="input"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        )}
        <p className="muted">
          Por defecto basta el mes. Las reparaciones pendientes sí pedirán día exacto.
        </p>
      </div>

      <div className="field">
        <label htmlFor="notas">Notas</label>
        <textarea
          id="notas"
          className="textarea"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Instrucciones breves, ubicación, etc."
        />
      </div>

      <div className="field">
        <label>Plantilla o evidencia (foto, PDF, Word)</label>
        <FilePicker onFiles={(list) => setFiles((prev) => [...prev, ...list])} />
        {files.length ? (
          <p className="muted">{files.length} archivo(s) listos para guardar.</p>
        ) : null}
      </div>

      {error ? <p className="danger-text">{error}</p> : null}

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear ficha'}
        </button>
        <Link className="btn" to={id ? `/fichas/${id}` : '/fichas'}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}
