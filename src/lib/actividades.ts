import type { Actividad, EstadoOcurrencia, TipoActividad, TipoActividadDef } from '../db/types'
import { tipoActividadLabel, tipoActividadOf } from '../db/types'

const ESTADO_RANK: Record<EstadoOcurrencia, number> = {
  vencida: 0,
  pendiente: 1,
  proxima: 2,
  planificada: 3,
  ejecutada: 4,
}

export function actividadTitulo(
  actividad: Pick<Actividad, 'titulo' | 'tipo'>,
  extras?: TipoActividadDef[],
): string {
  return actividad.titulo?.trim() || tipoActividadLabel(actividad.tipo, extras)
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

export function eventoVigente<T extends { estado: EstadoOcurrencia; fechaProgramada?: string }>(
  eventos: T[],
): T | undefined {
  if (!eventos.length) return undefined
  return [...eventos].sort((a, b) => {
    const byEstado = ESTADO_RANK[a.estado] - ESTADO_RANK[b.estado]
    if (byEstado) return byEstado
    return (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? '')
  })[0]
}

export function estadoVigente(
  eventos: { estado: EstadoOcurrencia; fechaProgramada?: string }[],
): EstadoOcurrencia | undefined {
  return eventoVigente(eventos)?.estado
}
