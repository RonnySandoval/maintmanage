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
  /**
   * Borra una copia remota.
   * True si se eliminó de forma permanente; false si solo se pudo mover a la
   * papelera (p. ej. Gmail sin permiso de borrado definitivo).
   */
  deleteBackup(remoteId: string): Promise<boolean>
}
