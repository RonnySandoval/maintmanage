import type { Encargado, Ficha } from '../db/types'

export function fichaTitulo(ficha: Pick<Ficha, 'numero' | 'nombre'>): string {
  const n = ficha.numero?.trim()
  return n ? `${n} · ${ficha.nombre}` : ficha.nombre
}

export function compareFichasByNumero(
  a?: Pick<Ficha, 'numero' | 'nombre'> | null,
  b?: Pick<Ficha, 'numero' | 'nombre'> | null,
): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const na = Number.parseInt(String(a.numero ?? '').trim(), 10)
  const nb = Number.parseInt(String(b.numero ?? '').trim(), 10)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return fichaTitulo(a).localeCompare(fichaTitulo(b), 'es')
}

export function congregacionDe(encargado?: Pick<Encargado, 'congregacion'> | null): string {
  return encargado?.congregacion?.trim() ?? ''
}

export function congregacionLabel(key: string): string {
  return key || 'Sin congregación'
}

export function siguienteNumero(fichas: Pick<Ficha, 'numero'>[]): string {
  let max = 0
  for (const ficha of fichas) {
    const parsed = Number.parseInt(String(ficha.numero ?? '').trim(), 10)
    if (Number.isFinite(parsed) && parsed > max) max = parsed
  }
  return String(max + 1)
}
