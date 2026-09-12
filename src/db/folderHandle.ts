const DB_NAME = 'maintmanage-handles'
const STORE = 'kv'
const KEY = 'backupFolder'

function openHandlesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir el almacén de carpeta.'))
  })
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const idb = await openHandlesDb()
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar la carpeta.'))
    tx.objectStore(STORE).put(handle, KEY)
  })
  idb.close()
}

export async function getFolderHandle(): Promise<FileSystemDirectoryHandle | undefined> {
  const idb = await openHandlesDb()
  const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined)
    req.onerror = () => reject(req.error ?? new Error('No se pudo leer la carpeta.'))
  })
  idb.close()
  return handle
}

export async function clearFolderHandle(): Promise<void> {
  const idb = await openHandlesDb()
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('No se pudo olvidar la carpeta.'))
    tx.objectStore(STORE).delete(KEY)
  })
  idb.close()
}
