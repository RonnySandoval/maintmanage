import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { computeContentChecksum, sha256HexOfText } from './checksum'
import { createBackupId, buildManifest, parseManifest } from './manifest'
import { packBackupZip, unpackBackupZip } from './package'
import type { BackupPayload } from './payload'
import { MANIFEST_FILE_NAME, PAYLOAD_FILE_NAME, FILES_FOLDER } from './types'
import type { Adjunto } from '../db/types'

function samplePayload(overrides?: Partial<BackupPayload>): BackupPayload {
  return {
    version: 1,
    exportedAt: '2026-09-14T21:30:00.000Z',
    encargados: [],
    grupos: [{ id: 'b1', nombre: 'Bloque A', color: 'teal', createdAt: 1, updatedAt: 1 }],
    fichas: [
      {
        id: 'f1',
        numero: '1',
        nombre: 'Ficha demo',
        grupoId: 'b1',
        frecuencia: 'cada_3',
        fechaInicio: '2026-01',
        fechaPrecision: 'mes',
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    ocurrencias: [],
    ejecuciones: [],
    accionesCorrectivas: [],
    actividades: [],
    eventos: [],
    ajustes: [
      {
        id: 'app',
        umbralProximaDias: 7,
        notificaciones: false,
        lastChangedAt: 1_700_000_000_000,
      },
    ],
    adjuntosMeta: [],
    ...overrides,
  }
}

function sampleImageAdjunto(id = 'img1'): Adjunto {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
  return {
    id,
    blob: new Blob([bytes], { type: 'image/png' }),
    mimeType: 'image/png',
    nombre: 'foto.png',
    fichaId: 'f1',
    tipo: 'ficha',
    createdAt: 1,
  }
}

describe('checksum', () => {
  it('produce hex SHA-256 estable', async () => {
    const a = await sha256HexOfText('maintmanage')
    const b = await sha256HexOfText('maintmanage')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('cambia si cambia un archivo', async () => {
    const payload = '{"version":1}'
    const c1 = await computeContentChecksum(payload, [
      { id: 'a', bytes: new Uint8Array([1, 2, 3]).buffer },
    ])
    const c2 = await computeContentChecksum(payload, [
      { id: 'a', bytes: new Uint8Array([1, 2, 4]).buffer },
    ])
    expect(c1).not.toBe(c2)
  })
})

describe('manifest', () => {
  it('crea backupId con formato esperado', () => {
    expect(createBackupId(new Date('2026-09-14T21:30:45'))).toMatch(
      /^BACKUP-\d{8}-\d{6}-[a-f0-9]{6}$/,
    )
  })

  it('parsea y normaliza checksum', () => {
    const built = buildManifest({
      appVersion: '0.0.0',
      deviceId: 'dev-1',
      deviceName: 'Chrome · PC',
      platform: 'windows',
      dataVersion: 42,
      checksum: 'A'.repeat(64),
      size: 100,
      kind: 'manual',
      attachmentCount: 0,
    })
    const parsed = parseManifest(built)
    expect(parsed.checksum).toBe('a'.repeat(64))
    expect(parsed.backupFormatVersion).toBe(1)
  })
})

describe('pack / unpack (Fase 1)', () => {
  it('Caso 1: round-trip con datos simples', async () => {
    const payload = samplePayload()
    const packed = await packBackupZip(payload, [], {
      deviceId: 'test-device',
      deviceName: 'Test',
      platform: 'windows',
      kind: 'manual',
    })

    expect(packed.manifest.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(packed.manifest.backupId).toMatch(/^BACKUP-/)
    expect(packed.blob.size).toBeGreaterThan(0)

    const unpacked = await unpackBackupZip(packed.blob)
    expect(unpacked.legacy).toBe(false)
    expect(unpacked.manifest?.checksum).toBe(packed.manifest.checksum)
    expect(unpacked.payload.fichas[0]?.nombre).toBe('Ficha demo')
    expect(unpacked.adjuntos).toHaveLength(0)
  })

  it('Caso 2: round-trip con imagen', async () => {
    const adjunto = sampleImageAdjunto()
    const payload = samplePayload({
      adjuntosMeta: [
        {
          id: adjunto.id,
          mimeType: adjunto.mimeType,
          nombre: adjunto.nombre,
          fichaId: adjunto.fichaId,
          tipo: adjunto.tipo,
          createdAt: adjunto.createdAt,
        },
      ],
    })

    const packed = await packBackupZip(payload, [adjunto], {
      deviceId: 'test-device',
      deviceName: 'Test',
      platform: 'android',
    })
    expect(packed.manifest.attachmentCount).toBe(1)

    const unpacked = await unpackBackupZip(packed.blob)
    expect(unpacked.adjuntos).toHaveLength(1)
    expect(unpacked.adjuntos[0]?.mimeType).toBe('image/png')
    expect(new Uint8Array(await unpacked.adjuntos[0]!.blob.arrayBuffer())).toEqual(
      new Uint8Array(await adjunto.blob.arrayBuffer()),
    )
  })

  it('acepta ZIP legacy sin manifest', async () => {
    const payload = samplePayload()
    const zip = new JSZip()
    zip.file(PAYLOAD_FILE_NAME, JSON.stringify(payload))
    const blob = await zip.generateAsync({ type: 'blob' })

    const unpacked = await unpackBackupZip(blob)
    expect(unpacked.legacy).toBe(true)
    expect(unpacked.manifest).toBeNull()
    expect(unpacked.payload.fichas).toHaveLength(1)
  })

  it('Caso 5: detecta backup corrupto (checksum)', async () => {
    const packed = await packBackupZip(samplePayload(), [], { deviceId: 'd' })
    const zip = await JSZip.loadAsync(packed.blob)
    zip.file(PAYLOAD_FILE_NAME, JSON.stringify(samplePayload({ exportedAt: 'changed' })))
    const corrupt = await zip.generateAsync({ type: 'blob' })

    await expect(unpackBackupZip(corrupt)).rejects.toThrow(/checksum|alterada|incompleta/i)
  })

  it('Caso 6: detecta backup incompleto (falta adjunto)', async () => {
    const adjunto = sampleImageAdjunto('missing-file')
    const payload = samplePayload({
      adjuntosMeta: [
        {
          id: adjunto.id,
          mimeType: adjunto.mimeType,
          nombre: adjunto.nombre,
          tipo: adjunto.tipo,
          createdAt: adjunto.createdAt,
        },
      ],
    })
    const packed = await packBackupZip(payload, [adjunto], { deviceId: 'd' })
    const zip = await JSZip.loadAsync(packed.blob)
    zip.remove(`${FILES_FOLDER}/${adjunto.id}`)
    // Recalcular no: dejamos manifest viejo → incompleto + posible checksum
    const incomplete = await zip.generateAsync({ type: 'blob' })

    await expect(unpackBackupZip(incomplete)).rejects.toThrow()
  })

  it('Caso 7: rechaza schemaVersion futura', async () => {
    const packed = await packBackupZip(samplePayload(), [], { deviceId: 'd' })
    const zip = await JSZip.loadAsync(packed.blob)
    const manifest = JSON.parse(await zip.file(MANIFEST_FILE_NAME)!.async('string'))
    manifest.schemaVersion = 999
    // Recalcular checksum del contenido intacto: el payload no cambió, solo manifest
    zip.file(MANIFEST_FILE_NAME, JSON.stringify(manifest))
    const future = await zip.generateAsync({ type: 'blob' })

    await expect(unpackBackupZip(future)).rejects.toThrow(/esquema|schema/i)
  })

  it('rechaza ZIP dañado', async () => {
    const junk = new Blob(['not-a-zip'], { type: 'application/zip' })
    await expect(unpackBackupZip(junk)).rejects.toThrow(/dañado|ZIP/i)
  })
})
