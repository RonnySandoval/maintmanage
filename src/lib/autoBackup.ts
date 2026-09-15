import {
  downloadBlob,
  exportBackupZip,
  getUsableBackupFolder,
  hasUserData,
  markBackupDone,
  nextBackupAtOf,
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
  dueAt: number,
): boolean {
  if (!lastBackupAt) return true
  if (now < dueAt) return false
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
  const dueAt = nextBackupAtOf(ajustes, now)
  if (!backupNeeded(now, ajustes.lastBackupAt, ajustes.lastChangedAt, dueAt)) {
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

export type SaveBackupProgress = 'collect' | 'pack' | 'save'

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
