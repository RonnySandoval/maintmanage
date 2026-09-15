import { assessBackupSize, type BackupSizeAssessment } from './limits'
import { packBackupZip, unpackBackupZip, type PackedBackup, type PackBackupOptions } from './package'
import type { BackupPayload } from './payload'
import type { Adjunto } from '../db/types'

export interface RoundTripResult {
  packed: PackedBackup
  size: BackupSizeAssessment
}

/**
 * Vuelve a leer el ZIP, valida checksum/manifest y comprueba que el checksum coincide.
 * Simula “descargar → reabrir → validar” sin tocar IndexedDB.
 */
export async function verifyRoundTrip(blob: Blob, expectedChecksum?: string): Promise<void> {
  const unpacked = await unpackBackupZip(blob, { requireManifest: true })
  if (!unpacked.manifest) {
    throw new Error('La verificación de la copia falló: falta el manifest.')
  }
  if (expectedChecksum && unpacked.manifest.checksum !== expectedChecksum) {
    throw new Error('La verificación de la copia falló: el checksum no coincide.')
  }

  // Re-empaquetar en memoria y comparar checksum de contenido (prueba de fidelidad).
  const repacked = await packBackupZip(unpacked.payload, unpacked.adjuntos, {
    kind: unpacked.manifest.kind,
    dataVersion: unpacked.manifest.dataVersion,
    appVersion: unpacked.manifest.appVersion,
    deviceId: unpacked.manifest.deviceId,
    deviceName: unpacked.manifest.deviceName,
    platform: unpacked.manifest.platform,
  })
  if (repacked.manifest.checksum !== unpacked.manifest.checksum) {
    throw new Error('La verificación de la copia falló: los datos no se reproducen igual.')
  }
}

/** Empaqueta y verifica round-trip antes de devolver el ZIP. */
export async function packAndVerify(
  payload: BackupPayload,
  adjuntos: Adjunto[],
  options: PackBackupOptions = {},
): Promise<RoundTripResult> {
  const packed = await packBackupZip(payload, adjuntos, options)
  await verifyRoundTrip(packed.blob, packed.manifest.checksum)
  return {
    packed,
    size: assessBackupSize(packed.blob.size),
  }
}
