import {
  downloadBlob,
  exportBackupZip,
  getUsableBackupFolder,
  hasUserData,
  markBackupDone,
  nextBackupAtOf,
  writeBackupToFolder,
} from '../db/backup'
import { formatBytes } from './dates'
import { db } from '../db'

export type SaveBackupProgress = 'collect' | 'pack' | 'save'

export type AutoBackupRunStatus = 'saved-folder' | 'saved-download' | 'error'

export interface AutoBackupResult {
  status: AutoBackupRunStatus
  message?: string
}

/** Resultado del chequeo previo: si la copia automática debe ejecutarse ahora. */
export type AutoBackupCheck =
  | { status: 'disabled' }
  | { status: 'no-data' }
  | { status: 'fresh' }
  | { status: 'not-due' }
  | { status: 'due' }

function backupNeeded(
  now: number,
  lastBackupAt: number | undefined,
  lastChangedAt: number | undefined,
  dueAt: number,
): boolean {
  if (!lastBackupAt) return true
  if (now < dueAt) return false
  if (lastChangedAt && lastChangedAt <= lastBackupAt) return false
  return true
}

/**
 * Comprueba (sin ejecutar) si la copia automática toca ahora: está activada,
 * hay datos, hay cambios desde la última copia y ya llegó la hora.
 */
export async function checkAutoBackup(now = Date.now()): Promise<AutoBackupCheck> {
  const ajustes = await db.ajustes.get('app')
  if (!ajustes || ajustes.autoBackup === false) return { status: 'disabled' }
  if (!(await hasUserData())) return { status: 'no-data' }

  const dueAt = nextBackupAtOf(ajustes, now)
  if (!backupNeeded(now, ajustes.lastBackupAt, ajustes.lastChangedAt, dueAt)) {
    return !ajustes.lastChangedAt ||
      (ajustes.lastBackupAt != null && ajustes.lastChangedAt <= ajustes.lastBackupAt)
      ? { status: 'fresh' }
      : { status: 'not-due' }
  }
  return { status: 'due' }
}

/**
 * Ejecuta la copia automática en segundo plano, sin preguntar al usuario:
 * si hay una carpeta vinculada escribe ahí; si no, descarga el ZIP completo
 * (datos + fotos) a Descargas. Usa los datos tal cual están en el momento en
 * que arranca («a partir del último cambio antes de empezar»).
 */
export async function runAutoBackupNow(
  onProgress?: (step: SaveBackupProgress) => void,
): Promise<AutoBackupResult> {
  onProgress?.('collect')

  const folder = await getUsableBackupFolder()
  if (folder) {
    onProgress?.('pack')
    onProgress?.('save')
    try {
      const size = await writeBackupToFolder(folder)
      return {
        status: 'saved-folder',
        message: `Copia actualizada en la carpeta (${formatBytes(size)}).`,
      }
    } catch (err) {
      return {
        status: 'error',
        message:
          err instanceof Error
            ? `No se pudo escribir en la carpeta: ${err.message}`
            : 'No se pudo escribir en la carpeta de respaldo.',
      }
    }
  }

  onProgress?.('pack')
  const { blob, filename } = await exportBackupZip()
  onProgress?.('save')
  downloadBlob(blob, filename)
  await markBackupDone('download')
  return {
    status: 'saved-download',
    message: `Copia descargada como ZIP (${formatBytes(blob.size)}). Guárdala en un lugar seguro.`,
  }
}

export async function saveBackupNow(
  onProgress?: (step: SaveBackupProgress) => void,
): Promise<{ kind: 'folder' | 'zip'; size: number }> {
  onProgress?.('collect')
  onProgress?.('pack')
  const folder = await getUsableBackupFolder()
  if (folder) {
    onProgress?.('save')
    const size = await writeBackupToFolder(folder)
    return { kind: 'folder', size }
  }
  onProgress?.('save')
  const { blob, filename } = await exportBackupZip()
  downloadBlob(blob, filename)
  await markBackupDone('zip')
  return { kind: 'zip', size: blob.size }
}