import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestPersistentStorageAfterFirstDeck,
  resetPersistentStorageRequestForTests,
} from './persistent-storage.ts'

describe('requestPersistentStorageAfterFirstDeck', () => {
  afterEach(() => {
    resetPersistentStorageRequestForTests()
    vi.unstubAllGlobals()
  })

  it('calls navigator.storage.persist once', async () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } })

    await requestPersistentStorageAfterFirstDeck()
    await requestPersistentStorageAfterFirstDeck()

    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('continues when persist is denied', async () => {
    const persist = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('navigator', { storage: { persist } })

    await expect(requestPersistentStorageAfterFirstDeck()).resolves.toBeUndefined()
  })

  it('continues when persist throws', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('denied'))
    vi.stubGlobal('navigator', { storage: { persist } })

    await expect(requestPersistentStorageAfterFirstDeck()).resolves.toBeUndefined()
  })

  it('no-ops when persist is unavailable', async () => {
    vi.stubGlobal('navigator', { storage: {} })

    await expect(requestPersistentStorageAfterFirstDeck()).resolves.toBeUndefined()
  })
})
