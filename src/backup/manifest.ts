import {
  BACKUP_FORMAT_VERSION,
  SCHEMA_VERSION,
  type BackupKind,
  type BackupManifest,
  type BuildManifestInput,
} from './types'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Genera un id legible: BACKUP-20260914-213045-a8f31c */
export function createBackupId(at = new Date()): string {
  const y = at.getFullYear()
  const mo = pad2(at.getMonth() + 1)
  const d = pad2(at.getDate())
  const h = pad2(at.getHours())
  const mi = pad2(at.getMinutes())
  const s = pad2(at.getSeconds())
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `BACKUP-${y}${mo}${d}-${h}${mi}${s}-${suffix}`
}

export function buildManifest(input: BuildManifestInput): BackupManifest {
  const createdAt = input.createdAt ?? new Date().toISOString()
  return {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    backupId: input.backupId ?? createBackupId(new Date(createdAt)),
    createdAt,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion ?? SCHEMA_VERSION,
    payloadVersion: 1,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
    dataVersion: input.dataVersion,
    checksum: input.checksum,
    size: input.size,
    kind: input.kind,
    attachmentCount: input.attachmentCount,
  }
}

export function parseManifest(raw: unknown): BackupManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Manifest de copia inválido.')
  }
  const m = raw as Partial<BackupManifest>
  if (typeof m.backupFormatVersion !== 'number') {
    throw new Error('Manifest sin backupFormatVersion.')
  }
  if (typeof m.backupId !== 'string' || !m.backupId) {
    throw new Error('Manifest sin backupId.')
  }
  if (typeof m.createdAt !== 'string' || !m.createdAt) {
    throw new Error('Manifest sin createdAt.')
  }
  if (typeof m.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(m.checksum)) {
    throw new Error('Manifest con checksum inválido.')
  }
  if (typeof m.schemaVersion !== 'number') {
    throw new Error('Manifest sin schemaVersion.')
  }
  if (m.payloadVersion !== 1) {
    throw new Error('Manifest con payloadVersion no soportado.')
  }

  const kind: BackupKind = m.kind === 'auto' ? 'auto' : 'manual'

  return {
    backupFormatVersion: m.backupFormatVersion as typeof BACKUP_FORMAT_VERSION,
    backupId: m.backupId,
    createdAt: m.createdAt,
    appVersion: typeof m.appVersion === 'string' ? m.appVersion : '0.0.0',
    schemaVersion: m.schemaVersion,
    payloadVersion: 1,
    deviceId: typeof m.deviceId === 'string' ? m.deviceId : '',
    deviceName: typeof m.deviceName === 'string' ? m.deviceName : '',
    platform: typeof m.platform === 'string' ? m.platform : '',
    dataVersion: typeof m.dataVersion === 'number' ? m.dataVersion : 0,
    checksum: m.checksum.toLowerCase(),
    size: typeof m.size === 'number' ? m.size : 0,
    kind,
    attachmentCount: typeof m.attachmentCount === 'number' ? m.attachmentCount : 0,
    notes: typeof m.notes === 'string' ? m.notes : undefined,
  }
}

export function isManifestCompatible(manifest: BackupManifest): boolean {
  return (
    manifest.backupFormatVersion === BACKUP_FORMAT_VERSION &&
    manifest.payloadVersion === 1 &&
    manifest.schemaVersion <= SCHEMA_VERSION
  )
}
