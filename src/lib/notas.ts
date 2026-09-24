import { toISODate } from './dates'
import type { Nota } from '../db/types'

/** Fecha efectiva de la nota (las copias viejas pueden no traerla). */
export function fechaDeNota(nota: Pick<Nota, 'createdAt'> & { fecha?: string }): string {
  if (typeof nota.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(nota.fecha)) {
    return nota.fecha
  }
  return toISODate(new Date(nota.createdAt))
}

/** Fijadas primero; luego por fecha descendente y actualización. */
export function compararNotas(a: Nota, b: Nota): number {
  if (a.fijada !== b.fijada) return a.fijada ? -1 : 1
  const fecha = fechaDeNota(b).localeCompare(fechaDeNota(a))
  if (fecha) return fecha
  return b.updatedAt - a.updatedAt
}
