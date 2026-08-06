import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDeckRepository, type DeckRepository } from './deck-repository.ts'

describe('DeckRepository', () => {
  let databaseName: string
  let repository: DeckRepository

  beforeEach(async () => {
    databaseName = `slaide-test-${crypto.randomUUID()}`
    repository = await createDeckRepository({ databaseName })
  })

  afterEach(async () => {
    await repository.dispose()
    await deleteDatabase(databaseName)
  })

  it('creates an Untitled deck with one blank slide in one transaction', async () => {
    const created = await repository.createDeck()

    expect(created.deck.title).toBe('Untitled deck')
    expect(created.deck.schemaVersion).toBe(1)
    expect(created.deck.slideOrder).toHaveLength(1)
    expect(created.deck.createdAt).toBe(created.deck.updatedAt)
    expect(created.slides[0]?.schemaVersion).toBe(1)
    expect(created.slides[0]?.createdAt).toBe(created.deck.createdAt)
    expect(created.deck.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return

    expect(loaded.deck).toEqual(created.deck)
    expect(loaded.slides).toHaveLength(1)
    expect(loaded.slides[0]?.id).toBe(created.deck.slideOrder[0])
    expect(loaded.slides[0]?.deckId).toBe(created.deck.id)
    expect(loaded.slides[0]?.scene).toEqual({
      elements: [],
      appState: {},
      files: {},
    })
  })

  it('lists locally stored decks', async () => {
    const first = await repository.createDeck()
    const second = await repository.createDeck()

    const decks = await repository.listDecks()

    expect(decks).toHaveLength(2)
    expect(decks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.deck.id,
          title: 'Untitled deck',
          slideCount: 1,
        }),
        expect.objectContaining({
          id: second.deck.id,
          title: 'Untitled deck',
          slideCount: 1,
        }),
      ]),
    )
  })

  it('reports missing when the deck id is unknown', async () => {
    const loaded = await repository.loadDeck(crypto.randomUUID())
    expect(loaded).toEqual({ status: 'missing' })
  })

  it('reports corrupt when a slide in slide order is missing without replacing the deck', async () => {
    const created = await repository.createDeck()

    await patchDeckSlideOrder(databaseName, created.deck.id, [crypto.randomUUID()])

    const loaded = await repository.loadDeck(created.deck.id)

    expect(loaded).toEqual({ status: 'corrupt' })
    expect(await repository.listDecks()).toEqual([
      {
        id: created.deck.id,
        title: 'Untitled deck',
        slideCount: 1,
        updatedAt: created.deck.updatedAt,
      },
    ])
  })
})

async function patchDeckSlideOrder(
  databaseName: string,
  deckId: string,
  slideOrder: string[],
): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('open failed'))
  })

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('decks', 'readwrite')
    const store = tx.objectStore('decks')
    const getRequest = store.get(deckId)
    getRequest.onsuccess = () => {
      const deck = getRequest.result as { slideOrder: string[] }
      deck.slideOrder = slideOrder
      store.put(deck)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('patch failed'))
  })

  db.close()
}

async function deleteDatabase(databaseName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to delete database'))
    request.onblocked = () => resolve()
  })
}
