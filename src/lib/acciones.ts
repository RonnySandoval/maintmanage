import type { AccionCorrectiva, EstadoOcurrencia } from '../db/types'
import { computeEstado, todayISO } from './dates'

export function accionHref(accion: Pick<AccionCorrectiva, 'id'>): string {
  return `/acciones/${accion.id}`
}

export function accionTitulo(accion: Pick<AccionCorrectiva, 'texto'>): string {
  return accion.texto
}

export function accionDetalle(
  accion: Pick<AccionCorrectiva, 'detalle'>,
): string | undefined {
  const detalle = accion.detalle?.trim()
  return detalle || undefined
}

/** Texto combinado para búsqueda / compartir. */
export function accionSearchText(
  accion: Pick<AccionCorrectiva, 'texto' | 'detalle'>,
): string {
  return [accion.texto, accion.detalle].filter(Boolean).join(' ')
}

/** Abre el formulario de actividad prellenado desde una correctiva. */
export function convertirAccionHref(
  accion: Pick<AccionCorrectiva, 'id' | 'texto' | 'detalle' | 'fechaObjetivo'>,
): string {
  const q = new URLSearchParams()
  q.set('fromAccion', accion.id)
  q.set('titulo', accion.texto)
  if (accion.detalle?.trim()) q.set('notas', accion.detalle.trim())
  if (accion.fechaObjetivo) q.set('fecha', accion.fechaObjetivo)
  return `/actividades/nueva?${q.toString()}`
}

/** Estado propio de la acción, independiente de la inspección o actividad de origen. */
export function estadoAgendaCorrectiva(
  accion: Pick<AccionCorrectiva, 'fechaObjetivo' | 'estado'>,
): EstadoOcurrencia {
  if (accion.estado === 'ejecutada') return 'ejecutada'
  if (!accion.fechaObjetivo) return accion.estado === 'programada' ? 'proxima' : 'pendiente'
  return computeEstado(accion.fechaObjetivo, todayISO(), false, 'dia')
}
