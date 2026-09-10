import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { FRECUENCIAS, GRUPO_COLORS, type Frecuencia } from '../db/types'
import { createId } from '../lib/ids'
import { todayISO } from '../lib/dates'
import { saveAdjuntos } from '../lib/files'
import { refreshEstados, syncOcurrenciasForFicha } from '../db/occurrences'
import { FilePicker } from '../components/FilePicker'

export function FichaFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editing = Boolean(id)

  const ficha = useLiveQuery(async () => {
    if (!id) return null
    return (await db.fichas.get(id)) ?? null
  }, [id])
  const grupos = useLiveQuery(() => db.grupos.orderBy('nombre').toArray()) ?? []
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []

  const [nombre, setNombre] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>('mensual')
  const [fechaInicio, setFechaInicio] = useState(todayISO())
  const [notas, setNotas] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [newGrupo, setNewGrupo] = useState('')
  const [newEncargado, setNewEncargado] = useState('')

  useEffect(() => {
    if (ficha) {
      setNombre(ficha.nombre)
      setGrupoId(ficha.grupoId)
      setEncargadoId(ficha.encargadoId)
      setFrecuencia(ficha.frecuencia)
      setFechaInicio(ficha.fechaInicio)
      setNotas(ficha.notas ?? '')
    }
  }, [ficha])

  async function addGrupo() {
    const name = newGrupo.trim()
    if (!name) return
    const now = Date.now()
    const created = {
      id: createId(),
      nombre: name,
      color: GRUPO_COLORS[grupos.length % GRUPO_COLORS.length],
      createdAt: now,
      updatedAt: now,
    }
    await db.grupos.add(created)
    setGrupoId(created.id)
    setNewGrupo('')
  }

  async function addEncargado() {
    const name = newEncargado.trim()
    if (!name) return
    const now = Date.now()
    const created = {
      id: createId(),
      nombre: name,
      createdAt: now,
      updatedAt: now,
    }
    await db.encargados.add(created)
    setEncargadoId(created.id)
    setNewEncargado('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    if (!grupoId) {
      setError('Elige o crea un grupo.')
      return
    }
    if (!encargadoId) {
      setError('Elige o crea un encargado.')
      return
    }
    setSaving(true)
    try {
      const now = Date.now()
      const fichaId = id ?? createId()
      const record = {
        id: fichaId,
        nombre: nombre.trim(),
        grupoId,
        encargadoId,
        frecuencia,
        fechaInicio,
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

      <div className="field">
        <label htmlFor="grupo">Grupo</label>
        <select
          id="grupo"
          className="select"
          value={grupoId}
          onChange={(e) => setGrupoId(e.target.value)}
        >
          <option value="">Seleccionar…</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
        <div className="row" style={{ marginTop: 6 }}>
          <input
            className="input"
            placeholder="Nuevo grupo"
            value={newGrupo}
            onChange={(e) => setNewGrupo(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => void addGrupo()}>
            Añadir
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="encargado">Encargado</label>
        <select
          id="encargado"
          className="select"
          value={encargadoId}
          onChange={(e) => setEncargadoId(e.target.value)}
        >
          <option value="">Seleccionar…</option>
          {encargados.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <div className="row" style={{ marginTop: 6 }}>
          <input
            className="input"
            placeholder="Nuevo encargado"
            value={newEncargado}
            onChange={(e) => setNewEncargado(e.target.value)}
          />
          <button type="button" className="btn" onClick={() => void addEncargado()}>
            Añadir
          </button>
        </div>
      </div>

      <div className="split split-2">
        <div className="field">
          <label htmlFor="frecuencia">Frecuencia</label>
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
          <label htmlFor="inicio">Fecha de inicio</label>
          <input
            id="inicio"
            className="input"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>
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
