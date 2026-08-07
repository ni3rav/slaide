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

  it('lists decks ordered by most recently modified', async () => {
    const older = await repository.createDeck()
    await waitForNextTimestamp()
    const newer = await repository.createDeck()

    expect(await repository.listDecks()).toEqual([
      {
        id: newer.deck.id,
        title: 'Untitled deck',
        slideCount: 1,
        updatedAt: newer.deck.updatedAt,
      },
      {
        id: older.deck.id,
        title: 'Untitled deck',
        slideCount: 1,
        updatedAt: older.deck.updatedAt,
      },
    ])
  })

  it('renames a deck, updates last-modified time, and accepts duplicate titles', async () => {
    const first = await repository.createDeck()
    const second = await repository.createDeck()
    await waitForNextTimestamp()

    const renamed = await repository.renameDeck(first.deck.id, 'Q3 review')
    await waitForNextTimestamp()
    const alsoNamed = await repository.renameDeck(second.deck.id, 'Q3 review')

    expect(renamed.title).toBe('Q3 review')
    expect(renamed.updatedAt).toBeGreaterThan(first.deck.updatedAt)
    expect(alsoNamed.title).toBe('Q3 review')
    expect(alsoNamed.updatedAt).toBeGreaterThan(renamed.updatedAt)

    const listed = await repository.listDecks()
    expect(listed.map((deck) => deck.id)).toEqual([alsoNamed.id, renamed.id])
    expect(listed.every((deck) => deck.title === 'Q3 review')).toBe(true)

    const loaded = await repository.loadDeck(first.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck.title).toBe('Q3 review')
    expect(loaded.deck.updatedAt).toBe(renamed.updatedAt)
  })

  it('deletes a deck and every owned slide in one transaction', async () => {
    const created = await repository.createDeck()
    const extraSlideId = await addSlideToDeck(databaseName, created.deck)

    await repository.deleteDeck(created.deck.id)

    expect(await repository.loadDeck(created.deck.id)).toEqual({ status: 'missing' })
    expect(await repository.listDecks()).toEqual([])
    expect(await getSlideRecord(databaseName, created.deck.slideOrder[0]!)).toBeUndefined()
    expect(await getSlideRecord(databaseName, extraSlideId)).toBeUndefined()
  })

  it('saves a scene with binary files and updates deck last-modified time', async () => {
    const created = await repository.createDeck()
    await waitForNextTimestamp()

    const scene = {
      elements: [{ id: 'rect-1', type: 'rectangle', x: 12, y: 34 }],
      appState: { viewBackgroundColor: '#ff00aa' },
      files: {
        img1: {
          id: 'img1',
          mimeType: 'image/png',
          dataURL: 'data:image/png;base64,abc',
        },
      },
    }

    const saved = await repository.saveScene(created.slides[0]!.id, scene)
    const loaded = await repository.loadDeck(created.deck.id)

    expect(saved.scene).toEqual(scene)
    expect(saved.updatedAt).toBeGreaterThan(created.slides[0]!.updatedAt)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.slides[0]?.scene).toEqual(scene)
    expect(loaded.deck.updatedAt).toBe(saved.updatedAt)
  })

  it('rejects saveScene when the slide is missing', async () => {
    await expect(
      repository.saveScene(crypto.randomUUID(), {
        elements: [],
        appState: {},
        files: {},
      }),
    ).rejects.toThrow('Slide not found')
  })

  it('inserts a blank slide immediately after the active slide', async () => {
    const created = await repository.createDeck()
    const firstSlideId = created.deck.slideOrder[0]!

    const inserted = await repository.insertSlideAfter(created.deck.id, firstSlideId)

    expect(inserted.slide.scene).toEqual({
      elements: [],
      appState: {},
      files: {},
    })
    expect(inserted.deck.slideOrder).toEqual([firstSlideId, inserted.slide.id])
    expect(inserted.slides).toHaveLength(2)
    expect(inserted.slides[0]?.id).toBe(firstSlideId)
    expect(inserted.slides[1]?.id).toBe(inserted.slide.id)
    expect(inserted.deck.updatedAt).toBeGreaterThanOrEqual(created.deck.updatedAt)

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck.slideOrder).toEqual(inserted.deck.slideOrder)
    expect(loaded.slides).toHaveLength(2)
  })

  it('inserts slides at the requested positions in slide order', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!

    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id

    const afterAAgain = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideC = afterAAgain.slide.id

    expect(afterAAgain.deck.slideOrder).toEqual([slideA, slideC, slideB])
  })

  it('rejects insertSlideAfter when the deck is missing', async () => {
    await expect(
      repository.insertSlideAfter(crypto.randomUUID(), crypto.randomUUID()),
    ).rejects.toThrow('Deck not found')
  })

  it('rejects insertSlideAfter when the after slide is not in slide order', async () => {
    const created = await repository.createDeck()

    await expect(
      repository.insertSlideAfter(created.deck.id, crypto.randomUUID()),
    ).rejects.toThrow('Slide not found in deck')
  })

  it('leaves deck and slides unchanged when insert transaction aborts', async () => {
    const created = await repository.createDeck()
    const slideId = created.deck.slideOrder[0]!
    const originalPut = IDBObjectStore.prototype.put

    IDBObjectStore.prototype.put = function patchedPut(value, key) {
      const request = originalPut.call(this, value, key)
      if (this.name === 'slides') {
        IDBObjectStore.prototype.put = originalPut
        this.transaction.abort()
      }
      return request
    }

    try {
      await expect(
        repository.insertSlideAfter(created.deck.id, slideId),
      ).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck).toEqual(created.deck)
    expect(loaded.slides).toEqual(created.slides)
  })

  it('leaves deck and slides unchanged when delete transaction aborts', async () => {
    const created = await repository.createDeck()
    const originalDelete = IDBObjectStore.prototype.delete

    IDBObjectStore.prototype.delete = function patchedDelete(query) {
      const request = originalDelete.call(this, query)
      if (this.name === 'decks') {
        this.transaction.abort()
      }
      return request
    }

    try {
      await expect(repository.deleteDeck(created.deck.id)).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.delete = originalDelete
    }

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck).toEqual(created.deck)
    expect(loaded.slides).toEqual(created.slides)
  })
})

async function patchDeckSlideOrder(
  databaseName: string,
  deckId: string,
  slideOrder: string[],
): Promise<void> {
  const db = await openTestDatabase(databaseName)

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

async function addSlideToDeck(
  databaseName: string,
  deck: { id: string; slideOrder: string[] },
): Promise<string> {
  const slideId = crypto.randomUUID()
  const db = await openTestDatabase(databaseName)

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['decks', 'slides'], 'readwrite')
    const decks = tx.objectStore('decks')
    const slides = tx.objectStore('slides')
    const getRequest = decks.get(deck.id)
    getRequest.onsuccess = () => {
      const stored = getRequest.result as { slideOrder: string[] }
      stored.slideOrder = [...stored.slideOrder, slideId]
      decks.put(stored)
      slides.put({
        id: slideId,
        schemaVersion: 1,
        deckId: deck.id,
        scene: { elements: [], appState: {}, files: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('add slide failed'))
  })

  db.close()
  return slideId
}

async function getSlideRecord(
  databaseName: string,
  slideId: string,
): Promise<unknown> {
  const db = await openTestDatabase(databaseName)
  const slide = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction('slides', 'readonly')
    const request = tx.objectStore('slides').get(slideId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('get slide failed'))
  })
  db.close()
  return slide
}

function openTestDatabase(databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('open failed'))
  })
}

function waitForNextTimestamp(): Promise<void> {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      if (Date.now() > start) {
        resolve()
        return
      }
      setTimeout(tick, 1)
    }
    tick()
  })
}

async function deleteDatabase(databaseName: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('Failed to delete database'))
    request.onblocked = () => resolve()
  })
}
