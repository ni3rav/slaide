import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createPreferencesRepository,
  type PreferencesRepository,
} from './preferences-repository.ts'

describe('PreferencesRepository', () => {
  let databaseName: string
  let repository: PreferencesRepository

  beforeEach(async () => {
    databaseName = `slaide-test-${crypto.randomUUID()}`
    repository = await createPreferencesRepository({ databaseName })
  })

  afterEach(async () => {
    await repository.dispose()
    await deleteDatabase(databaseName)
  })

  it('returns null when no explicit theme preference is stored', async () => {
    expect(await repository.getThemePreference()).toBeNull()
  })

  it('persists an explicit light or dark theme preference', async () => {
    await repository.setThemePreference('dark')
    expect(await repository.getThemePreference()).toBe('dark')

    await repository.setThemePreference('light')
    expect(await repository.getThemePreference()).toBe('light')
  })
})

async function deleteDatabase(databaseName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to delete database'))
    request.onblocked = () => resolve()
  })
}
