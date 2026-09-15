import { describe, expect, it, vi } from 'vitest'
import { packAndVerify } from './verify'
import type { BackupPayload } from './payload'
import { restoreFromGmail, type CloudRestoreProgress } from './cloudBackup'

function samplePayload(): BackupPayload {
  return {
    version: 1,
    exportedAt: '2026-09-15T01:00:00.000Z',
    encargados: [],
    grupos: [],
    fichas: [
      {
        id: 'f1',
        numero: '1',
        nombre: 'Restaurada',
        grupoId: 'b1',
        frecuencia: 'unica',
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
    ajustes: [{ id: 'app', umbralProximaDias: 7, notificaciones: false }],
    adjuntosMeta: [],
  }
}

describe('restoreFromGmail (Fase 5)', () => {
  it('descarga → valida → importa en orden', async () => {
    const { packed } = await packAndVerify(samplePayload(), [], { deviceId: 't' })
    const steps: CloudRestoreProgress[] = []
    const importFile = vi.fn(async () => 'zip')
    const afterRestore = vi.fn(async () => undefined)

    await restoreFromGmail(
      'remote-1',
      (step) => steps.push(step),
      {
        download: async (id) => {
          expect(id).toBe('remote-1')
          return packed.blob
        },
        importFile,
        afterRestore,
      },
    )

    expect(steps).toEqual(['downloading', 'validating', 'restoring', 'done'])
    expect(importFile).toHaveBeenCalledOnce()
    expect(afterRestore).toHaveBeenCalledOnce()
  })

  it('no importa si la validación falla', async () => {
    const importFile = vi.fn(async () => 'zip')
    const steps: CloudRestoreProgress[] = []

    await expect(
      restoreFromGmail(
        'bad',
        (step) => steps.push(step),
        {
          download: async () => new Blob(['not-a-zip']),
          importFile,
          afterRestore: async () => undefined,
        },
      ),
    ).rejects.toThrow()

    expect(importFile).not.toHaveBeenCalled()
    expect(steps).toContain('error')
    expect(steps).toContain('downloading')
    expect(steps).toContain('validating')
  })
})
