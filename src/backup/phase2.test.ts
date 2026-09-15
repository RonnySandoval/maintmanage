import { describe, expect, it } from 'vitest'
import {
  GMAIL_HARD_MAX_BYTES,
  GMAIL_WARN_BYTES,
  assessBackupSize,
  formatBackupSize,
} from './limits'
import { packBackupZip, unpackBackupZip } from './package'
import type { BackupPayload } from './payload'
import { createMemorySnapshotStore } from './snapshot'
import { replaceWithRollback, rollbackUserMessage } from './restorer'
import { packAndVerify, verifyRoundTrip } from './verify'
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

function largeAdjunto(id: string, sizeBytes: number): Adjunto {
  const bytes = new Uint8Array(sizeBytes)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = i % 251
  return {
    id,
    blob: new Blob([bytes], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    nombre: `${id}.jpg`,
    fichaId: 'f1',
    tipo: 'ficha',
    createdAt: 1,
  }
}

describe('limits', () => {
  it('clasifica tamaños para Gmail', () => {
    expect(assessBackupSize(1024).status).toBe('ok')
    expect(assessBackupSize(GMAIL_WARN_BYTES + 1).status).toBe('warn')
    expect(assessBackupSize(GMAIL_HARD_MAX_BYTES + 1).status).toBe('too_large')
    expect(formatBackupSize(2.5 * 1024 * 1024)).toContain('MB')
  })
})

describe('verify round-trip (Fase 2)', () => {
  it('packAndVerify: crear → releer → validar sin perder datos', async () => {
    const payload = samplePayload()
    const { packed, size } = await packAndVerify(payload, [], {
      deviceId: 'd1',
      deviceName: 'Test',
      platform: 'windows',
    })
    expect(size.status).toBe('ok')
    await verifyRoundTrip(packed.blob, packed.manifest.checksum)

    const again = await unpackBackupZip(packed.blob)
    expect(again.payload.fichas[0]?.nombre).toBe('Ficha demo')
  })

  it('round-trip con imagen grande (~1.2 MB)', async () => {
    const adjunto = largeAdjunto('big-photo', 1_200_000)
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

    const { packed, size } = await packAndVerify(payload, [adjunto], { deviceId: 'd1' })
    expect(size.status).toBe('ok')
    expect(packed.manifest.attachmentCount).toBe(1)

    const unpacked = await unpackBackupZip(packed.blob)
    expect(unpacked.adjuntos[0]?.blob.size).toBe(1_200_000)
    expect(new Uint8Array(await unpacked.adjuntos[0]!.blob.arrayBuffer())[100]).toBe(100 % 251)
  })

  it('detecta ZIP alterado tras empaquetar', async () => {
    const { packed } = await packAndVerify(samplePayload(), [], { deviceId: 'd1' })
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(packed.blob)
    zip.file(
      'backup.json',
      JSON.stringify(samplePayload({ exportedAt: '2099-01-01T00:00:00.000Z' })),
    )
    const broken = await zip.generateAsync({ type: 'blob' })
    await expect(verifyRoundTrip(broken, packed.manifest.checksum)).rejects.toThrow()
  })
})

describe('replaceWithRollback (Fase 2)', () => {
  it('aplica sin snapshot si no hace falta', async () => {
    let applied = false
    const result = await replaceWithRollback({
      needsSnapshot: false,
      createSnapshotBlob: async () => {
        throw new Error('no debería crear snapshot')
      },
      applyIncoming: async () => {
        applied = true
      },
      restoreSnapshotBlob: async () => {
        throw new Error('no debería restaurar')
      },
      store: createMemorySnapshotStore(),
    })
    expect(result.status).toBe('applied')
    expect(applied).toBe(true)
  })

  it('happy path: con datos previos aplica y borra el snapshot', async () => {
    const store = createMemorySnapshotStore()
    const prev = samplePayload({
      fichas: [
        {
          id: 'old',
          numero: '1',
          nombre: 'Antes',
          grupoId: 'b1',
          frecuencia: 'unica',
          fechaInicio: '2025-01',
          fechaPrecision: 'mes',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
    const next = samplePayload({
      fichas: [
        {
          id: 'new',
          numero: '2',
          nombre: 'Después',
          grupoId: 'b1',
          frecuencia: 'unica',
          fechaInicio: '2026-01',
          fechaPrecision: 'mes',
          createdAt: 2,
          updatedAt: 2,
        },
      ],
    })
    const { packed: snap } = await packAndVerify(prev, [], { deviceId: 'snap' })
    const { packed: incoming } = await packAndVerify(next, [], { deviceId: 'in' })

    let currentName = 'Antes'
    let restored = false
    const result = await replaceWithRollback({
      needsSnapshot: true,
      createSnapshotBlob: async () => snap.blob,
      applyIncoming: async () => {
        expect(await store.load()).not.toBeNull()
        const unpacked = await unpackBackupZip(incoming.blob, { requireManifest: true })
        currentName = unpacked.payload.fichas[0]?.nombre ?? ''
      },
      restoreSnapshotBlob: async () => {
        restored = true
      },
      store,
    })

    expect(result).toEqual({ status: 'applied', hadSnapshot: true })
    expect(currentName).toBe('Después')
    expect(restored).toBe(false)
    expect(await store.load()).toBeNull()
  })

  it('hace rollback si applyIncoming falla', async () => {
    const store = createMemorySnapshotStore()
    const snapshotPayload = samplePayload({
      fichas: [
        {
          id: 'old',
          numero: '9',
          nombre: 'Datos previos',
          grupoId: 'b1',
          frecuencia: 'unica',
          fechaInicio: '2025-01',
          fechaPrecision: 'mes',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
    const { packed: snap } = await packAndVerify(snapshotPayload, [], { deviceId: 'snap' })

    let currentName = 'Datos previos'
    const result = await replaceWithRollback({
      needsSnapshot: true,
      createSnapshotBlob: async () => snap.blob,
      applyIncoming: async () => {
        currentName = 'parcial'
        throw new Error('fallo a mitad')
      },
      restoreSnapshotBlob: async (blob) => {
        const unpacked = await unpackBackupZip(blob, { requireManifest: true })
        currentName = unpacked.payload.fichas[0]?.nombre ?? ''
      },
      store,
    })

    expect(result.status).toBe('rolled_back')
    expect(currentName).toBe('Datos previos')
    expect(await store.load()).toBeNull()
    if (result.status === 'rolled_back') {
      expect(rollbackUserMessage(result)).toMatch(/recuperaron|anteriores/i)
    }
  })

  it('deja snapshot si el rollback también falla', async () => {
    const store = createMemorySnapshotStore()
    const { packed: snap } = await packAndVerify(samplePayload(), [], { deviceId: 'snap' })

    const result = await replaceWithRollback({
      needsSnapshot: true,
      createSnapshotBlob: async () => snap.blob,
      applyIncoming: async () => {
        throw new Error('apply fail')
      },
      restoreSnapshotBlob: async () => {
        throw new Error('rollback fail')
      },
      store,
    })

    expect(result.status).toBe('rollback_failed')
    expect(await store.load()).not.toBeNull()
  })
})
