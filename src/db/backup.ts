import JSZip from 'jszip'
import { withoutDataTouch } from '../lib/changeTracker'
import { todayISO } from '../lib/dates'
import { clearFolderHandle, getFolderHandle, saveFolderHandle } from './folderHandle'
import { db } from './index'
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
  Ocurrencia,
} from './types'

type AdjuntoMeta = Omit<Adjunto, 'blob'>

export const BACKUP_FILE_NAME = 'maintmanage-backup.zip'
export const BACKUP_JSON_NAME_PREFIX = 'maintmanage'
export const DEFAULT_BACKUP_INTERVAL_HOURS = 12
export const BACKUP_INTERVAL_MS = DEFAULT_BACKUP_INTERVAL_HOURS * 60 * 60 * 1000
export const MIN_BACKUP_INTERVAL_HOURS = 1
export const MAX_BACKUP_INTERVAL_HOURS = 168

export type BackupFileKind = 'zip' | 'json'
export type BackupSaveKind = 'folder' | BackupFileKind | 'download'

export function backupKindLabel(kind?: string | null): string {
  if (kind === 'folder') return 'carpeta'
  if (kind === 'json') return 'JSON'
  if (kind === 'zip' || kind === 'download') return 'ZIP'
  return ''
}

export function backupIntervalHoursOf(hours?: number | null): number {
  if (typeof hours !== 'number' || !Number.isFinite(hours)) return DEFAULT_BACKUP_INTERVAL_HOURS
  return Math.min(MAX_BACKUP_INTERVAL_HOURS, Math.max(MIN_BACKUP_INTERVAL_HOURS, Math.round(hours)))
}

export function backupIntervalMsOf(hours?: number | null): number {
  return backupIntervalHoursOf(hours) * 60 * 60 * 1000
}

export function nextBackupAtOf(
  ajustes?: Pick<Ajustes, 'lastBackupAt' | 'nextBackupAt' | 'backupIntervalHours'> | null,
  now = Date.now(),
): number {
  if (ajustes?.nextBackupAt && ajustes.nextBackupAt > 0) return ajustes.nextBackupAt
  if (ajustes?.lastBackupAt) return ajustes.lastBackupAt + backupIntervalMsOf(ajustes.backupIntervalHours)
  return now
}

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
  ajustes: Ajustes[]
  adjuntosMeta: AdjuntoMeta[]
}

export function canUseFolderBackup(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function hasUserData(): Promise<boolean> {
  const [fichas, encargados, grupos, adjuntos, ejecuciones, actividades, eventos] = await Promise.all([
    db.fichas.count(),
    db.encargados.count(),
    db.grupos.count(),
    db.adjuntos.count(),
    db.ejecuciones.count(),
    db.actividades.count(),
    db.eventos.count(),
  ])
  return fichas + encargados + grupos + adjuntos + ejecuciones + actividades + eventos > 0
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

async function buildPayload(): Promise<{ payload: BackupPayload; adjuntos: Adjunto[] }> {
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
  return { payload, adjuntos }
}

function assertPayload(payload: BackupPayload): void {
  if (!payload || payload.version !== 1) {
    throw new Error('Versión de copia no compatible.')
  }
}

export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  return exportBackupZip()
}

/** ZIP completo: datos + fotos/documentos. */
export async function exportBackupZip(): Promise<{ blob: Blob; filename: string }> {
  const { payload, adjuntos } = await buildPayload()
  const zip = new JSZip()
  zip.file('backup.json', JSON.stringify(payload))
  const folder = zip.folder('files')
  for (const adjunto of adjuntos) {
    folder?.file(adjunto.id, adjunto.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, filename: `${BACKUP_JSON_NAME_PREFIX}-${todayISO()}.zip` }
}

/** JSON ligero: solo datos (sin fotos ni documentos). */
export async function exportBackupJson(): Promise<{ blob: Blob; filename: string }> {
  const { payload } = await buildPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  return { blob, filename: `${BACKUP_JSON_NAME_PREFIX}-${todayISO()}.json` }
}

async function readZipBackup(file: Blob): Promise<{ payload: BackupPayload; adjuntos: Adjunto[] }> {
  const zip = await JSZip.loadAsync(file)
  const jsonFile = zip.file('backup.json')
  if (!jsonFile) {
    throw new Error('El ZIP no es una copia de MaintManage (falta backup.json).')
  }
  const payload = JSON.parse(await jsonFile.async('string')) as BackupPayload
  assertPayload(payload)

  const adjuntos: Adjunto[] = []
  for (const meta of payload.adjuntosMeta ?? []) {
    const entry = zip.file(`files/${meta.id}`)
    let blob: Blob = new Blob([], { type: meta.mimeType })
    if (entry) {
      const buffer = await entry.async('arraybuffer')
      blob = new Blob([buffer], { type: meta.mimeType })
    }
    adjuntos.push({ ...meta, blob })
  }
  return { payload, adjuntos }
}

async function readJsonBackup(file: Blob): Promise<{ payload: BackupPayload; adjuntos: Adjunto[] }> {
  const text = await file.text()
  const payload = JSON.parse(text) as BackupPayload
  assertPayload(payload)
  return { payload, adjuntos: [] }
}

export function detectBackupKind(file: Blob): BackupFileKind {
  const name = 'name' in file && typeof (file as File).name === 'string' ? (file as File).name.toLowerCase() : ''
  if (name.endsWith('.json') || file.type.includes('json')) return 'json'
  if (name.endsWith('.zip') || file.type.includes('zip')) return 'zip'
  return 'zip'
}

export async function readBackupFile(
  file: Blob,
): Promise<{ kind: BackupFileKind; payload: BackupPayload; adjuntos: Adjunto[] }> {
  const name = 'name' in file && typeof (file as File).name === 'string' ? (file as File).name.toLowerCase() : ''
  const prefersJson = name.endsWith('.json') || file.type.includes('json')

  if (prefersJson) {
    const read = await readJsonBackup(file)
    return { kind: 'json', ...read }
  }

  try {
    const read = await readZipBackup(file)
    return { kind: 'zip', ...read }
  } catch (zipErr) {
    try {
      const text = await file.slice(0, 64).text()
      if (text.trimStart().startsWith('{')) {
        const read = await readJsonBackup(file)
        return { kind: 'json', ...read }
      }
    } catch {
      // keep zip error
    }
    throw zipErr instanceof Error
      ? zipErr
      : new Error('No se pudo leer la copia. Usa un ZIP o un JSON de MaintManage.')
  }
}

async function applyBackupPayload(
  payload: BackupPayload,
  adjuntos: Adjunto[],
  mode: 'replace' | 'merge',
): Promise<void> {
  const encargados = payload.encargados ?? []
  const bloques = payload.bloques?.length ? payload.bloques : (payload.grupos ?? [])
  const fichas = (payload.fichas ?? []).map((ficha) => ({
    ...ficha,
    numero: ficha.numero?.trim() ? ficha.numero : '',
  }))
  const ocurrencias = payload.ocurrencias ?? []
  const ejecuciones = payload.ejecuciones ?? []
  const accionesCorrectivas = payload.accionesCorrectivas ?? []
  const actividades = payload.actividades ?? []
  const eventos = payload.eventos ?? []
  const ajustes = payload.ajustes ?? []

  await withoutDataTouch(async () => {
    await db.transaction('rw', db.tables, async () => {
      if (mode === 'replace') {
        await Promise.all(db.tables.map((table) => table.clear()))
      }
      if (encargados.length) await db.encargados.bulkPut(encargados)
      if (bloques.length) await db.grupos.bulkPut(bloques)
      if (fichas.length) await db.fichas.bulkPut(fichas)
      if (ocurrencias.length) await db.ocurrencias.bulkPut(ocurrencias)
      if (ejecuciones.length) await db.ejecuciones.bulkPut(ejecuciones)
      if (accionesCorrectivas.length) await db.accionesCorrectivas.bulkPut(accionesCorrectivas)
      if (actividades.length) await db.actividades.bulkPut(actividades)
      if (eventos.length) await db.eventos.bulkPut(eventos)
      if (ajustes.length) await db.ajustes.bulkPut(ajustes)
      if (adjuntos.length) await db.adjuntos.bulkPut(adjuntos)
    })

    const now = Date.now()
    const current = await db.ajustes.get('app')
    if (current) {
      await db.ajustes.update('app', {
        lastBackupAt: now,
        lastChangedAt: now,
        autoBackup: current.autoBackup !== false,
        nextBackupAt: now + backupIntervalMsOf(current.backupIntervalHours),
      })
    } else {
      await db.ajustes.put({
        id: 'app',
        umbralProximaDias: 7,
        notificaciones: false,
        autoBackup: true,
        backupIntervalHours: DEFAULT_BACKUP_INTERVAL_HOURS,
        lastBackupAt: now,
        lastChangedAt: now,
        nextBackupAt: now + BACKUP_INTERVAL_MS,
      })
    }
  })
}

export async function importBackup(file: Blob, mode: 'replace' | 'merge'): Promise<BackupFileKind> {
  const { kind, payload, adjuntos } = await readBackupFile(file)
  await applyBackupPayload(payload, adjuntos, mode)
  return kind
}

export type ShareBackupResult =
  | 'shared'
  | 'cancelled'
  | 'unsupported'
  | 'failed'
  | 'needs-gesture'

/** ¿El navegador permite compartir un archivo ZIP por el menú nativo? */
export function canShareZipFiles(): boolean {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
  }
  if (typeof nav.share !== 'function') return false
  try {
    const probe = new File([new Uint8Array([0x50, 0x4b])], 'maintmanage-backup.zip', {
      type: 'application/zip',
    })
    if (typeof nav.canShare === 'function') {
      return nav.canShare({ files: [probe] })
    }
    return true
  } catch {
    return false
  }
}

export function backupZipAsFile(blob: Blob, filename: string): File {
  return new File([blob], filename, {
    type: 'application/zip',
    lastModified: Date.now(),
  })
}

function asShareableZipFile(blob: Blob, filename: string, mime: string): File {
  return new File([blob], filename, { type: mime, lastModified: Date.now() })
}

/**
 * Abre el menú nativo con el archivo.
 * Debe llamarse en el manejador de click sin awaits previos (el ZIP
 * tiene que estar ya preparado); si no, Android/Chrome revoca el gesto.
 */
export async function shareBackupFile(file: File): Promise<ShareBackupResult> {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
  }
  if (typeof nav.share !== 'function') return 'unsupported'

  const candidates: File[] = [
    file,
    asShareableZipFile(file, file.name, 'application/octet-stream'),
    asShareableZipFile(file, file.name, 'application/x-zip-compressed'),
  ]

  let sawNotAllowed = false
  let sawTypeError = false

  for (const candidate of candidates) {
    try {
      // Solo files: title/text a veces rompen el envío a WhatsApp en Android.
      await nav.share({ files: [candidate] })
      await markBackupDone('zip')
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        sawNotAllowed = true
        break
      }
      if (err instanceof TypeError) {
        sawTypeError = true
        continue
      }
    }
  }

  if (sawNotAllowed) return 'needs-gesture'
  if (sawTypeError) return 'unsupported'
  return 'failed'
}

export async function prepareBackupZipForShare(): Promise<{
  file: File
  filename: string
  size: number
}> {
  const { blob, filename } = await exportBackupZip()
  const file = backupZipAsFile(blob, filename)
  return { file, filename, size: blob.size }
}

/** Un solo paso: genera el ZIP y abre el menú nativo de compartir. */
export async function buildAndShareBackupZip(): Promise<ShareBackupResult> {
  const { file } = await prepareBackupZipForShare()
  return shareBackupFile(file)
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

export async function markBackupDone(kind: BackupSaveKind): Promise<void> {
  const now = Date.now()
  const current = await db.ajustes.get('app')
  const normalized: BackupSaveKind = kind === 'download' ? 'zip' : kind
  await db.ajustes.update('app', {
    lastBackupAt: now,
    lastBackupKind: normalized,
    nextBackupAt: now + backupIntervalMsOf(current?.backupIntervalHours),
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
