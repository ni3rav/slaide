import { planSlideDeletion } from '../slide/slide-deletion.ts'
import { planSlideDuplication } from '../slide/slide-duplication.ts'
import { planSlideInsertion } from '../slide/slide-reorder.ts'
import { planSlideSwap } from '../slide/slide-swap.ts'
import {
  DECKS_STORE,
  getRecord,
  openSlaideDatabase,
  SLIDES_STORE,
} from './database.ts'

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

export type DeletedSlides = {
  deck: Deck
  activeSlide: Slide
  slides: Slide[]
}

export type ReorderedSlides = {
  deck: Deck
  slides: Slide[]
}

export type DuplicatedSlides = {
  deck: Deck
  slides: Slide[]
}

export type SwappedSlides = {
  deck: Deck
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

export type ImportDeckResult = CreatedDeck

export type DeckRepository = {
  createDeck: () => Promise<CreatedDeck>
  listDecks: () => Promise<DeckSummary[]>
  loadDeck: (deckId: DeckId) => Promise<LoadDeckResult>
  renameDeck: (deckId: DeckId, title: string) => Promise<Deck>
  deleteDeck: (deckId: DeckId) => Promise<void>
  importDeck: (deck: Deck, slides: Slide[]) => Promise<ImportDeckResult>
  saveScene: (slideId: SlideId, scene: Scene) => Promise<Slide>
  insertSlideAfter: (deckId: DeckId, afterSlideId: SlideId) => Promise<InsertedSlide>
  deleteSlides: (
    deckId: DeckId,
    activeSlideId: SlideId,
    slideIdsToDelete: SlideId[],
  ) => Promise<DeletedSlides>
  reorderSlide: (
    deckId: DeckId,
    slideId: SlideId,
    insertionIndex: number,
  ) => Promise<ReorderedSlides>
  duplicateSlides: (
    deckId: DeckId,
    slideIdsToDuplicate: SlideId[],
  ) => Promise<DuplicatedSlides>
  swapSlides: (
    deckId: DeckId,
    slideIdA: SlideId,
    slideIdB: SlideId,
  ) => Promise<SwappedSlides>
  dispose: () => Promise<void>
}

const DEFAULT_DATABASE_NAME = 'slaide'
const RECORD_SCHEMA_VERSION = 1

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
  const db = await openSlaideDatabase(databaseName)

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

    async importDeck(deck, slides) {
      if (!isValidDeck(deck)) {
        throw new Error('Invalid deck data for import')
      }

      if (slides.length !== deck.slideOrder.length) {
        throw new Error('Imported slides do not match deck slide order')
      }

      const slidesById = new Map(slides.map((slide) => [slide.id, slide]))
      for (const slideId of deck.slideOrder) {
        const slide = slidesById.get(slideId)
        if (!slide || !isValidSlide(slide, deck.id)) {
          throw new Error('Invalid slide data for import')
        }
      }

      const existingDeck = await getRecord<Deck>(db, DECKS_STORE, deck.id)
      if (existingDeck) {
        throw new Error('Import would overwrite an existing deck')
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(formatImportWriteError(tx.error))
        tx.onabort = () => reject(formatImportWriteError(tx.error))
        const decks = tx.objectStore(DECKS_STORE)
        const slideStore = tx.objectStore(SLIDES_STORE)

        try {
          for (const slide of slides) {
            slideStore.put(slide)
          }
          decks.put(deck)
        } catch (error) {
          reject(formatImportWriteError(error))
        }
      })

      return { deck, slides }
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

    async deleteSlides(deckId, activeSlideId, slideIdsToDelete) {
      const deck = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!deck || !isValidDeck(deck)) {
        throw new Error('Deck not found')
      }

      if (!deck.slideOrder.includes(activeSlideId)) {
        throw new Error('Active slide not found in deck')
      }

      const deleteSet = new Set(slideIdsToDelete)
      if (deleteSet.size === 0) {
        throw new Error('No slides selected for deletion')
      }

      for (const slideId of slideIdsToDelete) {
        if (!deck.slideOrder.includes(slideId)) {
          throw new Error('Slide not found in deck')
        }
      }

      const plan = planSlideDeletion(deck.slideOrder, activeSlideId, slideIdsToDelete)
      const now = Date.now()
      let replacementSlide: Slide | null = null
      let nextSlideOrder = plan.slideOrder

      if (plan.requiresBlankSlide) {
        const slideId = crypto.randomUUID()
        replacementSlide = {
          id: slideId,
          schemaVersion: RECORD_SCHEMA_VERSION,
          deckId,
          scene: blankScene(),
          createdAt: now,
          updatedAt: now,
        }
        nextSlideOrder = [slideId]
      }

      const nextActiveSlideId = plan.requiresBlankSlide
        ? replacementSlide!.id
        : plan.nextActiveSlideId!

      const updatedDeck: Deck = {
        ...deck,
        slideOrder: nextSlideOrder,
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to delete slides'))
        tx.onabort = () => reject(tx.error ?? new Error('Slide deletion aborted'))
        const decks = tx.objectStore(DECKS_STORE)
        const slides = tx.objectStore(SLIDES_STORE)

        for (const slideId of plan.deletedSlideIds) {
          slides.delete(slideId)
        }
        if (replacementSlide) {
          slides.put(replacementSlide)
        }
        decks.put(updatedDeck)
      })

      const slides: Slide[] = []
      for (const id of updatedDeck.slideOrder) {
        const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
        if (!stored || !isValidSlide(stored, deckId)) {
          throw new Error('Deck could not be loaded after slide deletion')
        }
        slides.push(stored)
      }

      const activeSlide = slides.find((slide) => slide.id === nextActiveSlideId)
      if (!activeSlide) {
        throw new Error('Active slide could not be resolved after deletion')
      }

      return { deck: updatedDeck, activeSlide, slides }
    },

    async reorderSlide(deckId, slideId, insertionIndex) {
      const deck = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!deck || !isValidDeck(deck)) {
        throw new Error('Deck not found')
      }

      if (!deck.slideOrder.includes(slideId)) {
        throw new Error('Slide not found in deck')
      }

      const plan = planSlideInsertion(deck.slideOrder, slideId, insertionIndex)
      if (!plan.changed) {
        const slides: Slide[] = []
        for (const id of deck.slideOrder) {
          const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
          if (!stored || !isValidSlide(stored, deckId)) {
            throw new Error('Deck could not be loaded')
          }
          slides.push(stored)
        }
        return { deck, slides }
      }

      const now = Date.now()
      const updatedDeck: Deck = {
        ...deck,
        slideOrder: plan.slideOrder,
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DECKS_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to reorder slide'))
        tx.onabort = () => reject(tx.error ?? new Error('Slide reorder aborted'))
        tx.objectStore(DECKS_STORE).put(updatedDeck)
      })

      const slides: Slide[] = []
      for (const id of updatedDeck.slideOrder) {
        const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
        if (!stored || !isValidSlide(stored, deckId)) {
          throw new Error('Deck could not be loaded after slide reorder')
        }
        slides.push(stored)
      }

      return { deck: updatedDeck, slides }
    },

    async duplicateSlides(deckId, slideIdsToDuplicate) {
      const deck = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!deck || !isValidDeck(deck)) {
        throw new Error('Deck not found')
      }

      if (slideIdsToDuplicate.length === 0) {
        throw new Error('No slides selected for duplication')
      }

      for (const slideId of slideIdsToDuplicate) {
        if (!deck.slideOrder.includes(slideId)) {
          throw new Error('Slide not found in deck')
        }
      }

      const plan = planSlideDuplication(deck.slideOrder, slideIdsToDuplicate)
      const now = Date.now()
      const sourceSlides = new Map<SlideId, Slide>()

      for (const { sourceId } of plan.copies) {
        const source = await getRecord<Slide>(db, SLIDES_STORE, sourceId)
        if (!source || !isValidSlide(source, deckId)) {
          throw new Error('Slide not found')
        }
        sourceSlides.set(sourceId, source)
      }

      const copiedSlides: Slide[] = plan.copies.map(({ sourceId, copyId }) => {
        const source = sourceSlides.get(sourceId)!
        return {
          id: copyId,
          schemaVersion: RECORD_SCHEMA_VERSION,
          deckId,
          scene: structuredClone(source.scene),
          createdAt: now,
          updatedAt: now,
        }
      })

      const updatedDeck: Deck = {
        ...deck,
        slideOrder: plan.slideOrder,
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([DECKS_STORE, SLIDES_STORE], 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to duplicate slides'))
        tx.onabort = () => reject(tx.error ?? new Error('Slide duplication aborted'))
        const decks = tx.objectStore(DECKS_STORE)
        const slides = tx.objectStore(SLIDES_STORE)

        for (const slide of copiedSlides) {
          slides.put(slide)
        }
        decks.put(updatedDeck)
      })

      const slides: Slide[] = []
      for (const id of updatedDeck.slideOrder) {
        const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
        if (!stored || !isValidSlide(stored, deckId)) {
          throw new Error('Deck could not be loaded after slide duplication')
        }
        slides.push(stored)
      }

      return { deck: updatedDeck, slides }
    },

    async swapSlides(deckId, slideIdA, slideIdB) {
      const deck = await getRecord<Deck>(db, DECKS_STORE, deckId)
      if (!deck || !isValidDeck(deck)) {
        throw new Error('Deck not found')
      }

      if (!deck.slideOrder.includes(slideIdA) || !deck.slideOrder.includes(slideIdB)) {
        throw new Error('Slide not found in deck')
      }

      const plan = planSlideSwap(deck.slideOrder, slideIdA, slideIdB)
      if (!plan.changed) {
        const slides: Slide[] = []
        for (const id of deck.slideOrder) {
          const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
          if (!stored || !isValidSlide(stored, deckId)) {
            throw new Error('Deck could not be loaded')
          }
          slides.push(stored)
        }
        return { deck, slides }
      }

      const now = Date.now()
      const updatedDeck: Deck = {
        ...deck,
        slideOrder: plan.slideOrder,
        updatedAt: now,
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(DECKS_STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to swap slides'))
        tx.onabort = () => reject(tx.error ?? new Error('Slide swap aborted'))
        tx.objectStore(DECKS_STORE).put(updatedDeck)
      })

      const slides: Slide[] = []
      for (const id of updatedDeck.slideOrder) {
        const stored = await getRecord<Slide>(db, SLIDES_STORE, id)
        if (!stored || !isValidSlide(stored, deckId)) {
          throw new Error('Deck could not be loaded after slide swap')
        }
        slides.push(stored)
      }

      return { deck: updatedDeck, slides }
    },

    async dispose() {
      db.close()
    },
  }
}

function formatImportWriteError(error: unknown): Error {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new Error('Import failed because browser storage is full')
  }
  if (error instanceof Error) {
    return error
  }
  return new Error('Import failed')
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
