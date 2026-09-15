/** Umbral cómodo para Gmail (margen bajo el límite ~25 MB de adjuntos). */
export const GMAIL_WARN_BYTES = 18 * 1024 * 1024

/** Por encima de esto el envío a Gmail suele fallar. */
export const GMAIL_HARD_MAX_BYTES = 24 * 1024 * 1024

/** Límite documentado de la API para upload MIME (~35 MiB); usamos el de adjuntos reales. */
export const GMAIL_API_UPLOAD_MAX_BYTES = 35 * 1024 * 1024

export type BackupSizeStatus = 'ok' | 'warn' | 'too_large'

export interface BackupSizeAssessment {
  status: BackupSizeStatus
  size: number
  /** Mensaje amigable si no es ok. */
  message: string | null
}

export function assessBackupSize(size: number): BackupSizeAssessment {
  if (!Number.isFinite(size) || size < 0) {
    return { status: 'too_large', size: 0, message: 'No se pudo determinar el tamaño de la copia.' }
  }
  if (size > GMAIL_HARD_MAX_BYTES) {
    return {
      status: 'too_large',
      size,
      message:
        'La copia es demasiado grande para enviarla por Gmail (máx. ~24 MB). Reduce fotos o documentos.',
    }
  }
  if (size > GMAIL_WARN_BYTES) {
    return {
      status: 'warn',
      size,
      message:
        'La copia es grande y podría fallar al subirla a Gmail. Considera archivar fotos antiguas.',
    }
  }
  return { status: 'ok', size, message: null }
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
