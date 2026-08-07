export type DeckId = string
export type SlideId = string

export type Scene = {
  elements: unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown>
}

export type Deck = {
  id: DeckId
  schemaVersion: number
  title: string
  slideOrder: SlideId[]
  createdAt: number
  updatedAt: number
}

export type Slide = {
  id: SlideId
  schemaVersion: number
  deckId: DeckId
  scene: Scene
  createdAt: number
  updatedAt: number
}

export type CreatedDeck = {
  deck: Deck
  slides: Slide[]
}

export type InsertedSlide = {
  deck: Deck
  slide: Slide
  slides: Slide[]
}

export type LoadDeckResult =
  | { status: 'ok'; deck: Deck; slides: Slide[] }
  | { status: 'missing' }
  | { status: 'corrupt' }

export type DeckSummary = {
  id: DeckId
  title: string
  slideCount: number
  updatedAt: number
}

export type DeckRepository = {
  createDeck: () => Promise<CreatedDeck>
  listDecks: () => Promise<DeckSummary[]>
  loadDeck: (deckId: DeckId) => Promise<LoadDeckResult>
  renameDeck: (deckId: DeckId, title: string) => Promise<Deck>
  deleteDeck: (deckId: DeckId) => Promise<void>
  saveScene: (slideId: SlideId, scene: Scene) => Promise<Slide>
  insertSlideAfter: (deckId: DeckId, afterSlideId: SlideId) => Promise<InsertedSlide>
  dispose: () => Promise<void>
}

const DEFAULT_DATABASE_NAME = 'slaide'
const DATABASE_VERSION = 1
const RECORD_SCHEMA_VERSION = 1
const DECKS_STORE = 'decks'
const SLIDES_STORE = 'slides'

const blankScene = (): Scene => ({
  elements: [],
  appState: {},
  files: {},
})

type CreateDeckRepositoryOptions = {
  databaseName?: string
}

export async function createDeckRepository(
  options: CreateDeckRepositoryOptions = {},
): Promise<DeckRepository> {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME
  const db = await openDatabase(databaseName)

  return {
    async createDeck() {
      const deckId = crypto.randomUUID()
      const slideId = crypto.randomUUID()
      const now = Date.now()
      const deck: Deck = {
        id: deckId,
        schemaVersion: RECORD_SCHEMA_VERSION,
        title: 'Untitled deck',
        slideOrder: [slideId],
        createdAt: now,
        updatedAt: now,
      }
      const slide: Slide = {
        id: slideId,
        schemaVersion: RECORD_SCHEMA_VERSION,
        deckId,
        scene: blankScene(),
        createdAt: now,
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to create deck'))
        tx.onabort = () => reject(tx.error ?? new Error('Deck creation aborted'))
        tx.objectStore(DECKS_STORE).put(deck)
        tx.objectStore(SLIDES_STORE).put(slide)
      })

      return { deck, slides: [slide] }
    },

    async listDecks() {
      const decks = await new Promise<Deck[]>((resolve, reject) => {
        const tx = db.transaction(DECKS_STORE, 'readonly')
        const request = tx.objectStore(DECKS_STORE).getAll()
        request.onsuccess = () => resolve(request.result as Deck[])
        request.onerror = () => reject(request.error ?? new Error('Failed to list decks'))
      })

      return decks
        .map((deck) => ({
          id: deck.id,
          title: deck.title,
          slideCount: deck.slideOrder.length,
          updatedAt: deck.updatedAt,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async loadDeck(deckId) {
      const deck = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!deck) return { status: 'missing' }

      if (!isValidDeck(deck)) return { status: 'corrupt' }

      const slides: Slide[] = []
      for (const slideId of deck.slideOrder) {
        const slide = await getRecord<Slide>(db, SLIDES_STORE, slideId)
        if (!slide || !isValidSlide(slide, deckId)) return { status: 'corrupt' }
        slides.push(slide)
      }

      return { status: 'ok', deck, slides }
    },

    async renameDeck(deckId, title) {
      const existing = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!existing || !isValidDeck(existing)) {
        throw new Error('Deck not found')
      }

      const updated: Deck = {
        ...existing,
        title,
        updatedAt: Date.now(),
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DECKS_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to rename deck'))
        tx.onabort = () => reject(tx.error ?? new Error('Deck rename aborted'))
        tx.objectStore(DECKS_STORE).put(updated)
      })

      return updated
    },

    async deleteDeck(deckId) {
      const existing = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!existing || !isValidDeck(existing)) {
        throw new Error('Deck not found')
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to delete deck'))
        tx.onabort = () => reject(tx.error ?? new Error('Deck deletion aborted'))
        const decks = tx.objectStore(DECKS_STORE)
        const slides = tx.objectStore(SLIDES_STORE)
        for (const slideId of existing.slideOrder) {
          slides.delete(slideId)
        }
        decks.delete(deckId)
      })
    },

    async saveScene(slideId, scene) {
      const existing = await getRecord<Slide>(db, SLIDES_STORE, slideId)
      if (!existing || !isValidSlide(existing, existing.deckId)) {
        throw new Error('Slide not found')
      }

      const deck = await getRecord<Deck>(db, DECKS_STORE, existing.deckId)
      if (!deck || !isValidDeck(deck)) {
        throw new Error('Deck not found')
      }

      const now = Date.now()
      const updatedSlide: Slide = {
        ...existing,
        scene,
        updatedAt: now,
      }
      const updatedDeck: Deck = {
        ...deck,
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to save scene'))
        tx.onabort = () => reject(tx.error ?? new Error('Scene save aborted'))
        tx.objectStore(SLIDES_STORE).put(updatedSlide)
        tx.objectStore(DECKS_STORE).put(updatedDeck)
      })

      return updatedSlide
    },

    async insertSlideAfter(deckId, afterSlideId) {
      const deck = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!deck || !isValidDeck(deck)) {
        throw new Error('Deck not found')
      }

      const afterIndex = deck.slideOrder.indexOf(afterSlideId)
      if (afterIndex === -1) {
        throw new Error('Slide not found in deck')
      }

      const slideId = crypto.randomUUID()
      const now = Date.now()
      const slide: Slide = {
        id: slideId,
        schemaVersion: RECORD_SCHEMA_VERSION,
        deckId,
        scene: blankScene(),
        createdAt: now,
        updatedAt: now,
      }
      const updatedDeck: Deck = {
        ...deck,
        slideOrder: [
          ...deck.slideOrder.slice(0, afterIndex + 1),
          slideId,
          ...deck.slideOrder.slice(afterIndex + 1),
        ],
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to insert slide'))
        tx.onabort = () => reject(tx.error ?? new Error('Slide insertion aborted'))
        tx.objectStore(DECKS_STORE).put(updatedDeck)
        tx.objectStore(SLIDES_STORE).put(slide)
      })

      const slides: Slide[] = []
      for (const id of updatedDeck.slideOrder) {
        const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
        if (!stored || !isValidSlide(stored, deckId)) {
          throw new Error('Inserted slide could not be loaded')
        }
        slides.push(stored)
      }

      return { deck: updatedDeck, slide, slides }
    },

    async dispose() {
      db.close()
    },
  }
}

function openDatabase(databaseName: string): Promise<IDBDatabase> {
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
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open database'))
  })
}

function getRecord<T>(
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

function isValidDeck(value: unknown): value is Deck {
  if (!value || typeof value !== 'object') return false
  const deck = value as Deck
  return (
    typeof deck.id === 'string' &&
    deck.schemaVersion === RECORD_SCHEMA_VERSION &&
    typeof deck.title === 'string' &&
    typeof deck.createdAt === 'number' &&
    typeof deck.updatedAt === 'number' &&
    Array.isArray(deck.slideOrder) &&
    deck.slideOrder.length >= 1 &&
    deck.slideOrder.every((id) => typeof id === 'string') &&
    new Set(deck.slideOrder).size === deck.slideOrder.length
  )
}

function isValidSlide(value: unknown, deckId: DeckId): value is Slide {
  if (!value || typeof value !== 'object') return false
  const slide = value as Slide
  return (
    typeof slide.id === 'string' &&
    slide.schemaVersion === RECORD_SCHEMA_VERSION &&
    slide.deckId === deckId &&
    typeof slide.createdAt === 'number' &&
    typeof slide.updatedAt === 'number' &&
    isValidScene(slide.scene)
  )
}

function isValidScene(value: unknown): value is Scene {
  if (!value || typeof value !== 'object') return false
  const scene = value as Scene
  return (
    Array.isArray(scene.elements) &&
    !!scene.appState &&
    typeof scene.appState === 'object' &&
    !!scene.files &&
    typeof scene.files === 'object'
  )
}
