import {
  getRecord,
  openSlaideDatabase,
  SETTINGS_STORE,
} from './database.ts'

export type ThemePreference = 'light' | 'dark'

export type PreferencesRepository = {
  getThemePreference: () => Promise<ThemePreference | null>
  setThemePreference: (theme: ThemePreference) => Promise<void>
  dispose: () => Promise<void>
}

const THEME_SETTING_KEY = 'theme'

type CreatePreferencesRepositoryOptions = {
  databaseName?: string
}

type ThemeSettingRecord = {
  key: typeof THEME_SETTING_KEY
  value: ThemePreference
}

export async function createPreferencesRepository(
  options: CreatePreferencesRepositoryOptions = {},
): Promise<PreferencesRepository> {
  const db = await openSlaideDatabase(options.databaseName)

  return {
    async getThemePreference() {
      const record = await getRecord<ThemeSettingRecord>(db, SETTINGS_STORE, THEME_SETTING_KEY)
      if (!record || (record.value !== 'light' && record.value !== 'dark')) {
        return null
      }
      return record.value
    },

    async setThemePreference(theme) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SETTINGS_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to save theme preference'))
        tx.onabort = () => reject(tx.error ?? new Error('Theme preference save aborted'))
        tx.objectStore(SETTINGS_STORE).put({
          key: THEME_SETTING_KEY,
          value: theme,
        } satisfies ThemeSettingRecord)
      })
    },

    async dispose() {
      db.close()
    },
  }
}
