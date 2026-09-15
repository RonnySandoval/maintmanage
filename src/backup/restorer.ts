import type { SnapshotStore } from './snapshot'
import { idbSnapshotStore } from './snapshot'
import { unpackBackupZip } from './package'

export type RestoreRollbackResult =
  | { status: 'applied'; hadSnapshot: boolean }
  | { status: 'rolled_back'; cause: Error }
  | { status: 'rollback_failed'; cause: Error; rollbackError: Error }

export interface ReplaceWithRollbackOptions {
  /** Si false, no crea snapshot (p. ej. dispositivo vacío). */
  needsSnapshot: boolean
  /** Genera un ZIP completo del estado actual. */
  createSnapshotBlob: () => Promise<Blob>
  /** Aplica la copia entrante (puede fallar a mitad). */
  applyIncoming: () => Promise<void>
  /** Restaura desde el ZIP de snapshot (sin anidar otro rollback). */
  restoreSnapshotBlob: (blob: Blob) => Promise<void>
  store?: SnapshotStore
}

/**
 * Antes de sobrescribir datos:
 * 1) guarda snapshot local en IndexedDB aparte
 * 2) aplica la copia nueva
 * 3) si falla, restaura el snapshot
 *
 * El snapshot no vive en la DB principal (que se vacía en replace).
 */
export async function replaceWithRollback(
  options: ReplaceWithRollbackOptions,
): Promise<RestoreRollbackResult> {
  const store = options.store ?? idbSnapshotStore
  let hadSnapshot = false

  if (options.needsSnapshot) {
    const snapshot = await options.createSnapshotBlob()
    // Validar que el snapshot es restaurable antes de tocar datos.
    await unpackBackupZip(snapshot, { requireManifest: true })
    await store.save(snapshot)
    hadSnapshot = true
  }

  try {
    await options.applyIncoming()
    if (hadSnapshot) await store.clear()
    return { status: 'applied', hadSnapshot }
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(String(err))
    if (!hadSnapshot) throw cause

    const snapshot = await store.load()
    if (!snapshot) {
      return {
        status: 'rollback_failed',
        cause,
        rollbackError: new Error('No se encontró la copia temporal para deshacer el cambio.'),
      }
    }

    try {
      await options.restoreSnapshotBlob(snapshot)
      await store.clear()
      return { status: 'rolled_back', cause }
    } catch (rollbackErr) {
      return {
        status: 'rollback_failed',
        cause,
        rollbackError:
          rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr)),
      }
    }
  }
}

export function rollbackUserMessage(result: RestoreRollbackResult): string {
  if (result.status === 'applied') return ''
  if (result.status === 'rolled_back') {
    return `No se pudo restaurar la copia. Se recuperaron los datos anteriores. (${result.cause.message})`
  }
  return `La restauración falló y no se pudieron recuperar los datos anteriores. ${result.cause.message}`
}
