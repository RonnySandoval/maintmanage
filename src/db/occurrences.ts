import { db } from './index'
import type { Ficha, Ocurrencia } from './types'
import { computeEstado, generateDates, todayISO } from '../lib/dates'
import { createId } from '../lib/ids'

export async function syncOcurrenciasForFicha(ficha: Ficha): Promise<void> {
  const existing = await db.ocurrencias.where('fichaId').equals(ficha.id).toArray()
  const ids = existing.map((o) => o.id)
  const ejecuciones =
    ids.length === 0
      ? []
      : await db.ejecuciones.where('ocurrenciaId').anyOf(ids).toArray()
  const executedOccIds = new Set(ejecuciones.map((e) => e.ocurrenciaId))
  const frozenDates = new Set(
    existing.filter((o) => executedOccIds.has(o.id)).map((o) => o.fechaProgramada),
  )

  const toDelete = existing.filter((o) => !executedOccIds.has(o.id)).map((o) => o.id)
  if (toDelete.length) await db.ocurrencias.bulkDelete(toDelete)

  const wanted = generateDates(ficha.fechaInicio, ficha.frecuencia)
  const now = Date.now()
  const toAdd: Ocurrencia[] = wanted
    .filter((fecha) => !frozenDates.has(fecha))
    .map((fecha) => ({
      id: createId(),
      fichaId: ficha.id,
      fechaProgramada: fecha,
      estado: 'pendiente',
      createdAt: now,
      updatedAt: now,
    }))
  if (toAdd.length) await db.ocurrencias.bulkAdd(toAdd)
}

export async function refreshEstados(): Promise<void> {
  const ajustes = await db.ajustes.get('app')
  const umbral = ajustes?.umbralProximaDias ?? 7
  const today = todayISO()
  const occs = await db.ocurrencias.toArray()
  const ejecuciones = await db.ejecuciones.toArray()
  const executed = new Set(ejecuciones.map((e) => e.ocurrenciaId))
  const updates: Ocurrencia[] = []
  for (const o of occs) {
    const estado = computeEstado(o.fechaProgramada, umbral, today, executed.has(o.id))
    if (estado !== o.estado) {
      updates.push({ ...o, estado, updatedAt: Date.now() })
    }
  }
  if (updates.length) await db.ocurrencias.bulkPut(updates)
}

export async function ensureHorizon(): Promise<void> {
  const fichas = await db.fichas.toArray()
  for (const ficha of fichas) {
    await syncOcurrenciasForFicha(ficha)
  }
  await refreshEstados()
}

export async function deleteFichaCascade(fichaId: string): Promise<void> {
  const occs = await db.ocurrencias.where('fichaId').equals(fichaId).toArray()
  const occIds = occs.map((o) => o.id)
  const ejecuciones =
    occIds.length === 0
      ? []
      : await db.ejecuciones.where('ocurrenciaId').anyOf(occIds).toArray()
  const ejecIds = ejecuciones.map((e) => e.id)

  await db.transaction(
    'rw',
    [
      db.fichas,
      db.ocurrencias,
      db.ejecuciones,
      db.accionesCorrectivas,
      db.adjuntos,
    ],
    async () => {
      await db.fichas.delete(fichaId)
      await db.ocurrencias.where('fichaId').equals(fichaId).delete()
      if (occIds.length) await db.ejecuciones.where('ocurrenciaId').anyOf(occIds).delete()
      await db.accionesCorrectivas.where('fichaId').equals(fichaId).delete()
      await db.adjuntos.where('fichaId').equals(fichaId).delete()
      if (ejecIds.length) await db.adjuntos.where('ejecucionId').anyOf(ejecIds).delete()
    },
  )
}
