import type { Actividad, TipoActividad } from '../db/types'
import { tipoActividadLabel, tipoActividadOf } from '../db/types'

export function actividadTitulo(actividad: Pick<Actividad, 'titulo' | 'tipo'>): string {
  return actividad.titulo?.trim() || tipoActividadLabel(actividad.tipo)
}

export function compareActividadesByTitulo(
  a?: Pick<Actividad, 'titulo' | 'tipo'> | null,
  b?: Pick<Actividad, 'titulo' | 'tipo'> | null,
): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  const tipo = tipoActividadOf(a.tipo).localeCompare(tipoActividadOf(b.tipo), 'es')
  if (tipo !== 0) return tipo
  return actividadTitulo(a).localeCompare(actividadTitulo(b), 'es')
}

export function tipoActividadGroupLabel(tipo: TipoActividad | string): string {
  return tipoActividadLabel(tipo)
}
