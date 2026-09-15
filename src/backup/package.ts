import JSZip from 'jszip'
import type { Adjunto } from '../db/types'
import { assertPayload, type BackupPayload } from './payload'
import { computeContentChecksum } from './checksum'
import { detectDeviceName, detectPlatform, getOrCreateDeviceId } from './device'
import { buildManifest } from './manifest'
import {
  FILES_FOLDER,
  MANIFEST_FILE_NAME,
  PAYLOAD_FILE_NAME,
  SCHEMA_VERSION,
  type BackupKind,
  type BackupManifest,
} from './types'
import { validateBackupPackage, validationErrorMessage } from './validator'

/** Mantener alineado con package.json. */
export const APP_VERSION = '0.0.0'

export interface PackedBackup {
  blob: Blob
  manifest: BackupManifest
  payload: BackupPayload
  adjuntos: Adjunto[]
}

export interface UnpackedBackup {
  payload: BackupPayload
  adjuntos: Adjunto[]
  manifest: BackupManifest | null
  legacy: boolean
}

export interface PackBackupOptions {
  kind?: BackupKind
  dataVersion?: number
  appVersion?: string
  deviceId?: string
  deviceName?: string
  platform?: string
}

/**
 * Empaqueta payload + adjuntos en ZIP con manifest y checksum.
 * No toca IndexedDB.
 */
export async function packBackupZip(
  payload: BackupPayload,
  adjuntos: Adjunto[],
  options: PackBackupOptions = {},
): Promise<PackedBackup> {
  const payloadJson = JSON.stringify(payload)
  const fileEntries: { id: string; bytes: ArrayBuffer; blob: Blob }[] = []

  for (const adjunto of adjuntos) {
    const bytes = await adjunto.blob.arrayBuffer()
    fileEntries.push({ id: adjunto.id, bytes, blob: adjunto.blob })
  }

  const checksum = await computeContentChecksum(
    payloadJson,
    fileEntries.map((f) => ({ id: f.id, bytes: f.bytes })),
  )

  const zip = new JSZip()
  zip.file(PAYLOAD_FILE_NAME, payloadJson)
  const folder = zip.folder(FILES_FOLDER)
  for (const entry of fileEntries) {
    folder?.file(entry.id, entry.bytes)
  }

  const draft = buildManifest({
    appVersion: options.appVersion ?? APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    deviceId: options.deviceId ?? getOrCreateDeviceId(),
    deviceName: options.deviceName ?? detectDeviceName(),
    platform: options.platform ?? detectPlatform(),
    dataVersion: options.dataVersion ?? deriveDataVersion(payload),
    checksum,
    size: 0,
    kind: options.kind ?? 'manual',
    attachmentCount: adjuntos.length,
  })

  // El checksum no incluye el manifest; reescribimos size tras la primera generación.
  zip.file(MANIFEST_FILE_NAME, JSON.stringify(draft, null, 2))
  const firstBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const manifest: BackupManifest = { ...draft, size: firstBlob.size }
  zip.file(MANIFEST_FILE_NAME, JSON.stringify(manifest, null, 2))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

  return {
    blob,
    manifest: { ...manifest, size: blob.size },
    payload,
    adjuntos,
  }
}

/**
 * Lee un ZIP de copia, valida integridad si hay manifest, y devuelve datos.
 * Acepta copias legacy (sin manifest).
 */
export async function unpackBackupZip(
  file: Blob,
  options: { requireManifest?: boolean } = {},
): Promise<UnpackedBackup> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('El archivo de copia está dañado o no es un ZIP válido.')
  }

  const jsonFile = zip.file(PAYLOAD_FILE_NAME)
  if (!jsonFile) {
    throw new Error('El ZIP no es una copia de MaintManage (falta backup.json).')
  }

  const payloadJson = await jsonFile.async('string')
  let payload: BackupPayload
  try {
    payload = JSON.parse(payloadJson) as BackupPayload
    assertPayload(payload)
  } catch (err) {
    if (err instanceof Error && err.message.includes('compatible')) throw err
    throw new Error('Los datos de la copia son ilegibles.')
  }

  const manifestEntry = zip.file(MANIFEST_FILE_NAME)
  let manifestRaw: unknown | null = null
  if (manifestEntry) {
    try {
      manifestRaw = JSON.parse(await manifestEntry.async('string'))
    } catch {
      throw new Error('El manifest de la copia está dañado.')
    }
  }

  const declaredIds = (payload.adjuntosMeta ?? []).map((m) => m.id)
  const files: { id: string; bytes: ArrayBuffer }[] = []
  const adjuntos: Adjunto[] = []

  for (const meta of payload.adjuntosMeta ?? []) {
    const entry = zip.file(`${FILES_FOLDER}/${meta.id}`)
    let bytes = new ArrayBuffer(0)
    let blob: Blob = new Blob([], { type: meta.mimeType })
    if (entry) {
      bytes = await entry.async('arraybuffer')
      blob = new Blob([bytes], { type: meta.mimeType })
      files.push({ id: meta.id, bytes })
    }
    adjuntos.push({ ...meta, blob })
  }

  const validation = await validateBackupPackage({
    payloadJson,
    payload,
    files,
    declaredAttachmentIds: declaredIds,
    manifestRaw,
    requireManifest: options.requireManifest,
  })

  if (!validation.ok) {
    throw new Error(validationErrorMessage(validation))
  }

  return {
    payload,
    adjuntos,
    manifest: validation.manifest,
    legacy: validation.legacy,
  }
}

function deriveDataVersion(payload: BackupPayload): number {
  const ajustes = payload.ajustes?.find((a) => a.id === 'app')
  if (ajustes?.lastChangedAt && Number.isFinite(ajustes.lastChangedAt)) {
    return ajustes.lastChangedAt
  }
  if (payload.exportedAt) {
    const t = Date.parse(payload.exportedAt)
    if (Number.isFinite(t)) return t
  }
  return Date.now()
}
