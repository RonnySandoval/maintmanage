import type { MaintDB } from '../db'

const TRACKED = [
  'encargados',
  'grupos',
  'fichas',
  'ocurrencias',
  'ejecuciones',
  'accionesCorrectivas',
  'adjuntos',
] as const

let suppressDataTouch = false
let touchQueued = false

export function queueDataTouch(db: MaintDB): void {
  if (suppressDataTouch || touchQueued) return
  touchQueued = true
  queueMicrotask(() => {
    touchQueued = false
    if (suppressDataTouch) return
    void db.ajustes.update('app', { lastChangedAt: Date.now() })
  })
}

export async function withoutDataTouch<T>(fn: () => Promise<T>): Promise<T> {
  suppressDataTouch = true
  try {
    return await fn()
  } finally {
    suppressDataTouch = false
  }
}

export function registerChangeHooks(db: MaintDB): void {
  for (const name of TRACKED) {
    const table = db.table(name)
    table.hook('creating', () => {
      queueDataTouch(db)
    })
    table.hook('updating', () => {
      queueDataTouch(db)
    })
    table.hook('deleting', () => {
      queueDataTouch(db)
    })
  }
}
