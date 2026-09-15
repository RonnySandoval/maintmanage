import { db } from '../db'
import { importBackup, markBackupDone } from '../db/backup'
import { ensureHorizon } from '../db/occurrences'
import { getGmailBackupProvider } from '../google/GmailBackupProvider'
import { packAndVerify } from './verify'
import { unpackBackupZip } from './package'
import type { RemoteBackupRef } from './provider'

export type CloudBackupProgress =
  | 'preparing'
  | 'compressing'
  | 'uploading'
  | 'done'
  | 'error'

export type CloudRestoreProgress =
  | 'downloading'
  | 'validating'
  | 'restoring'
  | 'done'
  | 'error'

export type RestoreFromGmailDeps = {
  download?: (remoteId: string) => Promise<Blob>
  importFile?: (file: Blob) => Promise<unknown>
  afterRestore?: () => Promise<void>
}

/**
 * Empaqueta IndexedDB y sube la copia a Gmail del usuario autenticado.
 */
export async function uploadBackupToGmail(
  onProgress?: (step: CloudBackupProgress) => void,
): Promise<RemoteBackupRef> {
  const provider = getGmailBackupProvider()
  if (!provider.isAuthenticated()) {
    onProgress?.('preparing')
    await provider.authenticate()
  }

  onProgress?.('preparing')
  const adjuntos = await db.adjuntos.toArray()
  const payload = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    encargados: await db.encargados.toArray(),
    grupos: await db.grupos.toArray(),
    bloques: await db.grupos.toArray(),
    fichas: await db.fichas.toArray(),
    ocurrencias: await db.ocurrencias.toArray(),
    ejecuciones: await db.ejecuciones.toArray(),
    accionesCorrectivas: await db.accionesCorrectivas.toArray(),
    actividades: await db.actividades.toArray(),
    eventos: await db.eventos.toArray(),
    ajustes: await db.ajustes.toArray(),
    adjuntosMeta: adjuntos.map((adjunto) => ({
      id: adjunto.id,
      mimeType: adjunto.mimeType,
      nombre: adjunto.nombre,
      fichaId: adjunto.fichaId,
      actividadId: adjunto.actividadId,
      ejecucionId: adjunto.ejecucionId,
      tipo: adjunto.tipo,
      etiquetas: adjunto.etiquetas,
      createdAt: adjunto.createdAt,
    })),
  }

  onProgress?.('compressing')
  const { packed, size } = await packAndVerify(payload, adjuntos, { kind: 'manual' })
  if (size.status === 'too_large') {
    throw new Error(size.message ?? 'La copia es demasiado grande para Gmail.')
  }

  onProgress?.('uploading')
  const ref = await provider.createBackup(packed.blob, packed.manifest)
  await markBackupDone('gmail')
  onProgress?.('done')
  return ref
}

export async function listGmailBackups(): Promise<RemoteBackupRef[]> {
  const provider = getGmailBackupProvider()
  if (!provider.isAuthenticated()) await provider.authenticate()
  return provider.listBackups()
}

export async function downloadGmailBackup(remoteId: string): Promise<Blob> {
  const provider = getGmailBackupProvider()
  if (!provider.isAuthenticated()) await provider.authenticate()
  return provider.downloadBackup(remoteId)
}

/**
 * Descarga una copia de Gmail, valida integridad y restaura IndexedDB
 * (con snapshot/rollback vía `importBackup` replace).
 */
export async function restoreFromGmail(
  remoteId: string,
  onProgress?: (step: CloudRestoreProgress) => void,
  deps: RestoreFromGmailDeps = {},
): Promise<void> {
  const download = deps.download ?? downloadGmailBackup
  const importFile = deps.importFile ?? ((file: Blob) => importBackup(file, 'replace'))
  const afterRestore = deps.afterRestore ?? (() => ensureHorizon())

  try {
    onProgress?.('downloading')
    const blob = await download(remoteId)

    onProgress?.('validating')
    await unpackBackupZip(blob, { requireManifest: true })

    onProgress?.('restoring')
    await importFile(blob)
    await afterRestore()
    onProgress?.('done')
  } catch (err) {
    onProgress?.('error')
    throw err
  }
}
