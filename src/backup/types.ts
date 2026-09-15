/** Versión del formato del paquete (manifest + reglas de integridad). */
export const BACKUP_FORMAT_VERSION = 1 as const

/**
 * Versión del esquema Dexie que este formato espera serializar.
 * Debe mantenerse alineada con `MaintDB` en `src/db/index.ts`.
 */
export const SCHEMA_VERSION = 10 as const

/** Prefijo de asunto Gmail (Fase 4). */
export const GMAIL_BACKUP_SUBJECT_TAG = '[MAINTMANAGE_BACKUP]'

export const MANIFEST_FILE_NAME = 'manifest.json'
export const PAYLOAD_FILE_NAME = 'backup.json'
export const FILES_FOLDER = 'files'

export type BackupKind = 'manual' | 'auto'

export interface BackupMetadata {
  backupFormatVersion: typeof BACKUP_FORMAT_VERSION
  backupId: string
  createdAt: string
  appVersion: string
  schemaVersion: number
  payloadVersion: 1
  deviceId: string
  deviceName: string
  platform: string
  /** Marca de datos (p. ej. `lastChangedAt`); sirve para evitar copias idénticas. */
  dataVersion: number
  /** SHA-256 hex del contenido (payload + archivos), no del ZIP completo. */
  checksum: string
  size: number
  kind: BackupKind
  /** Número de adjuntos incluidos. */
  attachmentCount: number
}

export interface BackupManifest extends BackupMetadata {
  /** Reservado para migraciones futuras del empaquetado. */
  notes?: string
}

export type BackupValidationIssueCode =
  | 'missing_payload'
  | 'invalid_payload'
  | 'unsupported_payload_version'
  | 'unsupported_format_version'
  | 'unsupported_schema_version'
  | 'checksum_mismatch'
  | 'incomplete_attachments'
  | 'corrupt_archive'
  | 'invalid_manifest'

export interface BackupValidationIssue {
  code: BackupValidationIssueCode
  message: string
}

export interface BackupValidationResult {
  ok: boolean
  issues: BackupValidationIssue[]
  /** Presente si el ZIP trae manifest (copias nuevas). */
  manifest: BackupManifest | null
  /** true si es una copia anterior a Fase 1 (sin manifest). */
  legacy: boolean
}

export interface BuildManifestInput {
  backupId?: string
  createdAt?: string
  appVersion: string
  schemaVersion?: number
  deviceId: string
  deviceName: string
  platform: string
  dataVersion: number
  checksum: string
  size: number
  kind: BackupKind
  attachmentCount: number
}
