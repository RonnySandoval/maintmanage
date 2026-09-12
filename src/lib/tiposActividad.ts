import { db } from '../db'
import {
  humanizeTipoActividad,
  TIPOS_ACTIVIDAD,
  tipoActividadColor,
  type TipoActividadDef,
} from '../db/types'
import { BLOQUE_PALETTE } from './colors'
import { queueDataTouch } from './changeTracker'

export function slugTipoActividad(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return slug || `tipo_${Date.now().toString(36)}`
}

export function mergeTiposActividad(
  extras?: TipoActividadDef[] | null,
  usados?: string[] | null,
): TipoActividadDef[] {
  const map = new Map<string, TipoActividadDef>()
  for (const tipo of TIPOS_ACTIVIDAD) map.set(tipo.id, tipo)
  for (const tipo of extras ?? []) {
    const id = tipo?.id?.trim()
    if (!id) continue
    map.set(id, {
      id,
      label: tipo.label?.trim() || id,
      color: tipo.color || tipoActividadColor(id),
    })
  }
  for (const raw of usados ?? []) {
    const id = raw?.trim()
    if (!id || map.has(id)) continue
    map.set(id, {
      id,
      label: humanizeTipoActividad(id),
      color: tipoActividadColor(id),
    })
  }
  return [...map.values()]
}

export async function addTipoActividad(label: string): Promise<TipoActividadDef> {
  const name = label.trim()
  if (!name) throw new Error('Escribe el nombre del tipo.')
  const ajustes = await db.ajustes.get('app')
  const extras = ajustes?.tiposActividad ?? []
  const existing = mergeTiposActividad(extras)
  const same = existing.find((t) => t.label.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)
  if (same) return same

  let id = slugTipoActividad(name)
  let n = 2
  while (existing.some((t) => t.id === id)) {
    id = `${slugTipoActividad(name)}_${n}`
    n += 1
  }
  const usedColors = new Set(existing.map((t) => t.color))
  const created: TipoActividadDef = {
    id,
    label: name,
    color: BLOQUE_PALETTE.find((c) => !usedColors.has(c.id))?.id ?? tipoActividadColor(id),
  }
  if (ajustes) {
    await db.ajustes.update('app', { tiposActividad: [...extras, created] })
  } else {
    await db.ajustes.put({
      id: 'app',
      umbralProximaDias: 7,
      notificaciones: false,
      autoBackup: true,
      tiposActividad: [created],
    })
  }
  queueDataTouch(db)
  return created
}
