export const DEFAULT_DATABASE_NAME = 'slaide'
export const DATABASE_VERSION = 2
export const DECKS_STORE = 'decks'
export const SLIDES_STORE = 'slides'
export const SETTINGS_STORE = 'settings'

export function openSlaideDatabase(databaseName = DEFAULT_DATABASE_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DECKS_STORE)) {
        database.createObjectStore(DECKS_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(SLIDES_STORE)) {
        database.createObjectStore(SLIDES_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open database'))
  })
}

export function getRecord<T>(
  db: IDBDatabase,
  storeName: string,
  key: string,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const request = tx.objectStore(storeName).get(key)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error ?? new Error(`Failed to read ${storeName}`))
  })
}
