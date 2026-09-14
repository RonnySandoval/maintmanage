import { db } from '../db'
import type { Actividad, Adjunto, Ejecucion, Ficha } from '../db/types'
import { actividadTitulo } from './actividades'
import { formatDate } from './dates'
import { fichaTitulo } from './fichas'
import { fileKind } from './files'
import { blobToFile } from './share'

export type AdjuntoViewMeta = {
  parentLabel: string
  dateLabel: string
  header: string
}

function dayFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Resuelve ficha/actividad y fecha visibles para un adjunto. */
export async function resolveAdjuntoMetas(
  adjuntos: Adjunto[],
  parentLabelOverride?: string,
): Promise<Record<string, AdjuntoViewMeta>> {
  const fichaIds = new Set<string>()
  const actIds = new Set<string>()
  const ejecIds = new Set<string>()
  const occIds = new Set<string>()
  const evtIds = new Set<string>()
  const accIds = new Set<string>()

  for (const a of adjuntos) {
    if (a.fichaId) fichaIds.add(a.fichaId)
    if (a.actividadId) actIds.add(a.actividadId)
    if (a.ejecucionId) ejecIds.add(a.ejecucionId)
  }

  const ejecuciones = new Map<string, Ejecucion>()
  if (ejecIds.size) {
    for (const e of await db.ejecuciones.bulkGet([...ejecIds])) {
      if (!e) continue
      ejecuciones.set(e.id, e)
      if (e.ocurrenciaId) occIds.add(e.ocurrenciaId)
      if (e.eventoId) evtIds.add(e.eventoId)
      if (e.accionId) accIds.add(e.accionId)
    }
  }

  const occToFicha = new Map<string, string>()
  if (occIds.size) {
    for (const occ of await db.ocurrencias.bulkGet([...occIds])) {
      if (occ?.fichaId) {
        occToFicha.set(occ.id, occ.fichaId)
        fichaIds.add(occ.fichaId)
      }
    }
  }

  const evtToAct = new Map<string, string>()
  if (evtIds.size) {
    for (const evt of await db.eventos.bulkGet([...evtIds])) {
      if (evt?.actividadId) {
        evtToAct.set(evt.id, evt.actividadId)
        actIds.add(evt.actividadId)
      }
    }
  }

  const accParents = new Map<string, { fichaId?: string; actividadId?: string }>()
  if (accIds.size) {
    for (const acc of await db.accionesCorrectivas.bulkGet([...accIds])) {
      if (!acc) continue
      accParents.set(acc.id, { fichaId: acc.fichaId, actividadId: acc.actividadId })
      if (acc.fichaId) fichaIds.add(acc.fichaId)
      if (acc.actividadId) actIds.add(acc.actividadId)
    }
  }

  const fichas = new Map<string, Ficha>()
  if (fichaIds.size) {
    for (const f of await db.fichas.bulkGet([...fichaIds])) {
      if (f) fichas.set(f.id, f)
    }
  }
  const actividades = new Map<string, Actividad>()
  if (actIds.size) {
    for (const a of await db.actividades.bulkGet([...actIds])) {
      if (a) actividades.set(a.id, a)
    }
  }

  const override = parentLabelOverride?.trim() || ''
  const out: Record<string, AdjuntoViewMeta> = {}
  for (const adj of adjuntos) {
    const ejec = adj.ejecucionId ? ejecuciones.get(adj.ejecucionId) : undefined
    let parent = override

    if (!parent) {
      let fichaId = adj.fichaId
      let actividadId = adj.actividadId
      if (ejec?.ocurrenciaId) fichaId = occToFicha.get(ejec.ocurrenciaId) ?? fichaId
      if (ejec?.eventoId) actividadId = evtToAct.get(ejec.eventoId) ?? actividadId
      if (ejec?.accionId) {
        const parents = accParents.get(ejec.accionId)
        fichaId = parents?.fichaId ?? fichaId
        actividadId = parents?.actividadId ?? actividadId
      }
      if (fichaId && fichas.get(fichaId)) parent = fichaTitulo(fichas.get(fichaId)!)
      else if (actividadId && actividades.get(actividadId)) {
        parent = actividadTitulo(actividades.get(actividadId)!)
      }
    }

    const dateLabel = ejec?.fechaReal ? formatDate(ejec.fechaReal) : dayFromTs(adj.createdAt)
    out[adj.id] = {
      parentLabel: parent,
      dateLabel,
      header: [dateLabel, parent].filter(Boolean).join(' · '),
    }
  }
  return out
}

export function adjuntoShareFiles(adjuntos: Adjunto[]): File[] {
  return adjuntos.map((a) => blobToFile(a.blob, a.nombre, a.mimeType))
}

export function adjuntoImageFiles(adjuntos: Adjunto[]): File[] {
  return adjuntos
    .filter((a) => fileKind(a.mimeType, a.nombre) === 'image')
    .map((a) => blobToFile(a.blob, a.nombre, a.mimeType))
}

export function adjuntoShareText(meta: AdjuntoViewMeta, nombre: string): string {
  return [meta.header || meta.parentLabel, nombre].filter(Boolean).join('\n')
}

export function grupoShareText(shareTitle: string, adjuntos: Adjunto[]): string {
  const lines = adjuntos.map((a) => `· ${a.nombre}`)
  return [`${shareTitle}`, `${adjuntos.length} archivo${adjuntos.length === 1 ? '' : 's'}`, ...lines]
    .filter(Boolean)
    .join('\n')
}
