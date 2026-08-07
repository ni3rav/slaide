import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDeckRepository, type Deck, type DeckRepository, type Slide } from './deck-repository.ts'

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

  it('leaves deck and slides unchanged when delete deck transaction aborts', async () => {
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

  it('leaves deck and slides unchanged when delete slides transaction aborts', async () => {
    const created = await repository.createDeck()
    const originalDelete = IDBObjectStore.prototype.delete

    IDBObjectStore.prototype.delete = function patchedDelete(query) {
      const request = originalDelete.call(this, query)
      if (this.name === 'slides') {
        this.transaction.abort()
      }
      return request
    }

    try {
      await expect(
        repository.deleteSlides(created.deck.id, created.slides[0]!.id, [
          created.slides[0]!.id,
        ]),
      ).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.delete = originalDelete
    }

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck).toEqual(created.deck)
    expect(loaded.slides).toEqual(created.slides)
  })

  it('deletes checked slides and their scene records in one transaction', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id
    const afterB = await repository.insertSlideAfter(created.deck.id, slideB)
    const slideC = afterB.slide.id

    await repository.saveScene(slideA, {
      elements: [{ id: 'rect-1', type: 'rectangle' }],
      appState: {},
      files: {},
    })

    const deleted = await repository.deleteSlides(created.deck.id, slideB, [slideA, slideC])

    expect(deleted.deck.slideOrder).toEqual([slideB])
    expect(deleted.activeSlide.id).toBe(slideB)
    expect(deleted.slides).toHaveLength(1)
    expect(await getSlideRecord(databaseName, slideA)).toBeUndefined()
    expect(await getSlideRecord(databaseName, slideC)).toBeUndefined()
    expect((await getSlideRecord(databaseName, slideB))).toBeTruthy()

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck.slideOrder).toEqual([slideB])
    expect(loaded.slides).toHaveLength(1)
  })

  it('activates the following slide when the active slide is deleted', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id

    const deleted = await repository.deleteSlides(created.deck.id, slideA, [slideA])

    expect(deleted.deck.slideOrder).toEqual([slideB])
    expect(deleted.activeSlide.id).toBe(slideB)
  })

  it('activates the preceding slide when the deleted active slide was last', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id

    const deleted = await repository.deleteSlides(created.deck.id, slideB, [slideB])

    expect(deleted.deck.slideOrder).toEqual([slideA])
    expect(deleted.activeSlide.id).toBe(slideA)
  })

  it('creates and activates one blank slide when every slide is deleted', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id

    const deleted = await repository.deleteSlides(created.deck.id, slideB, [slideA, slideB])

    expect(deleted.deck.slideOrder).toHaveLength(1)
    expect(deleted.activeSlide.id).toBe(deleted.deck.slideOrder[0])
    expect(deleted.activeSlide.scene).toEqual({
      elements: [],
      appState: {},
      files: {},
    })
    expect(await getSlideRecord(databaseName, slideA)).toBeUndefined()
    expect(await getSlideRecord(databaseName, slideB)).toBeUndefined()
    expect(deleted.deck.slideOrder[0]).not.toBe(slideA)
    expect(deleted.deck.slideOrder[0]).not.toBe(slideB)
  })

  it('rejects deleteSlides when no slide ids are provided', async () => {
    const created = await repository.createDeck()

    await expect(
      repository.deleteSlides(created.deck.id, created.slides[0]!.id, []),
    ).rejects.toThrow('No slides selected for deletion')
  })

  it('rejects deleteSlides when a slide is not in slide order', async () => {
    const created = await repository.createDeck()

    await expect(
      repository.deleteSlides(created.deck.id, created.slides[0]!.id, [crypto.randomUUID()]),
    ).rejects.toThrow('Slide not found in deck')
  })

  it('imports a remapped deck and slides in one transaction', async () => {
    const existing = await repository.createDeck()
    const importPayload = buildImportPayload('Imported deck')

    const imported = await repository.importDeck(importPayload.deck, importPayload.slides)

    expect(imported.deck.id).toBe(importPayload.deck.id)
    expect(imported.slides).toHaveLength(1)
    expect(await repository.listDecks()).toHaveLength(2)

    const loaded = await repository.loadDeck(imported.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck).toEqual(imported.deck)
    expect(loaded.slides).toEqual(imported.slides)

    const original = await repository.loadDeck(existing.deck.id)
    expect(original.status).toBe('ok')
  })

  it('rejects import when the deck id already exists', async () => {
    const created = await repository.createDeck()

    await expect(
      repository.importDeck(created.deck, created.slides),
    ).rejects.toThrow(/overwrite/i)
  })

  it('leaves storage unchanged when import transaction aborts', async () => {
    const existing = await repository.createDeck()
    const importPayload = buildImportPayload('Rollback deck')
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
        repository.importDeck(importPayload.deck, importPayload.slides),
      ).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }

    expect(await repository.listDecks()).toHaveLength(1)
    expect(await repository.loadDeck(importPayload.deck.id)).toEqual({ status: 'missing' })
    expect(await repository.loadDeck(existing.deck.id)).toEqual({
      status: 'ok',
      deck: existing.deck,
      slides: existing.slides,
    })
  })

  it('reports a clear error when import fails due to storage quota', async () => {
    const importPayload = buildImportPayload('Quota deck')
    const originalPut = IDBObjectStore.prototype.put

    IDBObjectStore.prototype.put = function patchedPut(value, key) {
      if (this.name === 'slides') {
        IDBObjectStore.prototype.put = originalPut
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      return originalPut.call(this, value, key)
    }

    try {
      await expect(
        repository.importDeck(importPayload.deck, importPayload.slides),
      ).rejects.toThrow(/storage is full/i)
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }

    expect(await repository.listDecks()).toEqual([])
    expect(await repository.loadDeck(importPayload.deck.id)).toEqual({ status: 'missing' })
  })

  it('reorders one slide by insertion index and updates deck last-modified time', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id
    const afterB = await repository.insertSlideAfter(created.deck.id, slideB)
    const slideC = afterB.slide.id

    const reordered = await repository.reorderSlide(created.deck.id, slideA, 3)

    expect(reordered.deck.slideOrder).toEqual([slideB, slideC, slideA])
    expect(reordered.deck.updatedAt).toBeGreaterThanOrEqual(created.deck.updatedAt)
    expect(reordered.slides.map((slide) => slide.id)).toEqual(reordered.deck.slideOrder)

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck.slideOrder).toEqual([slideB, slideC, slideA])
  })

  it('is a no-op when the insertion point keeps the slide in place', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const before = await repository.loadDeck(created.deck.id)
    expect(before.status).toBe('ok')
    if (before.status !== 'ok') return

    const reordered = await repository.reorderSlide(created.deck.id, slideA, 1)

    expect(reordered.deck.slideOrder).toEqual([slideA, afterA.slide.id])
    expect(reordered.deck.updatedAt).toBe(before.deck.updatedAt)
  })

  it('rejects reorderSlide when the deck is missing', async () => {
    await expect(
      repository.reorderSlide(crypto.randomUUID(), crypto.randomUUID(), 0),
    ).rejects.toThrow('Deck not found')
  })

  it('rejects reorderSlide when the slide is not in slide order', async () => {
    const created = await repository.createDeck()

    await expect(
      repository.reorderSlide(created.deck.id, crypto.randomUUID(), 0),
    ).rejects.toThrow('Slide not found in deck')
  })

  it('leaves deck unchanged when reorder transaction aborts', async () => {
    const created = await repository.createDeck()
    const slideA = created.deck.slideOrder[0]!
    const afterA = await repository.insertSlideAfter(created.deck.id, slideA)
    const slideB = afterA.slide.id
    const originalPut = IDBObjectStore.prototype.put

    IDBObjectStore.prototype.put = function patchedPut(value, key) {
      const request = originalPut.call(this, value, key)
      if (this.name === 'decks') {
        IDBObjectStore.prototype.put = originalPut
        this.transaction.abort()
      }
      return request
    }

    try {
      await expect(
        repository.reorderSlide(created.deck.id, slideA, 2),
      ).rejects.toThrow()
    } finally {
      IDBObjectStore.prototype.put = originalPut
    }

    const loaded = await repository.loadDeck(created.deck.id)
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    expect(loaded.deck.slideOrder).toEqual([slideA, slideB])
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
    const request = indexedDB.open(databaseName, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('decks')) {
        database.createObjectStore('decks', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('slides')) {
        database.createObjectStore('slides', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' })
      }
    }
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

function buildImportPayload(title: string): { deck: Deck; slides: Slide[] } {
  const deckId = crypto.randomUUID()
  const slideId = crypto.randomUUID()
  const now = Date.now()
  return {
    deck: {
      id: deckId,
      schemaVersion: 1,
      title,
      slideOrder: [slideId],
      createdAt: now,
      updatedAt: now,
    },
    slides: [
      {
        id: slideId,
        schemaVersion: 1,
        deckId,
        scene: { elements: [], appState: {}, files: {} },
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}
