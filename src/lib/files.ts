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
  opts: { tipo: TipoAdjunto; fichaId?: string; actividadId?: string; ejecucionId?: string },
): Promise<string[]> {
  const now = Date.now()
  const rows = files.map((file) => ({
    id: createId(),
    blob: file,
    mimeType: file.type || 'application/octet-stream',
    nombre: file.name,
    fichaId: opts.fichaId,
    actividadId: opts.actividadId,
    ejecucionId: opts.ejecucionId,
    tipo: opts.tipo,
    createdAt: now,
  }))
  await db.adjuntos.bulkAdd(rows)
  return rows.map((row) => row.id)
}

/** Asigna o quita ficha de un adjunto (manual ↔ ficha). */
export async function setAdjuntoFicha(id: string, fichaId: string | undefined): Promise<void> {
  const adjunto = await db.adjuntos.get(id)
  if (!adjunto) return
  if (fichaId) {
    await db.adjuntos.put({
      ...adjunto,
      fichaId,
      tipo: adjunto.tipo === 'actividad' || adjunto.tipo === 'ejecucion' ? adjunto.tipo : 'ficha',
    })
    return
  }
  const next = { ...adjunto, tipo: 'manual' as const }
  delete next.fichaId
  await db.adjuntos.put(next)
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
