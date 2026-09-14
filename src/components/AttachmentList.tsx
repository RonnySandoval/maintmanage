import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Image, Plus, Trash2, X } from 'lucide-react'
import type { Adjunto } from '../db/types'
import { db } from '../db'
import {
  adjuntoShareFiles,
  adjuntoShareText,
  resolveAdjuntoMetas,
  type AdjuntoViewMeta,
} from '../lib/adjuntoContext'
import { fileKind, openBlob } from '../lib/files'
import {
  ensureEtiquetaInCatalog,
  etiquetasOf,
  mergeEtiquetasCatalog,
  setAdjuntoEtiquetas,
  toggleAdjuntoEtiqueta,
} from '../lib/etiquetasAdjuntos'
import { ImageLightbox } from './ImageLightbox'
import { ShareMenu } from './ShareMenu'

const EMPTY_META: AdjuntoViewMeta = { parentLabel: '', dateLabel: '', header: '' }

function AdjuntoCard({
  adjunto,
  catalog,
  editableTags,
  onDelete,
  url,
  meta,
  onOpenImage,
}: {
  adjunto: Adjunto
  catalog: string[]
  editableTags: boolean
  onDelete?: (id: string) => void
  url?: string
  meta: AdjuntoViewMeta
  onOpenImage?: (adjunto: Adjunto, url: string) => void
}) {
  const tags = etiquetasOf(adjunto.etiquetas)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const kind = fileKind(adjunto.mimeType, adjunto.nombre)
  const shareFiles = useMemo(() => adjuntoShareFiles([adjunto]), [adjunto])
  const shareText = adjuntoShareText(meta, adjunto.nombre)
  const shareTitle = meta.parentLabel || adjunto.nombre

  const available = useMemo(() => {
    const assigned = new Set(tags.map((t) => t.toLowerCase()))
    return catalog.filter((c) => !assigned.has(c.toLowerCase()))
  }, [catalog, tags])

  async function addNew() {
    setError('')
    try {
      const label = await ensureEtiquetaInCatalog(draft)
      await setAdjuntoEtiquetas(adjunto.id, [...tags, label])
      setDraft('')
      setAdding(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la etiqueta.')
    }
  }

  function cancelAdd() {
    setAdding(false)
    setDraft('')
    setError('')
  }

  function open() {
    if (kind === 'image' && url && onOpenImage) {
      onOpenImage(adjunto, url)
      return
    }
    openBlob(adjunto.blob, adjunto.nombre)
  }

  return (
    <article className={`adjunto-card${adding ? ' is-editing' : ''}`}>
      <header className="adjunto-card-head">
        <button
          type="button"
          className="adjunto-preview"
          onClick={open}
          title={kind === 'image' ? `Ver ${adjunto.nombre}` : `Abrir ${adjunto.nombre}`}
        >
          {kind === 'image' && url ? (
            <img src={url} alt="" />
          ) : kind === 'pdf' ? (
            <FileText size={18} />
          ) : (
            <Image size={18} />
          )}
        </button>
        <div className="adjunto-card-main">
          <button type="button" className="adjunto-name" onClick={open}>
            {adjunto.nombre}
          </button>
          {meta.header ? <p className="muted adjunto-card-meta">{meta.header}</p> : null}
          {tags.length || editableTags ? (
            <div className="adjunto-tags">
              {tags.map((tag) =>
                editableTags ? (
                  <button
                    key={tag}
                    type="button"
                    className="chip tag active"
                    title={`Quitar «${tag}»`}
                    onClick={() => void toggleAdjuntoEtiqueta(adjunto.id, tag)}
                  >
                    {tag}
                    <X size={12} aria-hidden />
                  </button>
                ) : (
                  <span key={tag} className="chip tag active is-static">
                    {tag}
                  </span>
                ),
              )}
              {editableTags && !adding ? (
                <button
                  type="button"
                  className="chip tag compact"
                  onClick={() => setAdding(true)}
                  title="Añadir etiqueta"
                  aria-label="Añadir etiqueta"
                >
                  <Plus size={12} aria-hidden />
                  Etiqueta
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="adjunto-card-actions">
          <ShareMenu title={shareTitle} text={shareText} files={shareFiles} iconOnly />
          {onDelete ? (
            <button
              type="button"
              className="icon-btn icon-btn-delete"
              aria-label={`Eliminar ${adjunto.nombre}`}
              title="Eliminar"
              onClick={() => onDelete(adjunto.id)}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </header>

      {editableTags && adding ? (
        <div className="adjunto-tag-add" onClick={(e) => e.stopPropagation()}>
          {available.length ? (
            <div className="chip-row tight">
              {available.map((label) => (
                <button
                  key={label}
                  type="button"
                  className="chip tag compact"
                  onClick={() => void toggleAdjuntoEtiqueta(adjunto.id, label)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="row" style={{ gap: '0.35rem', flexWrap: 'wrap' }}>
            <input
              className="input"
              value={draft}
              placeholder="Nueva etiqueta…"
              aria-label="Nueva etiqueta"
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addNew()
                }
                if (e.key === 'Escape') cancelAdd()
              }}
            />
            <button
              type="button"
              className="btn btn-add"
              disabled={!draft.trim()}
              onClick={() => void addNew()}
            >
              <Plus size={14} />
              Crear
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelAdd}>
              Cancelar
            </button>
          </div>
          {error ? <p className="danger-text">{error}</p> : null}
        </div>
      ) : null}
    </article>
  )
}

export function AttachmentList({
  adjuntos,
  onDelete,
  editableTags = true,
  parentLabel,
}: {
  adjuntos: Adjunto[]
  onDelete?: (id: string) => void
  /** Permitir crear/asignar etiquetas (por defecto sí). */
  editableTags?: boolean
  /** Nombre de ficha/actividad cuando ya se conoce (detalle). */
  parentLabel?: string
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<{ adjunto: Adjunto; src: string } | null>(null)
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  const usedTags =
    useLiveQuery(async () => {
      const rows = await db.adjuntos.toArray()
      return rows.flatMap((a) => etiquetasOf(a.etiquetas))
    }) ?? []
  const catalog = useMemo(
    () => mergeEtiquetasCatalog(ajustes?.etiquetasAdjuntos, usedTags),
    [ajustes?.etiquetasAdjuntos, usedTags],
  )

  const imageIds = useMemo(
    () => adjuntos.filter((a) => fileKind(a.mimeType, a.nombre) === 'image').map((a) => a.id),
    [adjuntos],
  )
  const adjuntoKey = useMemo(
    () =>
      adjuntos
        .map((a) => `${a.id}:${a.createdAt}:${a.ejecucionId ?? ''}:${a.fichaId ?? ''}:${a.actividadId ?? ''}`)
        .join('|'),
    [adjuntos],
  )

  const metas =
    useLiveQuery(
      () => resolveAdjuntoMetas(adjuntos, parentLabel),
      [adjuntoKey, parentLabel],
    ) ?? {}

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const a of adjuntos) {
      if (fileKind(a.mimeType, a.nombre) === 'image') {
        next[a.id] = URL.createObjectURL(a.blob)
      }
    }
    setUrls(next)
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url)
    }
  }, [adjuntos, imageIds.join('|')])

  if (!adjuntos.length) return <p className="muted">Sin archivos adjuntos.</p>

  const lightMeta = lightbox ? metas[lightbox.adjunto.id] ?? EMPTY_META : EMPTY_META

  return (
    <>
      <div className="adjunto-list">
        {adjuntos.map((a) => (
          <AdjuntoCard
            key={a.id}
            adjunto={a}
            catalog={catalog}
            editableTags={editableTags}
            onDelete={onDelete}
            url={urls[a.id]}
            meta={metas[a.id] ?? EMPTY_META}
            onOpenImage={(adjunto, src) => setLightbox({ adjunto, src })}
          />
        ))}
      </div>
      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.adjunto.nombre}
          header={lightMeta.header}
          shareTitle={lightMeta.parentLabel || lightbox.adjunto.nombre}
          shareText={adjuntoShareText(lightMeta, lightbox.adjunto.nombre)}
          shareFiles={adjuntoShareFiles([lightbox.adjunto])}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </>
  )
}

export async function removeAdjunto(id: string) {
  await db.adjuntos.delete(id)
}
