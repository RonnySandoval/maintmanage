import JSZip from 'jszip'
import { db } from './index'
import type {
  AccionCorrectiva,
  Adjunto,
  Ajustes,
  Encargado,
  Ejecucion,
  Bloque,
  Ficha,
  Ocurrencia,
} from './types'
import { todayISO } from '../lib/dates'

type AdjuntoMeta = Omit<Adjunto, 'blob'>

export interface BackupPayload {
  version: 1
  exportedAt: string
  encargados: Encargado[]
  grupos: Bloque[]
  bloques?: Bloque[]
  fichas: Ficha[]
  ocurrencias: Ocurrencia[]
  ejecuciones: Ejecucion[]
  accionesCorrectivas: AccionCorrectiva[]
  ajustes: Ajustes[]
  adjuntosMeta: AdjuntoMeta[]
}

export async function exportBackup(): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip()
  const adjuntos = await db.adjuntos.toArray()
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    encargados: await db.encargados.toArray(),
    grupos: await db.grupos.toArray(),
    bloques: await db.grupos.toArray(),
    fichas: await db.fichas.toArray(),
    ocurrencias: await db.ocurrencias.toArray(),
    ejecuciones: await db.ejecuciones.toArray(),
    accionesCorrectivas: await db.accionesCorrectivas.toArray(),
    ajustes: await db.ajustes.toArray(),
    adjuntosMeta: adjuntos.map((adjunto) => ({
      id: adjunto.id,
      mimeType: adjunto.mimeType,
      nombre: adjunto.nombre,
      fichaId: adjunto.fichaId,
      ejecucionId: adjunto.ejecucionId,
      tipo: adjunto.tipo,
      createdAt: adjunto.createdAt,
    })),
  }
  zip.file('backup.json', JSON.stringify(payload))
  const folder = zip.folder('files')
  for (const adjunto of adjuntos) {
    folder?.file(adjunto.id, adjunto.blob)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, filename: `maintmanage-${todayISO()}.zip` }
}

export async function importBackup(file: Blob, mode: 'replace' | 'merge'): Promise<void> {
  const zip = await JSZip.loadAsync(file)
  const jsonFile = zip.file('backup.json')
  if (!jsonFile) {
    throw new Error('El archivo no es una copia de MaintManage (falta backup.json).')
  }
  const payload = JSON.parse(await jsonFile.async('string')) as BackupPayload
  if (payload.version !== 1) {
    throw new Error('Versión de copia no compatible.')
  }

  await db.transaction('rw', db.tables, async () => {
    if (mode === 'replace') {
      await Promise.all(db.tables.map((table) => table.clear()))
    }
    if (payload.encargados?.length) await db.encargados.bulkPut(payload.encargados)
    const bloques = payload.bloques?.length ? payload.bloques : payload.grupos
    if (bloques?.length) await db.grupos.bulkPut(bloques)
    if (payload.fichas?.length) {
      await db.fichas.bulkPut(
        payload.fichas.map((ficha) => ({
          ...ficha,
          numero: ficha.numero?.trim() ? ficha.numero : '',
        })),
      )
    }
    if (payload.ocurrencias?.length) await db.ocurrencias.bulkPut(payload.ocurrencias)
    if (payload.ejecuciones?.length) await db.ejecuciones.bulkPut(payload.ejecuciones)
    if (payload.accionesCorrectivas?.length) {
      await db.accionesCorrectivas.bulkPut(payload.accionesCorrectivas)
    }
    if (payload.ajustes?.length) await db.ajustes.bulkPut(payload.ajustes)

    for (const meta of payload.adjuntosMeta ?? []) {
      const entry = zip.file(`files/${meta.id}`)
      let blob: Blob = new Blob([], { type: meta.mimeType })
      if (entry) {
        const buffer = await entry.async('arraybuffer')
        blob = new Blob([buffer], { type: meta.mimeType })
      }
      await db.adjuntos.put({ ...meta, blob })
    }
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
