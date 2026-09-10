import type { Ficha } from '../db/types'

export function fichaTitulo(ficha: Pick<Ficha, 'numero' | 'nombre'>): string {
  const n = ficha.numero?.trim()
  return n ? `N.º ${n} · ${ficha.nombre}` : ficha.nombre
}

export function siguienteNumero(fichas: Pick<Ficha, 'numero'>[]): string {
  let max = 0
  for (const ficha of fichas) {
    const parsed = Number.parseInt(String(ficha.numero ?? '').trim(), 10)
    if (Number.isFinite(parsed) && parsed > max) max = parsed
  }
  return String(max + 1)
}
