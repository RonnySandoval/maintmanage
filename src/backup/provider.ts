import type { BackupKind, BackupManifest } from './types'

/** Referencia a una copia almacenada en un proveedor remoto (p. ej. Gmail). */
export interface RemoteBackupRef {
  remoteId: string
  backupId: string
  createdAt: string
  size: number
  checksum?: string
  deviceName?: string
  deviceId?: string
  platform?: string
  kind?: BackupKind
  subject: string
}

/**
 * Interfaz abstracta del proveedor de copias en la nube.
 * Fase 4: GmailBackupProvider. Futuro: Drive, etc.
 */
export interface BackupProvider {
  authenticate(): Promise<void>
  isAuthenticated(): boolean
  createBackup(blob: Blob, meta: BackupManifest): Promise<RemoteBackupRef>
  listBackups(): Promise<RemoteBackupRef[]>
  downloadBackup(remoteId: string): Promise<Blob>
  deleteBackup(remoteId: string): Promise<void>
}
