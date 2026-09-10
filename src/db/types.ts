export type Frecuencia = 'semanal' | 'mensual' | 'trimestral' | 'anual' | 'unica'

export type EstadoOcurrencia = 'pendiente' | 'proxima' | 'vencida' | 'ejecutada'

export type EstadoCorrectiva = 'pendiente' | 'programada' | 'ejecutada'

export type TipoAdjunto = 'ficha' | 'ejecucion' | 'manual'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Encargado {
  id: string
  nombre: string
  contacto?: string
  createdAt: number
  updatedAt: number
}

export interface Grupo {
  id: string
  nombre: string
  color: string
  createdAt: number
  updatedAt: number
}

export interface Ficha {
  id: string
  nombre: string
  grupoId: string
  encargadoId: string
  frecuencia: Frecuencia
  fechaInicio: string
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
}

export const FRECUENCIAS: { id: Frecuencia; label: string }[] = [
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensual', label: 'Mensual' },
  { id: 'trimestral', label: 'Trimestral' },
  { id: 'anual', label: 'Anual' },
  { id: 'unica', label: 'Única' },
]

export const ESTADOS: { id: EstadoOcurrencia; label: string }[] = [
  { id: 'vencida', label: 'Vencida' },
  { id: 'proxima', label: 'Próxima' },
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'ejecutada', label: 'Ejecutada' },
]

export const ESTADOS_CORRECTIVA: { id: EstadoCorrectiva; label: string }[] = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'programada', label: 'Programada' },
  { id: 'ejecutada', label: 'Ejecutada' },
]

export const GRUPO_COLORS = [
  '#0f766e',
  '#0369a1',
  '#7c3aed',
  '#be185d',
  '#b45309',
  '#15803d',
  '#b91c1c',
  '#4338ca',
]
