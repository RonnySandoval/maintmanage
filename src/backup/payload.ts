import type {
  AccionCorrectiva,
  Actividad,
  Adjunto,
  Ajustes,
  Encargado,
  Ejecucion,
  Evento,
  Bloque,
  Ficha,
  Nota,
  Ocurrencia,
} from '../db/types'

export type AdjuntoMeta = Omit<Adjunto, 'blob'>

/** Payload de datos dentro de backup.json (versión de contenido). */
export interface BackupPayload {
  version: 1
  exportedAt: string
  encargados: Encargado[]
  grupos: Bloque[]
  bloques?: Bloque[]
  fichas: Ficha[]
  ocurrencias: Ocurrencia[]
  ejecuciones: Ejecucion[]
  accionesCorrectivas: AccionCorrectiva[]
  actividades?: Actividad[]
  eventos?: Evento[]
  notas?: Nota[]
  ajustes: Ajustes[]
  adjuntosMeta: AdjuntoMeta[]
}

export function assertPayload(payload: BackupPayload): void {
  if (!payload || payload.version !== 1) {
    throw new Error('Versión de copia no compatible.')
  }
}
