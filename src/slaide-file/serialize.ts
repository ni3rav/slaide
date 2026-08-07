import type { Deck, Slide } from '../storage/deck-repository.ts'
import { SLAIDE_FILE_FORMAT_VERSION, type SlaideFile } from './schema.ts'

export function serializeDeckToSlaideFile(deck: Deck, slides: Slide[]): SlaideFile {
  const slidesById = new Map(slides.map((slide) => [slide.id, slide]))
  const orderedSlides: Slide[] = []

  for (const slideId of deck.slideOrder) {
    const slide = slidesById.get(slideId)
    if (!slide) {
      throw new Error(`Missing slide ${slideId} for deck export`)
    }
    if (slide.deckId !== deck.id) {
      throw new Error(`Slide ${slideId} does not belong to deck ${deck.id}`)
    }
    orderedSlides.push(slide)
  }

  return {
    formatVersion: SLAIDE_FILE_FORMAT_VERSION,
    deck,
    slides: orderedSlides,
  }
}

export function stringifySlaideFile(file: SlaideFile): string {
  return JSON.stringify(file, null, 2)
}
