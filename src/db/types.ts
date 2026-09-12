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

export type PrioridadAccion = 'alta' | 'media' | 'baja'

export type TipoAdjunto = 'ficha' | 'ejecucion' | 'manual' | 'actividad'

export type TipoActividad = string

export interface TipoActividadDef {
  id: string
  label: string
  color: string
}

export type OrigenOcurrencia = 'programada' | 'extraordinaria'

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
  /** Fechas de inspecciones programadas que no deben regenerarse. */
  fechasOmitidas?: string[]
  createdAt: number
  updatedAt: number
}

export interface Ocurrencia {
  id: string
  fichaId: string
  fechaProgramada: string
  estado: EstadoOcurrencia
  origen?: OrigenOcurrencia
  /** Si es true, refreshEstados no recalcula el estado. */
  estadoFijado?: boolean
  createdAt: number
  updatedAt: number
}

export interface Ejecucion {
  id: string
  ocurrenciaId?: string
  eventoId?: string
  accionId?: string
  fechaReal: string
  observaciones?: string
  realizadoPor?: string
  createdAt: number
  updatedAt: number
}

export interface Actividad {
  id: string
  tipo: TipoActividad
  titulo: string
  encargadoId?: string
  frecuencia: Frecuencia
  fechaInicio: string
  fechaPrecision: FechaPrecision
  notas?: string
  fechasOmitidas?: string[]
  createdAt: number
  updatedAt: number
}

export interface Evento {
  id: string
  actividadId: string
  fechaProgramada: string
  estado: EstadoOcurrencia
  origen?: OrigenOcurrencia
  estadoFijado?: boolean
  createdAt: number
  updatedAt: number
}

export interface AccionCorrectiva {
  id: string
  fichaId?: string
  ocurrenciaId?: string
  actividadId?: string
  eventoId?: string
  tipo: TipoAccion
  texto: string
  estado: EstadoCorrectiva
  fechaObjetivo?: string
  prioridad?: PrioridadAccion
  createdAt: number
  updatedAt: number
}

export interface Adjunto {
  id: string
  blob: Blob
  mimeType: string
  nombre: string
  fichaId?: string
  actividadId?: string
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
  /** Tipos de actividad añadidos por el usuario. */
  tiposActividad?: TipoActividadDef[]
  /** Horas entre copias automáticas. Por defecto 12. */
  backupIntervalHours?: number
  /** Si está fijada, la copia automática espera a esta fecha. */
  nextBackupAt?: number
  /** Nombres visibles (trimestre, acción correctiva, tipos de actividad…). */
  aliases?: Partial<Record<string, string>>
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

export const PRIORIDADES: { id: PrioridadAccion; label: string }[] = [
  { id: 'alta', label: 'Alta' },
  { id: 'media', label: 'Media' },
  { id: 'baja', label: 'Baja' },
]

export function prioridadOf(accion: Pick<AccionCorrectiva, 'prioridad'>): PrioridadAccion {
  if (accion.prioridad === 'alta' || accion.prioridad === 'baja') return accion.prioridad
  return 'media'
}

export function prioridadLabel(prioridad: PrioridadAccion): string {
  return PRIORIDADES.find((p) => p.id === prioridad)?.label ?? prioridad
}

export function prioridadRank(prioridad: PrioridadAccion): number {
  if (prioridad === 'alta') return 0
  if (prioridad === 'media') return 1
  return 2
}

export function tipoAccionOf(
  accion: Pick<AccionCorrectiva, 'tipo' | 'fechaObjetivo'>,
): TipoAccion {
  if (accion.tipo === 'recomendacion' || accion.tipo === 'correctiva') return accion.tipo
  return accion.fechaObjetivo ? 'correctiva' : 'recomendacion'
}

export function tipoAccionLabel(
  tipo: TipoAccion,
  aliases?: Partial<Record<string, string>> | null,
): string {
  if (tipo === 'recomendacion') {
    return aliases?.recomendacion !== undefined && aliases.recomendacion !== ''
      ? aliases.recomendacion
      : 'Recomendación'
  }
  return aliases?.accion_correctiva !== undefined && aliases.accion_correctiva !== ''
    ? aliases.accion_correctiva
    : 'Acción correctiva'
}

export function esOcurrenciaProgramada(o: Pick<Ocurrencia, 'origen'>): boolean {
  return o.origen !== 'extraordinaria'
}

export function esExtraordinaria(o: Pick<Ocurrencia, 'origen'>): boolean {
  return o.origen === 'extraordinaria'
}

export const TIPOS_ACTIVIDAD: TipoActividadDef[] = [
  { id: 'inspeccion', label: 'Inspección', color: 'teal' },
  { id: 'reparacion', label: 'Reparación', color: 'orange' },
  { id: 'compra', label: 'Compra', color: 'amber' },
  { id: 'limpieza', label: 'Limpieza', color: 'green' },
  { id: 'capacitacion', label: 'Capacitación', color: 'indigo' },
  { id: 'otro', label: 'Otro', color: 'slate' },
]

const TIPO_COLORS = [
  'orange',
  'amber',
  'green',
  'indigo',
  'slate',
  'sky',
  'violet',
  'rose',
  'teal',
  'fuchsia',
]

export function tipoActividadOf(tipo?: string | null): TipoActividad {
  const trimmed = tipo?.trim()
  return trimmed || 'otro'
}

export function humanizeTipoActividad(id: string): string {
  const text = id.replace(/[_-]+/g, ' ').trim()
  if (!text) return 'Otro'
  return text.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function tipoActividadColor(tipo?: string | null, extras?: TipoActividadDef[]): string {
  const id = tipoActividadOf(tipo)
  const extra = extras?.find((t) => t.id === id)
  if (extra?.color) return extra.color
  const built = TIPOS_ACTIVIDAD.find((t) => t.id === id)
  if (built) return built.color
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return TIPO_COLORS[Math.abs(hash) % TIPO_COLORS.length]
}

export function tipoActividadLabel(tipo?: string | null, extras?: TipoActividadDef[]): string {
  const id = tipoActividadOf(tipo)
  const extra = extras?.find((t) => t.id === id)
  if (extra?.label) return extra.label
  return TIPOS_ACTIVIDAD.find((t) => t.id === id)?.label ?? humanizeTipoActividad(id)
}

export { BLOQUE_COLORS, GRUPO_COLORS } from '../lib/colors'
