import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import type { Adjunto, Ficha } from '../db/types'
import { db } from '../db'
import { setAdjuntoFicha } from '../lib/files'
import { fichaTitulo } from '../lib/fichas'
import {
  ensureEtiquetaInCatalog,
  etiquetasOf,
  setAdjuntoEtiquetas,
} from '../lib/etiquetasAdjuntos'
import { AdjuntosMark } from './AdjuntosMark'
import { AttachmentList, removeAdjunto } from './AttachmentList'
import { EntityCard } from './EntityCard'

export function DocumentosAsignacionPanel({
  ids,
  fichas,
  defaultFichaId = '',
  requireFicha = false,
  onDone,
}: {
  ids: string[]
  fichas: Ficha[]
  defaultFichaId?: string
  requireFicha?: boolean
  onDone: () => void
}) {
  const [bulkFichaId, setBulkFichaId] = useState(defaultFichaId)
  const [bulkTag, setBulkTag] = useState('')
  const [error, setError] = useState('')
  const [seeded, setSeeded] = useState(false)

  const adjuntos =
    useLiveQuery(async () => {
      if (!ids.length) return [] as Adjunto[]
      const rows = await db.adjuntos.bulkGet(ids)
      return rows.filter((row): row is Adjunto => Boolean(row))
    }, [ids]) ?? []

  useEffect(() => {
    if (seeded || !defaultFichaId || !adjuntos.length) return
    setSeeded(true)
    void Promise.all(
      adjuntos
        .filter((a) => !a.fichaId)
        .map((a) => setAdjuntoFicha(a.id, defaultFichaId)),
    )
  }, [adjuntos, defaultFichaId, seeded])

  const ordered = useMemo(() => {
    const byId = new Map(adjuntos.map((a) => [a.id, a]))
    return ids.map((id) => byId.get(id)).filter((row): row is Adjunto => Boolean(row))
  }, [adjuntos, ids])

  async function applyBulkFicha() {
    setError('')
    await Promise.all(ordered.map((a) => setAdjuntoFicha(a.id, bulkFichaId || undefined)))
  }

  async function applyBulkTag() {
    setError('')
    try {
      const label = await ensureEtiquetaInCatalog(bulkTag)
      await Promise.all(
        ordered.map(async (a) => {
          const tags = etiquetasOf(a.etiquetas)
          if (tags.some((t) => t.toLowerCase() === label.toLowerCase())) return
          await setAdjuntoEtiquetas(a.id, [...tags, label])
        }),
      )
      setBulkTag('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar la etiqueta.')
    }
  }

  function finish() {
    if (requireFicha && ordered.some((a) => !a.fichaId)) {
      setError('Asigna una ficha a cada documento.')
      return
    }
    onDone()
  }

  if (!ids.length) return null

  return (
    <section className="docs-assign-panel" aria-label="Asignar documentos">
      <div className="docs-assign-head">
        <div>
          <h3 className="title-sm" style={{ margin: 0 }}>
            Asignar documentos
          </h3>
          <p className="muted docs-assign-sub">
            {ordered.length} archivo{ordered.length === 1 ? '' : 's'} cargado
            {ordered.length === 1 ? '' : 's'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={finish}>
          <Check size={16} />
          Listo
        </button>
      </div>

      {ordered.length > 1 ? (
        <div className="docs-assign-bulk">
          <div className="field" style={{ margin: 0, flex: '1 1 10rem' }}>
            <label htmlFor="docs-bulk-ficha">Ficha para todos</label>
            <div className="docs-assign-bulk-row">
              <select
                id="docs-bulk-ficha"
                className="select"
                value={bulkFichaId}
                onChange={(e) => setBulkFichaId(e.target.value)}
              >
                <option value="">Sin ficha</option>
                {fichas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {fichaTitulo(f)}
                  </option>
                ))}
              </select>
              <button type="button" className="btn" onClick={() => void applyBulkFicha()}>
                Aplicar
              </button>
            </div>
          </div>
          <div className="field" style={{ margin: 0, flex: '1 1 10rem' }}>
            <label htmlFor="docs-bulk-tag">Etiqueta para todos</label>
            <div className="docs-assign-bulk-row">
              <input
                id="docs-bulk-tag"
                className="input"
                value={bulkTag}
                placeholder="Etiqueta…"
                onChange={(e) => setBulkTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void applyBulkTag()
                  }
                }}
              />
              <button
                type="button"
                className="btn"
                disabled={!bulkTag.trim()}
                onClick={() => void applyBulkTag()}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="danger-text">{error}</p> : null}

      <EntityCard
        className="docs-group docs-assign-group"
        title={
          <div className="docs-group-title-block">
            <span>Documentos cargados</span>
            <p className="muted docs-group-meta">Asigna ficha y etiquetas a cada archivo</p>
          </div>
        }
        badge={<AdjuntosMark count={ordered.length} />}
      >
        {ordered.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No quedan documentos en esta carga.
          </p>
        ) : (
          <AttachmentList
            adjuntos={ordered}
            onDelete={(id) => void removeAdjunto(id)}
            fichas={fichas}
            requireFicha={requireFicha}
            parentLabel="Documentos cargados"
          />
        )}
      </EntityCard>
    </section>
  )
}
