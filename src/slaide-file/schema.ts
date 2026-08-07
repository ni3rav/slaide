import type { Deck, Slide } from '../storage/deck-repository.ts'

export const SLAIDE_FILE_FORMAT_VERSION = 1

export type SlaideFile = {
  formatVersion: typeof SLAIDE_FILE_FORMAT_VERSION
  deck: Deck
  slides: Slide[]
}
