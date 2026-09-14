import { db } from '../db'

export function normalizeEtiqueta(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function etiquetasOf(etiquetas?: string[] | null): string[] {
  if (!etiquetas?.length) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of etiquetas) {
    const label = normalizeEtiqueta(raw)
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out
}

/** Une catálogo guardado + etiquetas ya usadas en adjuntos. */
export function mergeEtiquetasCatalog(
  catalog?: string[] | null,
  used: string[] = [],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [...(catalog ?? []), ...used]) {
    const label = normalizeEtiqueta(raw)
    if (!label) continue
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
}

export async function ensureEtiquetaInCatalog(label: string): Promise<string> {
  const normalized = normalizeEtiqueta(label)
  if (!normalized) throw new Error('Escribe un nombre para la etiqueta.')
  const ajustes = await db.ajustes.get('app')
  const current = etiquetasOf(ajustes?.etiquetasAdjuntos)
  const existing = current.find((e) => e.toLowerCase() === normalized.toLowerCase())
  if (existing) return existing
  const next = mergeEtiquetasCatalog(current, [normalized])
  if (ajustes) await db.ajustes.update('app', { etiquetasAdjuntos: next })
  else {
    await db.ajustes.put({
      id: 'app',
      umbralProximaDias: 7,
      notificaciones: false,
      autoBackup: true,
      etiquetasAdjuntos: next,
    })
  }
  return normalized
}

export async function setAdjuntoEtiquetas(id: string, etiquetas: string[]): Promise<void> {
  const next = etiquetasOf(etiquetas)
  await db.adjuntos.update(id, { etiquetas: next.length ? next : [] })
  for (const label of next) {
    await ensureEtiquetaInCatalog(label)
  }
}

export async function toggleAdjuntoEtiqueta(id: string, label: string): Promise<void> {
  const adjunto = await db.adjuntos.get(id)
  if (!adjunto) return
  const normalized = await ensureEtiquetaInCatalog(label)
  const current = etiquetasOf(adjunto.etiquetas)
  const has = current.some((e) => e.toLowerCase() === normalized.toLowerCase())
  const next = has
    ? current.filter((e) => e.toLowerCase() !== normalized.toLowerCase())
    : [...current, normalized]
  await db.adjuntos.update(id, { etiquetas: next })
}
