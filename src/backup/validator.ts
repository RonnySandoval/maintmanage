import { computeContentChecksum } from './checksum'
import { isManifestCompatible, parseManifest } from './manifest'
import {
  SCHEMA_VERSION,
  type BackupManifest,
  type BackupValidationIssue,
  type BackupValidationResult,
} from './types'

export interface ValidatablePackage {
  payloadJson: string
  payload: { version?: number } | null
  files: ReadonlyArray<{ id: string; bytes: ArrayBuffer }>
  /** IDs declarados en adjuntosMeta. */
  declaredAttachmentIds: string[]
  manifestRaw: unknown | null
  /** Si true, exige manifest y checksum (copias nuevas). */
  requireManifest?: boolean
}

function issue(code: BackupValidationIssue['code'], message: string): BackupValidationIssue {
  return { code, message }
}

/**
 * Valida estructura, versión e integridad (checksum) de un paquete ya desempaquetado.
 * No escribe en IndexedDB.
 */
export async function validateBackupPackage(
  pkg: ValidatablePackage,
): Promise<BackupValidationResult> {
  const issues: BackupValidationIssue[] = []
  let manifest: BackupManifest | null = null
  const legacy = pkg.manifestRaw == null

  if (!pkg.payloadJson.trim()) {
    issues.push(issue('missing_payload', 'Falta el archivo de datos de la copia.'))
  }

  if (!pkg.payload || pkg.payload.version !== 1) {
    issues.push(
      issue(
        'unsupported_payload_version',
        'Versión de datos de la copia no compatible.',
      ),
    )
  }

  if (pkg.manifestRaw != null) {
    try {
      manifest = parseManifest(pkg.manifestRaw)
      if (!isManifestCompatible(manifest)) {
        if (manifest.backupFormatVersion !== 1) {
          issues.push(
            issue(
              'unsupported_format_version',
              `Formato de copia ${manifest.backupFormatVersion} no soportado.`,
            ),
          )
        }
        if (manifest.schemaVersion > SCHEMA_VERSION) {
          issues.push(
            issue(
              'unsupported_schema_version',
              `Esta copia requiere esquema ${manifest.schemaVersion}; la app soporta hasta ${SCHEMA_VERSION}.`,
            ),
          )
        }
      }

      const actual = await computeContentChecksum(pkg.payloadJson, pkg.files)
      if (actual !== manifest.checksum) {
        issues.push(
          issue(
            'checksum_mismatch',
            'La copia está alterada o incompleta (checksum no coincide).',
          ),
        )
      }
    } catch (err) {
      issues.push(
        issue(
          'invalid_manifest',
          err instanceof Error ? err.message : 'Manifest de copia inválido.',
        ),
      )
    }
  } else if (pkg.requireManifest) {
    issues.push(issue('invalid_manifest', 'La copia no incluye manifest de integridad.'))
  }

  const fileIds = new Set(pkg.files.map((f) => f.id))
  const missing = pkg.declaredAttachmentIds.filter((id) => !fileIds.has(id))
  if (missing.length > 0) {
    issues.push(
      issue(
        'incomplete_attachments',
        `Faltan ${missing.length} archivo(s) adjunto(s) en la copia.`,
      ),
    )
  }

  return {
    ok: issues.length === 0,
    issues,
    manifest,
    legacy,
  }
}

/** Mensaje único amigable a partir del primer issue relevante. */
export function validationErrorMessage(result: BackupValidationResult): string {
  if (result.ok) return ''
  return result.issues[0]?.message ?? 'La copia no es válida.'
}
