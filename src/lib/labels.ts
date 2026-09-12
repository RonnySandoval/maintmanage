import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { TipoAccion } from '../db/types'

export const ALIAS_KEYS = [
  'trimestre',
  'accion_correctiva',
  'recomendacion',
  'reparacion',
  'compra',
  'limpieza',
  'capacitacion',
  'inspeccion',
] as const

export type AliasKey = (typeof ALIAS_KEYS)[number]

export type AliasMap = Partial<Record<AliasKey, string>>

export const DEFAULT_ALIASES: Record<AliasKey, string> = {
  trimestre: 'Trimestre',
  accion_correctiva: 'Acción correctiva',
  recomendacion: 'Recomendación',
  reparacion: 'Reparación',
  compra: 'Compra',
  limpieza: 'Limpieza',
  capacitacion: 'Capacitación',
  inspeccion: 'Inspección',
}

export const ALIAS_FIELDS: { id: AliasKey; hint: string }[] = [
  { id: 'trimestre', hint: 'Dashboard y estados de la ficha' },
  { id: 'accion_correctiva', hint: 'Fichas, cronograma e histórico' },
  { id: 'recomendacion', hint: 'Acciones sin fecha límite' },
  { id: 'reparacion', hint: 'Tipo de actividad' },
  { id: 'compra', hint: 'Tipo de actividad' },
  { id: 'limpieza', hint: 'Tipo de actividad' },
  { id: 'capacitacion', hint: 'Tipo de actividad' },
  { id: 'inspeccion', hint: 'Tipo de actividad' },
]

export function label(key: AliasKey, aliases?: AliasMap | null): string {
  const custom = aliases?.[key]
  if (custom === undefined) return DEFAULT_ALIASES[key]
  return custom
}

export function isAliasKey(id: string): id is AliasKey {
  return (ALIAS_KEYS as readonly string[]).includes(id)
}

export function applyTipoAliases<T extends { id: string; label: string }>(
  tipos: T[],
  aliases?: AliasMap | null,
): T[] {
  if (!aliases) return tipos
  return tipos.map((tipo) => {
    if (!isAliasKey(tipo.id)) return tipo
    const custom = aliases[tipo.id]
    return custom !== undefined ? { ...tipo, label: custom } : tipo
  })
}

export function accionLabel(tipo: TipoAccion, aliases?: AliasMap | null): string {
  return tipo === 'recomendacion'
    ? label('recomendacion', aliases)
    : label('accion_correctiva', aliases)
}

export function accionesTitulo(onlyCorrectiva: boolean, aliases?: AliasMap | null): string {
  const acc = label('accion_correctiva', aliases)
  const rec = label('recomendacion', aliases)
  if (onlyCorrectiva) {
    return acc === DEFAULT_ALIASES.accion_correctiva ? 'Acciones correctivas' : acc
  }
  if (acc === DEFAULT_ALIASES.accion_correctiva && rec === DEFAULT_ALIASES.recomendacion) {
    return 'Acciones y recomendaciones'
  }
  return `${acc} y ${rec}`
}

export function useAliases(): AliasMap {
  const ajustes = useLiveQuery(() => db.ajustes.get('app'))
  return ajustes?.aliases ?? {}
}

export function useLabel(): (key: AliasKey) => string {
  const aliases = useAliases()
  return (key) => label(key, aliases)
}
