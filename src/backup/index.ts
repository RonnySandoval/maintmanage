export {
  BACKUP_FORMAT_VERSION,
  SCHEMA_VERSION,
  GMAIL_BACKUP_SUBJECT_TAG,
  MANIFEST_FILE_NAME,
  PAYLOAD_FILE_NAME,
  FILES_FOLDER,
} from './types'
export type {
  BackupKind,
  BackupMetadata,
  BackupManifest,
  BackupValidationIssue,
  BackupValidationIssueCode,
  BackupValidationResult,
} from './types'

export { sha256Hex, sha256HexOfBlob, computeContentChecksum } from './checksum'
export { getOrCreateDeviceId, detectDeviceName, detectPlatform } from './device'
export { createBackupId, buildManifest, parseManifest, isManifestCompatible } from './manifest'
export { validateBackupPackage, validationErrorMessage } from './validator'
export {
  APP_VERSION,
  packBackupZip,
  unpackBackupZip,
} from './package'
export type { PackedBackup, UnpackedBackup, PackBackupOptions } from './package'
export { assertPayload } from './payload'
export type { BackupPayload, AdjuntoMeta } from './payload'

export type { BackupProvider, RemoteBackupRef } from './provider'

export {
  GMAIL_WARN_BYTES,
  GMAIL_HARD_MAX_BYTES,
  assessBackupSize,
  formatBackupSize,
} from './limits'
export type { BackupSizeStatus, BackupSizeAssessment } from './limits'

export { verifyRoundTrip, packAndVerify } from './verify'
export type { RoundTripResult } from './verify'

export { idbSnapshotStore, createMemorySnapshotStore } from './snapshot'
export type { SnapshotStore } from './snapshot'

export { replaceWithRollback, rollbackUserMessage } from './restorer'
export type { RestoreRollbackResult, ReplaceWithRollbackOptions } from './restorer'

export {
  uploadBackupToGmail,
  listGmailBackups,
  downloadGmailBackup,
  deleteGmailBackup,
  restoreFromGmail,
} from './cloudBackup'
export type { CloudBackupProgress, CloudRestoreProgress, RestoreFromGmailDeps } from './cloudBackup'
