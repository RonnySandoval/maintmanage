import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Layers, Pencil, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { db } from '../db'
import type { Encargado } from '../db/types'
import { congregacionDe, congregacionLabel } from '../lib/fichas'
import { FilterDrawerSlot, type FilterTool } from '../hooks/useFilterDrawer'
import { CopyText } from './CopyText'
import { CrearEncargadoForm } from './CrearEncargadoForm'

type GroupBy = 'congregacion' | 'lista'

function groupFromParam(value: string | null): GroupBy {
  return value === 'lista' ? 'lista' : 'congregacion'
}

export function EncargadosPanel() {
  const [params, setParams] = useSearchParams()
  const openNuevo = params.get('nuevo') === '1'
  const q = params.get('q') ?? ''
  const [searchText, setSearchText] = useState(q)
  const cong = params.get('cong') ?? ''
  const groupBy = groupFromParam(params.get('agrupar'))
  const encargados = useLiveQuery(() => db.encargados.orderBy('nombre').toArray()) ?? []
  const fichas = useLiveQuery(() => db.fichas.toArray()) ?? []
  const actividades = useLiveQuery(() => db.actividades.toArray()) ?? []
  const [error, setError] = useState('')
  const [editEnc, setEditEnc] = useState<string | null>(null)

  function patch(updates: Record<string, string | undefined>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('tab', 'encargados')
        for (const [key, value] of Object.entries(updates)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    setSearchText(q)
  }, [q])

  function setFilter(key: string, value: string) {
    patch({ [key]: value || undefined })
  }

  function onSearchChange(value: string) {
    setSearchText(value)
    setFilter('q', value)
  }

  async function removeEncargado(id: string) {
    if (fichas.some((f) => f.encargadoId === id) || actividades.some((a) => a.encargadoId === id)) {
      setError('No se puede borrar un encargado asignado a fichas o actividades.')
      return
    }
    await db.encargados.delete(id)
    setError('')
  }

  const congregaciones = useMemo(() => {
    const keys = new Set<string>()
    for (const enc of encargados) keys.add(congregacionDe(enc))
    return [...keys].sort((a, b) => {
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b, 'es')
    })
  }, [encargados])

  const filtered = useMemo(() => {
    const qLower = q.toLowerCase()
    return encargados.filter((enc) => {
      const key = congregacionDe(enc)
      if (cong === '__none' && key) return false
      if (cong && cong !== '__none' && key !== cong) return false
      if (q) {
        const hay = `${enc.nombre} ${enc.telefonos ?? ''} ${enc.contacto ?? ''} ${enc.congregacion ?? ''}`
        if (!hay.toLowerCase().includes(qLower)) return false
      }
      return true
    })
  }, [encargados, cong, q])

  const grouped = useMemo(() => {
    if (groupBy === 'lista') {
      return [{ key: 'all', label: '', rows: [...filtered].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) }]
    }
    const map = new Map<string, Encargado[]>()
    for (const enc of filtered) {
      const key = congregacionDe(enc)
      const list = map.get(key) ?? []
      list.push(enc)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (!a) return 1
        if (!b) return -1
        return a.localeCompare(b, 'es')
      })
      .map(([key, rows]) => ({
        key: key || '__none',
        label: congregacionLabel(key),
        rows,
      }))
  }, [filtered, groupBy])

  const filterTools = useMemo<FilterTool[]>(
    () => [
      {
        id: 'filtrar',
        label: 'Filtrar',
        icon: SlidersHorizontal,
        active: Boolean(cong),
        content: (
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="enc-cong">Congregación</label>
            <select
              id="enc-cong"
              className="select"
              value={cong}
              onChange={(e) => setFilter('cong', e.target.value)}
            >
              <option value="">Todas</option>
              {congregaciones.map((key) => (
                <option key={key || '__none'} value={key || '__none'}>
                  {congregacionLabel(key)}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        id: 'agrupar',
        label: 'Agrupar',
        icon: Layers,
        active: groupBy !== 'congregacion',
        content: (
          <div className="chip-row tight" role="tablist" aria-label="Agrupar">
            <button
              type="button"
              className={`chip compact${groupBy === 'congregacion' ? ' active' : ''}`}
              onClick={() => patch({ agrupar: undefined })}
            >
              Congregación
            </button>
            <button
              type="button"
              className={`chip compact${groupBy === 'lista' ? ' active' : ''}`}
              onClick={() => patch({ agrupar: 'lista' })}
            >
              Lista
            </button>
          </div>
        ),
      },
    ],
    [cong, groupBy, congregaciones],
  )

  return (
    <section className="card">
      <FilterDrawerSlot
        title="Encargados"
        tools={filterTools}
        canClear={Boolean(q || cong || groupBy !== 'congregacion')}
        onClear={() => {
          setSearchText('')
          patch({ q: undefined, cong: undefined, agrupar: undefined })
        }}
      />
      {error ? <p className="danger-text">{error}</p> : null}
      <CrearEncargadoForm accordion defaultOpen={openNuevo} />
      {encargados.length > 0 ? (
        <label className="search-field" htmlFor="enc-q" style={{ marginTop: '1rem' }}>
          <Search size={16} aria-hidden />
          <input
            id="enc-q"
            className="input"
            type="search"
            placeholder="Buscar por nombre, teléfono o congregación"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
        </label>
      ) : null}
      <div className="table-card" style={{ marginTop: encargados.length > 0 ? '0.75rem' : '1rem' }}>
        {encargados.length === 0 ? (
          <p className="table-empty">Aún no hay encargados.</p>
        ) : filtered.length === 0 ? (
          <p className="table-empty">No hay encargados con esos filtros.</p>
        ) : (
          <>
            <div className="table-head table-cols-encargados">
              <span>Nombre</span>
              <span>Teléfono</span>
              <span className="table-actions">Acciones</span>
            </div>
            {grouped.map((group) => (
              <section key={group.key}>
                {group.label ? <div className="table-section">{group.label}</div> : null}
                {group.rows.map((p) => {
                  const phone = p.telefonos || p.contacto || ''
                  return (
                    <div
                      key={p.id}
                      className={`table-row table-cols-encargados${editEnc === p.id ? ' is-editing' : ''}`}
                    >
                      {editEnc === p.id ? (
                        <EncargadoEditor enc={p} onDone={() => setEditEnc(null)} />
                      ) : (
                        <>
                          <span className="table-cell">
                            <strong>{p.nombre}</strong>
                          </span>
                          <span className="phone-cell">
                            {phone ? (
                              <>
                                <span className="muted">{phone}</span>
                                <CopyText text={phone} label="Copiar teléfono" />
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </span>
                          <span className="table-actions">
                            <button
                              type="button"
                              className="icon-btn icon-btn-edit"
                              aria-label="Editar"
                              onClick={() => setEditEnc(p.id)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn-delete"
                              aria-label="Eliminar"
                              onClick={() => void removeEncargado(p.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </span>
                        </>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
          </>
        )}
      </div>
    </section>
  )
}

function EncargadoEditor({
  enc,
  onDone,
}: {
  enc: Encargado
  onDone: () => void
}) {
  const [nombre, setNombre] = useState(enc.nombre)
  const [telefonos, setTelefonos] = useState(enc.telefonos || enc.contacto || '')
  const [congregacion, setCongregacion] = useState(enc.congregacion || '')
  const [error, setError] = useState('')

  async function save() {
    const name = nombre.trim()
    if (!name) {
      setError('Escribe el nombre del encargado.')
      return
    }
    await db.encargados.update(enc.id, {
      nombre: name,
      telefonos: telefonos.trim() || undefined,
      congregacion: congregacion.trim() || undefined,
      updatedAt: Date.now(),
    })
    onDone()
  }

  return (
    <div>
      <div className="field">
        <label htmlFor={`enc-edit-nombre-${enc.id}`}>Nombre</label>
        <input
          id={`enc-edit-nombre-${enc.id}`}
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoFocus
        />
      </div>
      <div className="ficha-form-grid" style={{ marginBottom: '0.5rem' }}>
        <div className="field">
          <label htmlFor={`enc-edit-tel-${enc.id}`}>Teléfono(s)</label>
          <input
            id={`enc-edit-tel-${enc.id}`}
            className="input"
            value={telefonos}
            onChange={(e) => setTelefonos(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="field">
          <label htmlFor={`enc-edit-cong-${enc.id}`}>Congregación</label>
          <input
            id={`enc-edit-cong-${enc.id}`}
            className="input"
            value={congregacion}
            onChange={(e) => setCongregacion(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
      {error ? <p className="danger-text">{error}</p> : null}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          Guardar
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
