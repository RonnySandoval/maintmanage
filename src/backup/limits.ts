/**
 * Límites de tamaño para copias vía Gmail.
 *
 * Referencia oficial (discovery de la API Gmail v1, revisión 20260921):
 * - `users.messages.insert` soporta subida multimedia hasta 150 MiB
 *   (maxSize 157286400), pero SOLO por el endpoint `/upload/...?uploadType=multipart`
 *   o resumable. El endpoint JSON simple (`raw`) tiene topes menores no documentados.
 * - La subida multipart media el mensaje RFC 822 ya codificado en base64,
 *   así que un ZIP de N bytes genera ~1.37×N bytes en el mensaje.
 */

/** Límite documentado de la API Gmail para `users.messages.insert` (150 MiB). */
export const GMAIL_API_UPLOAD_MAX_BYTES = 150 * 1024 * 1024

/** Umbral de aviso: a partir de aquí la copia ZIP es grande y tarda en subir. */
export const GMAIL_WARN_BYTES = 80 * 1024 * 1024

/**
 * Tope de la copia ZIP para Gmail. Un ZIP de 100 MiB genera un mensaje
 * base64 de ~137 MiB (margen holgado bajo el límite de 150 MiB).
 */
export const GMAIL_HARD_MAX_BYTES = 100 * 1024 * 1024

/** Margen de seguridad sobre el límite documentado (%~90 %). */
export const GMAIL_ENCODED_LIMIT_BYTES = Math.floor(GMAIL_API_UPLOAD_MAX_BYTES * 0.9)

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
        'La copia es demasiado grande para enviarla por Gmail (máx. ~100 MB). Reduce fotos o documentos, o guarda una copia local en carpeta/ZIP.',
    }
  }
  if (size > GMAIL_WARN_BYTES) {
    return {
      status: 'warn',
      size,
      message:
        'La copia es grande (más de ~80 MB) y tardará en subir a Gmail. Si falla, reduce fotos o documentos.',
    }
  }
  return { status: 'ok', size, message: null }
}

/**
 * Verifica que el mensaje RFC 822 ya codificado (base64 + CRLF) quepa en la
 * API de Gmail. Se usa tras construir el MIME, justo antes de subirlo.
 */
export function assessEncodedMessageSize(encodedBytes: number): BackupSizeAssessment {
  if (!Number.isFinite(encodedBytes) || encodedBytes < 0) {
    return {
      status: 'too_large',
      size: 0,
      message: 'No se pudo determinar el tamaño del mensaje para Gmail.',
    }
  }
  if (encodedBytes > GMAIL_ENCODED_LIMIT_BYTES) {
    return {
      status: 'too_large',
      size: encodedBytes,
      message:
        'La copia codificada supera el máximo que admite la API de Gmail (~150 MB). Reduce fotos o documentos.',
    }
  }
  return { status: 'ok', size: encodedBytes, message: null }
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}