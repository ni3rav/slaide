import { describe, expect, it } from 'vitest'
import { openSlaideDatabase, DATABASE_VERSION } from './database.ts'
import { createDeckRepository } from './deck-repository.ts'

describe('IndexedDB forward migrations', () => {
  it('upgrades from version 1 to the current schema while preserving decks', async () => {
    const databaseName = `slaide-migrate-${crypto.randomUUID()}`
    const deckId = crypto.randomUUID()
    const slideId = crypto.randomUUID()
    const now = Date.now()

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('decks', { keyPath: 'id' })
        db.createObjectStore('slides', { keyPath: 'id' })
      }
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction(['decks', 'slides'], 'readwrite')
        tx.objectStore('decks').put({
          id: deckId,
          schemaVersion: 1,
          title: 'Migrated deck',
          slideOrder: [slideId],
          createdAt: now,
          updatedAt: now,
        })
        tx.objectStore('slides').put({
          id: slideId,
          schemaVersion: 1,
          deckId,
          scene: { elements: [], appState: {}, files: {} },
          createdAt: now,
          updatedAt: now,
        })
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error ?? new Error('seed failed'))
      }
      request.onerror = () => reject(request.error ?? new Error('open v1 failed'))
    })

    const upgraded = await openSlaideDatabase(databaseName)
    expect(upgraded.version).toBe(DATABASE_VERSION)
    expect([...upgraded.objectStoreNames].sort()).toEqual([
      'decks',
      'settings',
      'slides',
    ])
    upgraded.close()

    const repository = await createDeckRepository({ databaseName })
    try {
      const loaded = await repository.loadDeck(deckId)
      expect(loaded.status).toBe('ok')
      if (loaded.status !== 'ok') return
      expect(loaded.deck.title).toBe('Migrated deck')
      expect(loaded.slides).toHaveLength(1)
      expect(loaded.slides[0]?.id).toBe(slideId)
    } finally {
      await repository.dispose()
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(databaseName)
        request.onsuccess = () => resolve()
        request.onerror = () =>
          reject(request.error ?? new Error('Failed to delete database'))
        request.onblocked = () => resolve()
      })
    }
  })
})
