import {
  BACKUP_INTERVAL_MS,
  downloadBlob,
  exportBackup,
  getUsableBackupFolder,
  hasUserData,
  markBackupDone,
  writeBackupToFolder,
} from '../db/backup'
import { db } from '../db'

export type AutoBackupStatus = 'skipped' | 'saved-folder' | 'pending-download' | 'error'

export interface AutoBackupResult {
  status: AutoBackupStatus
  message?: string
}

let inFlight: Promise<AutoBackupResult> | null = null

function backupNeeded(
  now: number,
  lastBackupAt: number | undefined,
  lastChangedAt: number | undefined,
): boolean {
  if (!lastBackupAt) return true
  if (now - lastBackupAt < BACKUP_INTERVAL_MS) return false
  if (lastChangedAt && lastChangedAt <= lastBackupAt) return false
  return true
}

async function runAutoBackupUnlocked(): Promise<AutoBackupResult> {
  const ajustes = await db.ajustes.get('app')
  if (!ajustes || ajustes.autoBackup === false) {
    return { status: 'skipped' }
  }
  if (!(await hasUserData())) {
    return { status: 'skipped' }
  }

  const now = Date.now()
  if (!backupNeeded(now, ajustes.lastBackupAt, ajustes.lastChangedAt)) {
    return { status: 'skipped' }
  }

  const folder = await getUsableBackupFolder()
  if (folder) {
    try {
      await writeBackupToFolder(folder)
      return { status: 'saved-folder', message: 'Copia actualizada en la carpeta de respaldo.' }
    } catch (err) {
      return {
        status: 'pending-download',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo escribir en la carpeta. Guarda el ZIP a mano.',
      }
    }
  }

  return {
    status: 'pending-download',
    message:
      'Hay datos nuevos sin copia fuera del navegador. Guárdala ahora para no perderla si se borra la app.',
  }
}

export function runAutoBackupIfDue(): Promise<AutoBackupResult> {
  if (!inFlight) {
    inFlight = runAutoBackupUnlocked().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

export async function saveBackupNow(): Promise<{ kind: 'folder' | 'download'; size: number }> {
  const folder = await getUsableBackupFolder()
  if (folder) {
    const size = await writeBackupToFolder(folder)
    return { kind: 'folder', size }
  }
  const { blob, filename } = await exportBackup()
  downloadBlob(blob, filename)
  await markBackupDone('download')
  return { kind: 'download', size: blob.size }
}
