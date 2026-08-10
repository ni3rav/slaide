import type { LibraryItems } from '@excalidraw/excalidraw/types'
import {
  getRecord,
  openSlaideDatabase,
  SETTINGS_STORE,
} from './database.ts'

export type LibraryRepository = {
  getLibraryItems: () => Promise<LibraryItems>
  setLibraryItems: (libraryItems: LibraryItems) => Promise<void>
  dispose: () => Promise<void>
}

const LIBRARY_ITEMS_SETTING_KEY = 'libraryItems'

type CreateLibraryRepositoryOptions = {
  databaseName?: string
}

type LibraryItemsSettingRecord = {
  key: typeof LIBRARY_ITEMS_SETTING_KEY
  value: LibraryItems
}

export async function createLibraryRepository(
  options: CreateLibraryRepositoryOptions = {},
): Promise<LibraryRepository> {
  const db = await openSlaideDatabase(options.databaseName)

  return {
    async getLibraryItems() {
      const record = await getRecord<LibraryItemsSettingRecord>(
        db,
        SETTINGS_STORE,
        LIBRARY_ITEMS_SETTING_KEY,
      )
      if (!record || !Array.isArray(record.value)) {
        return []
      }
      return record.value
    },

    async setLibraryItems(libraryItems) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () =>
          reject(tx.error ?? new Error('Failed to save library items'))
        tx.onabort = () =>
          reject(tx.error ?? new Error('Library items save aborted'))
        tx.objectStore(SETTINGS_STORE).put({
          key: LIBRARY_ITEMS_SETTING_KEY,
          value: libraryItems,
        } satisfies LibraryItemsSettingRecord)
      })
    },

    async dispose() {
      db.close()
    },
  }
}
