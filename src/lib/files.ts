import { createId } from './ids'
import { db } from '../db'
import type { TipoAdjunto } from '../db/types'

export function isImage(mime: string): boolean {
  return mime.startsWith('image/')
}

export function isPdf(mime: string, nombre: string): boolean {
  return mime === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf')
}

export function fileKind(mime: string, nombre: string): 'image' | 'pdf' | 'word' | 'file' {
  if (isImage(mime)) return 'image'
  if (isPdf(mime, nombre)) return 'pdf'
  const lower = nombre.toLowerCase()
  if (
    mime.includes('word') ||
    mime.includes('officedocument') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.docx')
  ) {
    return 'word'
  }
  return 'file'
}

export async function saveAdjuntos(
  files: File[],
  opts: { tipo: TipoAdjunto; fichaId?: string; ejecucionId?: string },
): Promise<void> {
  const now = Date.now()
  await db.adjuntos.bulkAdd(
    files.map((file) => ({
      id: createId(),
      blob: file,
      mimeType: file.type || 'application/octet-stream',
      nombre: file.name,
      fichaId: opts.fichaId,
      ejecucionId: opts.ejecucionId,
      tipo: opts.tipo,
      createdAt: now,
    })),
  )
}

export function openBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
