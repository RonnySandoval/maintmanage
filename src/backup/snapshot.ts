const DB_NAME = 'maintmanage-restore'
const DB_VERSION = 1
const STORE = 'snapshots'
const KEY = 'pre-restore'

export interface SnapshotStore {
  save(blob: Blob): Promise<void>
  load(): Promise<Blob | null>
  clear(): Promise<void>
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el almacén de restauración.'))
  })
}

/** Almacén IndexedDB separado de `maintmanage` (sobrevive a un clear de la app). */
export const idbSnapshotStore: SnapshotStore = {
  async save(blob) {
    const db = await openDb()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar la copia temporal.'))
        tx.objectStore(STORE).put(blob, KEY)
      })
    } finally {
      db.close()
    }
  },

  async load() {
    const db = await openDb()
    try {
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(KEY)
        req.onsuccess = () => {
          const value = req.result
          resolve(value instanceof Blob ? value : null)
        }
        req.onerror = () => reject(req.error ?? new Error('No se pudo leer la copia temporal.'))
      })
    } finally {
      db.close()
    }
  },

  async clear() {
    const db = await openDb()
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('No se pudo borrar la copia temporal.'))
        tx.objectStore(STORE).delete(KEY)
      })
    } finally {
      db.close()
    }
  },
}

/** Store en memoria para pruebas. */
export function createMemorySnapshotStore(): SnapshotStore {
  let current: Blob | null = null
  return {
    async save(blob) {
      current = blob
    },
    async load() {
      return current
    },
    async clear() {
      current = null
    },
  }
}
