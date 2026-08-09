import type { Deck, DeckTheme, Slide } from '../storage/deck-repository.ts'
import { slaideExportFilename } from './filename.ts'
import { downloadTextFile } from './download.ts'
import { serializeDeckToSlaideFile, stringifySlaideFile } from './serialize.ts'

export function exportDeckAsSlaideFile(
  deck: Deck,
  slides: Slide[],
  theme: DeckTheme,
): void {
  const file = serializeDeckToSlaideFile(deck, slides, theme)
  const filename = slaideExportFilename(deck.title)
  downloadTextFile(filename, stringifySlaideFile(file))
}
