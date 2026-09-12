import type { AccionCorrectiva } from '../db/types'

export function accionHref(accion: AccionCorrectiva): string {
  if (accion.eventoId) return `/eventos/${accion.eventoId}`
  if (accion.ocurrenciaId) return `/ocurrencias/${accion.ocurrenciaId}`
  if (accion.actividadId) return `/actividades/${accion.actividadId}`
  if (accion.fichaId) return `/fichas/${accion.fichaId}`
  return '/historicos'
}
