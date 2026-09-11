export type Frecuencia =
  | 'unica'
  | 'cada_1'
  | 'cada_2'
  | 'cada_3'
  | 'cada_4'
  | 'cada_5'
  | 'cada_6'
  | 'cada_7'
  | 'cada_8'
  | 'cada_9'
  | 'cada_10'
  | 'cada_11'
  | 'cada_12'

export type FechaPrecision = 'mes' | 'dia'

/** pendiente = mes actual; proxima = resto del trimestre; planificada = más allá del trimestre */
export type EstadoOcurrencia = 'pendiente' | 'proxima' | 'planificada' | 'vencida' | 'ejecutada'

export type EstadoCorrectiva = 'pendiente' | 'programada' | 'ejecutada'

export type TipoAccion = 'correctiva' | 'recomendacion'

export type TipoAdjunto = 'ficha' | 'ejecucion' | 'manual'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Encargado {
  id: string
  nombre: string
  contacto?: string
  telefonos?: string
  congregacion?: string
  createdAt: number
  updatedAt: number
}

export interface Bloque {
  id: string
  nombre: string
  color: string
  createdAt: number
  updatedAt: number
}

/** @deprecated Usar Bloque. Se mantiene el alias por copias de seguridad antiguas. */
export type Grupo = Bloque

export interface Ficha {
  id: string
  numero: string
  nombre: string
  grupoId: string
  encargadoId?: string
  telefonos?: string
  frecuencia: Frecuencia
  fechaInicio: string
  fechaPrecision: FechaPrecision
  notas?: string
  createdAt: number
  updatedAt: number
}

export interface Ocurrencia {
  id: string
  fichaId: string
  fechaProgramada: string
  estado: EstadoOcurrencia
  createdAt: number
  updatedAt: number
}

export interface Ejecucion {
  id: string
  ocurrenciaId: string
  fechaReal: string
  observaciones?: string
  createdAt: number
  updatedAt: number
}

export interface AccionCorrectiva {
  id: string
  fichaId: string
  ocurrenciaId?: string
  tipo: TipoAccion
  texto: string
  estado: EstadoCorrectiva
  fechaObjetivo?: string
  createdAt: number
  updatedAt: number
}

export interface Adjunto {
  id: string
  blob: Blob
  mimeType: string
  nombre: string
  fichaId?: string
  ejecucionId?: string
  tipo: TipoAdjunto
  createdAt: number
}

export interface Ajustes {
  id: 'app'
  umbralProximaDias: number
  notificaciones: boolean
  lastNotifiedDate?: string
  /** Copia automática al abrir la app (máximo 2 veces al día si hay cambios). */
  autoBackup?: boolean
  /** Última mutación de datos de usuario (fichas, fotos, etc.). */
  lastChangedAt?: number
  lastBackupAt?: number
  lastBackupKind?: 'folder' | 'download'
  backupFolderName?: string
}

export const FRECUENCIAS: { id: Frecuencia; label: string; meses: number }[] = [
  { id: 'unica', label: 'Única', meses: 0 },
  { id: 'cada_1', label: 'Cada 1 mes', meses: 1 },
  { id: 'cada_2', label: 'Cada 2 meses', meses: 2 },
  { id: 'cada_3', label: 'Cada 3 meses', meses: 3 },
  { id: 'cada_4', label: 'Cada 4 meses', meses: 4 },
  { id: 'cada_5', label: 'Cada 5 meses', meses: 5 },
  { id: 'cada_6', label: 'Cada 6 meses', meses: 6 },
  { id: 'cada_7', label: 'Cada 7 meses', meses: 7 },
  { id: 'cada_8', label: 'Cada 8 meses', meses: 8 },
  { id: 'cada_9', label: 'Cada 9 meses', meses: 9 },
  { id: 'cada_10', label: 'Cada 10 meses', meses: 10 },
  { id: 'cada_11', label: 'Cada 11 meses', meses: 11 },
  { id: 'cada_12', label: 'Cada 12 meses', meses: 12 },
]

export function frecuenciaLabel(id: string): string {
  return FRECUENCIAS.find((f) => f.id === id)?.label ?? id
}

export function mesesDeFrecuencia(freq: string): number {
  const found = FRECUENCIAS.find((f) => f.id === freq)
  if (found) return found.meses
  if (freq === 'semanal' || freq === 'mensual') return 1
  if (freq === 'trimestral') return 3
  if (freq === 'anual') return 12
  return 1
}

export function normalizeFrecuencia(freq: string): Frecuencia {
  if (FRECUENCIAS.some((f) => f.id === freq)) return freq as Frecuencia
  if (freq === 'trimestral') return 'cada_3'
  if (freq === 'anual') return 'cada_12'
  if (freq === 'unica') return 'unica'
  return 'cada_1'
}

export const ESTADOS: { id: EstadoOcurrencia; label: string }[] = [
  { id: 'vencida', label: 'Vencida' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'proxima', label: 'Programada' },
  { id: 'planificada', label: 'Planificada' },
  { id: 'ejecutada', label: 'Ejecutada' },
]

export const ESTADOS_CORRECTIVA: { id: EstadoCorrectiva; label: string }[] = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'programada', label: 'Programada' },
  { id: 'ejecutada', label: 'Ejecutada' },
]

export function tipoAccionOf(
  accion: Pick<AccionCorrectiva, 'tipo' | 'fechaObjetivo'>,
): TipoAccion {
  if (accion.tipo === 'recomendacion' || accion.tipo === 'correctiva') return accion.tipo
  return accion.fechaObjetivo ? 'correctiva' : 'recomendacion'
}

export function tipoAccionLabel(tipo: TipoAccion): string {
  return tipo === 'recomendacion' ? 'Recomendación' : 'Acción correctiva'
}

export { BLOQUE_COLORS, GRUPO_COLORS } from '../lib/colors'
