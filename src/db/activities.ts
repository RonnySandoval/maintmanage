import { db } from './index'
import {
  esOcurrenciaProgramada,
  type Actividad,
  type EstadoOcurrencia,
  type Evento,
  type FechaPrecision,
} from './types'
import { computeEstado, fechaEnAdelante, generateDates, normalizeISODate, todayISO } from '../lib/dates'
import { createId } from '../lib/ids'

function omittedSet(actividad: Pick<Actividad, 'fechasOmitidas'>): Set<string> {
  return new Set(actividad.fechasOmitidas ?? [])
}

async function cascadeDeleteEventos(eventos: Evento[]): Promise<void> {
  if (!eventos.length) return
  const eventoIds = eventos.map((e) => e.id)
  const ejecuciones = await db.ejecuciones.where('eventoId').anyOf(eventoIds).toArray()
  const ejecIds = ejecuciones.map((e) => e.id)
  await db.eventos.bulkDelete(eventoIds)
  if (eventoIds.length) await db.ejecuciones.where('eventoId').anyOf(eventoIds).delete()
  if (ejecIds.length) await db.adjuntos.where('ejecucionId').anyOf(ejecIds).delete()
}

export function eventosDesdeFecha(
  eventos: Evento[],
  desde: string,
  precision: FechaPrecision = 'dia',
): Evento[] {
  return eventos.filter((e) => fechaEnAdelante(e.fechaProgramada, desde, precision))
}

export async function syncEventosForActividad(actividad: Actividad): Promise<void> {
  const existing = await db.eventos.where('actividadId').equals(actividad.id).toArray()
  const ids = existing.map((e) => e.id)
  const ejecuciones =
    ids.length === 0 ? [] : await db.ejecuciones.where('eventoId').anyOf(ids).toArray()
  const executedIds = new Set(ejecuciones.map((e) => e.eventoId).filter(Boolean) as string[])
  const frozenDates = new Set(
    existing.filter((e) => executedIds.has(e.id)).map((e) => e.fechaProgramada),
  )
  const omitted = omittedSet(actividad)

  const wanted = generateDates(actividad.fechaInicio, actividad.frecuencia).filter(
    (fecha) => !omitted.has(fecha),
  )
  const wantedSet = new Set(wanted)
  const existingDates = new Set(existing.map((e) => e.fechaProgramada))
  const toDelete = existing
    .filter((e) => {
      if (executedIds.has(e.id)) return false
      if (!esOcurrenciaProgramada(e)) return false
      if (e.estadoFijado) return false
      if (omitted.has(e.fechaProgramada)) return true
      return !wantedSet.has(e.fechaProgramada)
    })
    .map((e) => e.id)
  if (toDelete.length) await db.eventos.bulkDelete(toDelete)

  const now = Date.now()
  const toAdd: Evento[] = wanted
    .filter((fecha) => !existingDates.has(fecha) && !frozenDates.has(fecha))
    .map((fecha) => ({
      id: createId(),
      actividadId: actividad.id,
      fechaProgramada: fecha,
      estado: 'pendiente',
      origen: 'programada',
      createdAt: now,
      updatedAt: now,
    }))
  if (toAdd.length) await db.eventos.bulkAdd(toAdd)
}

export async function syncAllActividades(): Promise<void> {
  const actividades = await db.actividades.toArray()
  for (const actividad of actividades) {
    await syncEventosForActividad(actividad)
  }
}

export async function refreshEventoEstados(): Promise<void> {
  const today = todayISO()
  const eventos = await db.eventos.toArray()
  const actividades = await db.actividades.toArray()
  const precisionByActividad: Record<string, FechaPrecision> = {}
  for (const a of actividades) {
    precisionByActividad[a.id] = a.fechaPrecision === 'dia' ? 'dia' : 'mes'
  }
  const ejecuciones = await db.ejecuciones.toArray()
  const executed = new Set(
    ejecuciones.map((e) => e.eventoId).filter((id): id is string => Boolean(id)),
  )
  const updates: Evento[] = []
  for (const e of eventos) {
    if (e.estadoFijado) continue
    const estado = computeEstado(
      e.fechaProgramada,
      today,
      executed.has(e.id),
      precisionByActividad[e.actividadId] ?? 'mes',
    )
    if (estado !== e.estado) {
      updates.push({ ...e, estado, updatedAt: Date.now() })
    }
  }
  if (updates.length) await db.eventos.bulkPut(updates)
}

export async function addEventoExtraordinario(
  actividad: Actividad,
  fecha: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fechaNorm = normalizeISODate(fecha)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNorm)) {
    return { ok: false, error: 'Indica una fecha válida.' }
  }
  const dup = await db.eventos
    .where('[actividadId+fechaProgramada]')
    .equals([actividad.id, fechaNorm])
    .first()
  if (dup) {
    return { ok: false, error: 'Ya hay un evento en esa fecha.' }
  }
  const now = Date.now()
  const evento: Evento = {
    id: createId(),
    actividadId: actividad.id,
    fechaProgramada: fechaNorm,
    estado: computeEstado(fechaNorm, todayISO(), false, actividad.fechaPrecision ?? 'mes'),
    origen: 'extraordinaria',
    createdAt: now,
    updatedAt: now,
  }
  await db.eventos.add(evento)
  return { ok: true, id: evento.id }
}

export async function deleteEvento(eventoId: string): Promise<string | undefined> {
  const evento = await db.eventos.get(eventoId)
  if (!evento) return undefined
  await db.transaction(
    'rw',
    [db.actividades, db.eventos, db.ejecuciones, db.adjuntos],
    async () => {
      const actividad = await db.actividades.get(evento.actividadId)
      if (actividad && esOcurrenciaProgramada(evento)) {
        const omitted = omittedSet(actividad)
        omitted.add(evento.fechaProgramada)
        await db.actividades.update(actividad.id, {
          fechasOmitidas: [...omitted].sort(),
          updatedAt: Date.now(),
        })
      }
      await cascadeDeleteEventos([evento])
    },
  )
  return evento.actividadId
}

export async function aplicarEventosDesdeFecha(
  actividadId: string,
  desde: string,
  accion: { tipo: 'fijar'; estado: EstadoOcurrencia } | { tipo: 'eliminar' },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const desdeNorm = normalizeISODate(desde)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeNorm)) {
    return { ok: false, error: 'Indica una fecha válida.' }
  }
  const actividad = await db.actividades.get(actividadId)
  if (!actividad) return { ok: false, error: 'Actividad no encontrada.' }
  const precision = actividad.fechaPrecision === 'dia' ? 'dia' : 'mes'
  const eventos = await db.eventos.where('actividadId').equals(actividadId).toArray()
  const posteriores = eventosDesdeFecha(eventos, desdeNorm, precision)
  if (!posteriores.length) {
    return { ok: false, error: 'No hay eventos desde esa fecha.' }
  }

  if (accion.tipo === 'fijar') {
    const now = Date.now()
    await db.eventos.bulkPut(
      posteriores.map((e) => ({
        ...e,
        estado: accion.estado,
        estadoFijado: true,
        updatedAt: now,
      })),
    )
    return { ok: true, count: posteriores.length }
  }

  await db.transaction(
    'rw',
    [db.actividades, db.eventos, db.ejecuciones, db.adjuntos],
    async () => {
      const current = (await db.actividades.get(actividadId)) ?? actividad
      const omitted = omittedSet(current)
      for (const e of posteriores) {
        if (esOcurrenciaProgramada(e)) omitted.add(e.fechaProgramada)
      }
      await db.actividades.update(actividadId, {
        fechasOmitidas: [...omitted].sort(),
        updatedAt: Date.now(),
      })
      await cascadeDeleteEventos(posteriores)
    },
  )
  return { ok: true, count: posteriores.length }
}

export async function deleteActividadCascade(actividadId: string): Promise<void> {
  const eventos = await db.eventos.where('actividadId').equals(actividadId).toArray()
  const eventoIds = eventos.map((e) => e.id)
  const ejecuciones =
    eventoIds.length === 0
      ? []
      : await db.ejecuciones.where('eventoId').anyOf(eventoIds).toArray()
  const ejecIds = ejecuciones.map((e) => e.id)

  await db.transaction(
    'rw',
    [db.actividades, db.eventos, db.ejecuciones, db.adjuntos],
    async () => {
      await db.actividades.delete(actividadId)
      await db.eventos.where('actividadId').equals(actividadId).delete()
      if (eventoIds.length) await db.ejecuciones.where('eventoId').anyOf(eventoIds).delete()
      await db.adjuntos.where('actividadId').equals(actividadId).delete()
      if (ejecIds.length) await db.adjuntos.where('ejecucionId').anyOf(ejecIds).delete()
    },
  )
}
