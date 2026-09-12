import { db } from './index'
import { refreshEventoEstados, syncAllActividades } from './activities'
import {
  esOcurrenciaProgramada,
  type EstadoOcurrencia,
  type FechaPrecision,
  type Ficha,
  type Ocurrencia,
} from './types'
import { computeEstado, fechaEnAdelante, generateDates, normalizeISODate, todayISO } from '../lib/dates'
import { createId } from '../lib/ids'

function omittedSet(ficha: Pick<Ficha, 'fechasOmitidas'>): Set<string> {
  return new Set(ficha.fechasOmitidas ?? [])
}

async function cascadeDeleteOcurrencias(occs: Ocurrencia[]): Promise<void> {
  if (!occs.length) return
  const occIds = occs.map((o) => o.id)
  const ejecuciones = await db.ejecuciones.where('ocurrenciaId').anyOf(occIds).toArray()
  const ejecIds = ejecuciones.map((e) => e.id)
  await db.ocurrencias.bulkDelete(occIds)
  if (occIds.length) await db.ejecuciones.where('ocurrenciaId').anyOf(occIds).delete()
  if (ejecIds.length) await db.adjuntos.where('ejecucionId').anyOf(ejecIds).delete()
}

export function ocurrenciasDesdeFecha(
  occs: Ocurrencia[],
  desde: string,
  precision: FechaPrecision = 'dia',
): Ocurrencia[] {
  return occs.filter((o) => fechaEnAdelante(o.fechaProgramada, desde, precision))
}

export async function syncOcurrenciasForFicha(ficha: Ficha): Promise<void> {
  const existing = await db.ocurrencias.where('fichaId').equals(ficha.id).toArray()
  const ids = existing.map((o) => o.id)
  const ejecuciones =
    ids.length === 0
      ? []
      : await db.ejecuciones.where('ocurrenciaId').anyOf(ids).toArray()
  const executedOccIds = new Set(
    ejecuciones.map((e) => e.ocurrenciaId).filter((id): id is string => Boolean(id)),
  )
  const frozenDates = new Set(
    existing.filter((o) => executedOccIds.has(o.id)).map((o) => o.fechaProgramada),
  )
  const omitted = omittedSet(ficha)

  const wanted = generateDates(ficha.fechaInicio, ficha.frecuencia).filter((fecha) => !omitted.has(fecha))
  const wantedSet = new Set(wanted)
  const existingDates = new Set(existing.map((o) => o.fechaProgramada))
  const toDelete = existing
    .filter((o) => {
      if (executedOccIds.has(o.id)) return false
      if (!esOcurrenciaProgramada(o)) return false
      if (o.estadoFijado) return false
      if (omitted.has(o.fechaProgramada)) return true
      return !wantedSet.has(o.fechaProgramada)
    })
    .map((o) => o.id)
  if (toDelete.length) await db.ocurrencias.bulkDelete(toDelete)

  const now = Date.now()
  const toAdd: Ocurrencia[] = wanted
    .filter((fecha) => !existingDates.has(fecha) && !frozenDates.has(fecha))
    .map((fecha) => ({
      id: createId(),
      fichaId: ficha.id,
      fechaProgramada: fecha,
      estado: 'pendiente',
      origen: 'programada',
      createdAt: now,
      updatedAt: now,
    }))
  if (toAdd.length) await db.ocurrencias.bulkAdd(toAdd)
}

export async function refreshEstados(): Promise<void> {
  const today = todayISO()
  const occs = await db.ocurrencias.toArray()
  const fichas = await db.fichas.toArray()
  const precisionByFicha: Record<string, FechaPrecision> = {}
  for (const f of fichas) {
    precisionByFicha[f.id] = f.fechaPrecision === 'dia' ? 'dia' : 'mes'
  }
  const ejecuciones = await db.ejecuciones.toArray()
  const executed = new Set(
    ejecuciones.map((e) => e.ocurrenciaId).filter((id): id is string => Boolean(id)),
  )
  const updates: Ocurrencia[] = []
  for (const o of occs) {
    if (o.estadoFijado) continue
    const estado = computeEstado(
      o.fechaProgramada,
      today,
      executed.has(o.id),
      precisionByFicha[o.fichaId] ?? 'mes',
    )
    if (estado !== o.estado) {
      updates.push({ ...o, estado, updatedAt: Date.now() })
    }
  }
  if (updates.length) await db.ocurrencias.bulkPut(updates)
  await refreshEventoEstados()
}

export async function ensureHorizon(): Promise<void> {
  const fichas = await db.fichas.toArray()
  for (const ficha of fichas) {
    await syncOcurrenciasForFicha(ficha)
  }
  await syncAllActividades()
  await refreshEstados()
}

export async function addInspeccionExtraordinaria(
  ficha: Ficha,
  fecha: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const fechaNorm = normalizeISODate(fecha)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNorm)) {
    return { ok: false, error: 'Indica una fecha válida.' }
  }
  const dup = await db.ocurrencias
    .where('[fichaId+fechaProgramada]')
    .equals([ficha.id, fechaNorm])
    .first()
  if (dup) {
    return { ok: false, error: 'Ya hay una inspección en esa fecha.' }
  }
  const now = Date.now()
  const occ: Ocurrencia = {
    id: createId(),
    fichaId: ficha.id,
    fechaProgramada: fechaNorm,
    estado: computeEstado(fechaNorm, todayISO(), false, ficha.fechaPrecision ?? 'mes'),
    origen: 'extraordinaria',
    createdAt: now,
    updatedAt: now,
  }
  await db.ocurrencias.add(occ)
  return { ok: true, id: occ.id }
}

export async function deleteOcurrencia(ocurrenciaId: string): Promise<string | undefined> {
  const occ = await db.ocurrencias.get(ocurrenciaId)
  if (!occ) return undefined
  await db.transaction(
    'rw',
    [db.fichas, db.ocurrencias, db.ejecuciones, db.adjuntos],
    async () => {
      const ficha = await db.fichas.get(occ.fichaId)
      if (ficha && esOcurrenciaProgramada(occ)) {
        const omitted = omittedSet(ficha)
        omitted.add(occ.fechaProgramada)
        await db.fichas.update(ficha.id, {
          fechasOmitidas: [...omitted].sort(),
          updatedAt: Date.now(),
        })
      }
      await cascadeDeleteOcurrencias([occ])
    },
  )
  return occ.fichaId
}

export async function aplicarDesdeFecha(
  fichaId: string,
  desde: string,
  accion: { tipo: 'fijar'; estado: EstadoOcurrencia } | { tipo: 'eliminar' },
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const desdeNorm = normalizeISODate(desde)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeNorm)) {
    return { ok: false, error: 'Indica una fecha válida.' }
  }
  const ficha = await db.fichas.get(fichaId)
  if (!ficha) return { ok: false, error: 'Ficha no encontrada.' }
  const precision = ficha.fechaPrecision === 'dia' ? 'dia' : 'mes'
  const occs = await db.ocurrencias.where('fichaId').equals(fichaId).toArray()
  const posteriores = ocurrenciasDesdeFecha(occs, desdeNorm, precision)
  if (!posteriores.length) {
    return { ok: false, error: 'No hay inspecciones desde esa fecha.' }
  }

  if (accion.tipo === 'fijar') {
    const now = Date.now()
    await db.ocurrencias.bulkPut(
      posteriores.map((o) => ({
        ...o,
        estado: accion.estado,
        estadoFijado: true,
        updatedAt: now,
      })),
    )
    return { ok: true, count: posteriores.length }
  }

  await db.transaction(
    'rw',
    [db.fichas, db.ocurrencias, db.ejecuciones, db.adjuntos],
    async () => {
      const current = (await db.fichas.get(fichaId)) ?? ficha
      const omitted = omittedSet(current)
      for (const o of posteriores) {
        if (esOcurrenciaProgramada(o)) omitted.add(o.fechaProgramada)
      }
      await db.fichas.update(fichaId, {
        fechasOmitidas: [...omitted].sort(),
        updatedAt: Date.now(),
      })
      await cascadeDeleteOcurrencias(posteriores)
    },
  )
  return { ok: true, count: posteriores.length }
}

export async function deleteFichaCascade(fichaId: string): Promise<void> {
  const occs = await db.ocurrencias.where('fichaId').equals(fichaId).toArray()
  const occIds = occs.map((o) => o.id)
  const acciones = await db.accionesCorrectivas.where('fichaId').equals(fichaId).toArray()
  const accionIds = acciones.map((a) => a.id)
  const ejecucionesOcc =
    occIds.length === 0
      ? []
      : await db.ejecuciones.where('ocurrenciaId').anyOf(occIds).toArray()
  const ejecucionesAcc =
    accionIds.length === 0
      ? []
      : await db.ejecuciones.where('accionId').anyOf(accionIds).toArray()
  const ejecIds = [...ejecucionesOcc, ...ejecucionesAcc].map((e) => e.id)

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
      if (accionIds.length) await db.ejecuciones.where('accionId').anyOf(accionIds).delete()
      await db.accionesCorrectivas.where('fichaId').equals(fichaId).delete()
      await db.adjuntos.where('fichaId').equals(fichaId).delete()
      if (ejecIds.length) await db.adjuntos.where('ejecucionId').anyOf(ejecIds).delete()
    },
  )
}
