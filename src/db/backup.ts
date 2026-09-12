import JSZip from 'jszip'
import { withoutDataTouch } from '../lib/changeTracker'
import { todayISO } from '../lib/dates'
import { clearFolderHandle, getFolderHandle, saveFolderHandle } from './folderHandle'
import { db } from './index'
import type {
  AccionCorrectiva,
  Adjunto,
  Ajustes,
  Encargado,
  Ejecucion,
  Bloque,
  Ficha,
  Ocurrencia,
} from './types'

type AdjuntoMeta = Omit<Adjunto, 'blob'>

export const BACKUP_FILE_NAME = 'maintmanage-backup.zip'
export const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000

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
  ajustes: Ajustes[]
  adjuntosMeta: AdjuntoMeta[]
}

export function canUseFolderBackup(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function hasUserData(): Promise<boolean> {
  const [fichas, encargados, grupos, adjuntos, ejecuciones] = await Promise.all([
    db.fichas.count(),
    db.encargados.count(),
    db.grupos.count(),
    db.adjuntos.count(),
    db.ejecuciones.count(),
  ])
  return fichas + encargados + grupos + adjuntos + ejecuciones > 0
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip()
  const adjuntos = await db.adjuntos.toArray()
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    encargados: await db.encargados.toArray(),
    grupos: await db.grupos.toArray(),
    bloques: await db.grupos.toArray(),
    fichas: await db.fichas.toArray(),
    ocurrencias: await db.ocurrencias.toArray(),
    ejecuciones: await db.ejecuciones.toArray(),
    accionesCorrectivas: await db.accionesCorrectivas.toArray(),
    ajustes: await db.ajustes.toArray(),
    adjuntosMeta: adjuntos.map((adjunto) => ({
      id: adjunto.id,
      mimeType: adjunto.mimeType,
      nombre: adjunto.nombre,
      fichaId: adjunto.fichaId,
      ejecucionId: adjunto.ejecucionId,
      tipo: adjunto.tipo,
      createdAt: adjunto.createdAt,
    })),
  }
  zip.file('backup.json', JSON.stringify(payload))
  const folder = zip.folder('files')
  for (const adjunto of adjuntos) {
    folder?.file(adjunto.id, adjunto.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, filename: `maintmanage-${todayISO()}.zip` }
}

export async function importBackup(file: Blob, mode: 'replace' | 'merge'): Promise<void> {
  const zip = await JSZip.loadAsync(file)
  const jsonFile = zip.file('backup.json')
  if (!jsonFile) {
    throw new Error('El archivo no es una copia de MaintManage (falta backup.json).')
  }
  const payload = JSON.parse(await jsonFile.async('string')) as BackupPayload
  if (payload.version !== 1) {
    throw new Error('Versión de copia no compatible.')
  }

  await withoutDataTouch(async () => {
    await db.transaction('rw', db.tables, async () => {
      if (mode === 'replace') {
        await Promise.all(db.tables.map((table) => table.clear()))
      }
      if (payload.encargados?.length) await db.encargados.bulkPut(payload.encargados)
      const bloques = payload.bloques?.length ? payload.bloques : payload.grupos
      if (bloques?.length) await db.grupos.bulkPut(bloques)
      if (payload.fichas?.length) {
        await db.fichas.bulkPut(
          payload.fichas.map((ficha) => ({
            ...ficha,
            numero: ficha.numero?.trim() ? ficha.numero : '',
          })),
        )
      }
      if (payload.ocurrencias?.length) await db.ocurrencias.bulkPut(payload.ocurrencias)
      if (payload.ejecuciones?.length) await db.ejecuciones.bulkPut(payload.ejecuciones)
      if (payload.accionesCorrectivas?.length) {
        await db.accionesCorrectivas.bulkPut(payload.accionesCorrectivas)
      }
      if (payload.ajustes?.length) await db.ajustes.bulkPut(payload.ajustes)

      for (const meta of payload.adjuntosMeta ?? []) {
        const entry = zip.file(`files/${meta.id}`)
        let blob: Blob = new Blob([], { type: meta.mimeType })
        if (entry) {
          const buffer = await entry.async('arraybuffer')
          blob = new Blob([buffer], { type: meta.mimeType })
        }
        await db.adjuntos.put({ ...meta, blob })
      }
    })

    const now = Date.now()
    const current = await db.ajustes.get('app')
    if (current) {
      await db.ajustes.update('app', {
        lastBackupAt: now,
        lastChangedAt: now,
        autoBackup: current.autoBackup !== false,
      })
    } else {
      await db.ajustes.put({
        id: 'app',
        umbralProximaDias: 7,
        notificaciones: false,
        autoBackup: true,
        lastBackupAt: now,
        lastChangedAt: now,
      })
    }
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function markBackupDone(kind: 'folder' | 'download'): Promise<void> {
  const now = Date.now()
  await db.ajustes.update('app', {
    lastBackupAt: now,
    lastBackupKind: kind,
  })
}

async function ensureFolderPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<boolean> {
  const query = handle.queryPermission
  if (query) {
    const state = await query.call(handle, { mode })
    if (state === 'granted') return true
    const request = handle.requestPermission
    if (request) return (await request.call(handle, { mode })) === 'granted'
    return false
  }
  return true
}

export async function pickBackupFolder(): Promise<FileSystemDirectoryHandle> {
  if (!canUseFolderBackup()) {
    throw new Error(
      'Este navegador no permite elegir una carpeta. En el móvil usa el archivo ZIP (Drive, USB o WhatsApp).',
    )
  }
  const handle = await window.showDirectoryPicker({
    id: 'maintmanage-backup',
    mode: 'readwrite',
    startIn: 'documents',
  })
  await saveFolderHandle(handle)
  await db.ajustes.update('app', {
    backupFolderName: handle.name,
    autoBackup: true,
  })
  await requestPersistentStorage()
  return handle
}

export async function unlinkBackupFolder(): Promise<void> {
  await clearFolderHandle()
  await db.ajustes.update('app', { backupFolderName: '' })
}

export async function writeBackupToFolder(handle: FileSystemDirectoryHandle): Promise<number> {
  const allowed = await ensureFolderPermission(handle, 'readwrite')
  if (!allowed) {
    throw new Error('Sin permiso para escribir en la carpeta de copias. Vuelve a elegirla.')
  }
  const { blob } = await exportBackup()
  const fileHandle = await handle.getFileHandle(BACKUP_FILE_NAME, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(blob)
  await writable.close()
  await markBackupDone('folder')
  return blob.size
}

export async function findBackupInFolder(handle: FileSystemDirectoryHandle): Promise<File | null> {
  const allowed = await ensureFolderPermission(handle, 'read')
  if (!allowed) {
    throw new Error('Sin permiso para leer la carpeta de copias. Vuelve a elegirla.')
  }

  try {
    const current = await handle.getFileHandle(BACKUP_FILE_NAME)
    return await current.getFile()
  } catch {
    // Fall through and scan for any maintmanage zip.
  }

  let best: File | null = null
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file') continue
    if (!entry.name.startsWith('maintmanage') || !entry.name.endsWith('.zip')) continue
    const file = await (entry as FileSystemFileHandle).getFile()
    if (!best || file.lastModified > best.lastModified) best = file
  }
  return best
}

export async function restoreFromFolder(
  handle: FileSystemDirectoryHandle,
  mode: 'replace' | 'merge' = 'replace',
): Promise<void> {
  const file = await findBackupInFolder(handle)
  if (!file) {
    throw new Error(
      `No hay copia en esta carpeta. Busca ${BACKUP_FILE_NAME} o un ZIP exportado de MaintManage.`,
    )
  }
  await saveFolderHandle(handle)
  await importBackup(file, mode)
  await db.ajustes.update('app', {
    backupFolderName: handle.name,
    autoBackup: true,
  })
}

export async function getUsableBackupFolder(): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await getFolderHandle()
  if (!handle) return undefined
  const allowed = await ensureFolderPermission(handle, 'readwrite')
  if (!allowed) return undefined
  return handle
}
