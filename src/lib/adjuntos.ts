import { db } from '../db'
import type { Adjunto } from '../db/types'
import { etiquetasOf } from './etiquetasAdjuntos'

export type AdjuntoCounts = {
  ficha: Record<string, number>
  actividad: Record<string, number>
  ejecucion: Record<string, number>
  /** Texto buscable (nombre + etiquetas) por ficha/actividad plantilla. */
  searchFicha: Record<string, string>
  searchActividad: Record<string, string>
  searchEjecucion: Record<string, string>
}

const EMPTY_COUNTS: AdjuntoCounts = {
  ficha: {},
  actividad: {},
  ejecucion: {},
  searchFicha: {},
  searchActividad: {},
  searchEjecucion: {},
}

type AdjuntoIndexRow = Pick<
  Adjunto,
  'tipo' | 'fichaId' | 'actividadId' | 'ejecucionId' | 'nombre' | 'etiquetas'
>

/** Cuenta adjuntos: plantilla vs evidencia de ejecución; índice de búsqueda. */
export function buildAdjuntoCounts(rows: AdjuntoIndexRow[]): AdjuntoCounts {
  const ficha: Record<string, number> = {}
  const actividad: Record<string, number> = {}
  const ejecucion: Record<string, number> = {}
  const searchFicha: Record<string, string> = {}
  const searchActividad: Record<string, string> = {}
  const searchEjecucion: Record<string, string> = {}

  for (const a of rows) {
    const tagText = etiquetasOf(a.etiquetas).join(' ')
    const piece = `${a.nombre} ${tagText}`.toLowerCase()

    if (a.tipo === 'ficha' && a.fichaId) {
      ficha[a.fichaId] = (ficha[a.fichaId] ?? 0) + 1
      searchFicha[a.fichaId] = `${searchFicha[a.fichaId] ?? ''} ${piece}`
    } else if (a.tipo === 'actividad' && a.actividadId) {
      actividad[a.actividadId] = (actividad[a.actividadId] ?? 0) + 1
      searchActividad[a.actividadId] = `${searchActividad[a.actividadId] ?? ''} ${piece}`
    }
    if (a.ejecucionId) {
      ejecucion[a.ejecucionId] = (ejecucion[a.ejecucionId] ?? 0) + 1
      searchEjecucion[a.ejecucionId] = `${searchEjecucion[a.ejecucionId] ?? ''} ${piece}`
    }
  }
  return { ficha, actividad, ejecucion, searchFicha, searchActividad, searchEjecucion }
}

export async function loadAdjuntoCounts(): Promise<AdjuntoCounts> {
  const rows = await db.adjuntos.toArray()
  return buildAdjuntoCounts(rows)
}

export { EMPTY_COUNTS }
