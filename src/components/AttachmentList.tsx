import { useEffect, useMemo, useState } from 'react'
import { FileText, Image, Trash2 } from 'lucide-react'
import type { Adjunto } from '../db/types'
import { db } from '../db'
import { fileKind, openBlob } from '../lib/files'

export function AttachmentList({
  adjuntos,
  onDelete,
}: {
  adjuntos: Adjunto[]
  onDelete?: (id: string) => void
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})

  const imageIds = useMemo(
    () => adjuntos.filter((a) => fileKind(a.mimeType, a.nombre) === 'image').map((a) => a.id),
    [adjuntos],
  )

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

  return (
    <div className="thumbs">
      {adjuntos.map((a) => {
        const kind = fileKind(a.mimeType, a.nombre)
        return (
          <div key={a.id} className="thumb" style={{ position: 'relative' }}>
            <button
              type="button"
              className="thumb"
              style={{ border: 0, width: '100%', background: 'transparent', padding: 0 }}
              onClick={() => openBlob(a.blob, a.nombre)}
            >
              {kind === 'image' && urls[a.id] ? (
                <img src={urls[a.id]} alt={a.nombre} />
              ) : kind === 'pdf' ? (
                <FileText size={22} />
              ) : (
                <Image size={22} />
              )}
              <span style={{ wordBreak: 'break-all' }}>{a.nombre}</span>
            </button>
            {onDelete ? (
              <button
                type="button"
                className="icon-btn icon-btn-delete"
                style={{ position: 'absolute', top: 0, right: 0 }}
                aria-label={`Eliminar ${a.nombre}`}
                onClick={() => onDelete(a.id)}
              >
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export async function removeAdjunto(id: string) {
  await db.adjuntos.delete(id)
}
