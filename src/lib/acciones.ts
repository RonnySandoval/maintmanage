import type { AccionCorrectiva, EstadoOcurrencia } from '../db/types'
import { db } from '../db'
import { computeEstado, todayISO } from './dates'
import { createId } from './ids'

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

/**
 * Convierte una recomendación en acción correctiva sin perder trazabilidad:
 * crea la correctiva (con `origenId` a la recomendación) y marca la
 * recomendación con `convertidaEnId`. Idempotente: si ya se convirtió,
 * devuelve el id existente sin duplicar.
 */
export async function convertirRecomendacionACorrectiva(
  recomendacion: AccionCorrectiva,
): Promise<string> {
  if (recomendacion.convertidaEnId) {
    const existing = await db.accionesCorrectivas.get(recomendacion.convertidaEnId)
    if (existing) return existing.id
  }
  const now = Date.now()
  const id = createId()
  await db.accionesCorrectivas.add({
    id,
    fichaId: recomendacion.fichaId,
    ocurrenciaId: recomendacion.ocurrenciaId,
    actividadId: recomendacion.actividadId,
    eventoId: recomendacion.eventoId,
    tipo: 'correctiva',
    texto: recomendacion.texto,
    detalle: recomendacion.detalle,
    estado: 'pendiente',
    prioridad: 'media',
    origenId: recomendacion.id,
    createdAt: now,
    updatedAt: now,
  })
  await db.accionesCorrectivas.update(recomendacion.id, { convertidaEnId: id, updatedAt: now })
  return id
}

/**
 * Al borrar un registro, desvincula el otro lado de la conversión para no
 * dejar enlaces a registros inexistentes (la contraparte se conserva).
 */
export async function limpiarTrazabilidadAlBorrar(accion: AccionCorrectiva): Promise<void> {
  if (accion.convertidaEnId) {
    const child = await db.accionesCorrectivas.get(accion.convertidaEnId)
    if (child && child.origenId === accion.id) {
      const next = { ...child }
      delete next.origenId
      next.updatedAt = Date.now()
      await db.accionesCorrectivas.put(next)
    }
  }
  if (accion.origenId) {
    const parent = await db.accionesCorrectivas.get(accion.origenId)
    if (parent && parent.convertidaEnId === accion.id) {
      const next = { ...parent }
      delete next.convertidaEnId
      next.updatedAt = Date.now()
      await db.accionesCorrectivas.put(next)
    }
  }
}
