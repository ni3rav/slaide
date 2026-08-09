import type { Deck, DeckTheme, Slide } from '../storage/deck-repository.ts'
import { pdfExportFilename } from '../slaide-file/filename.ts'
import { createDeckPdfBlob } from './create-deck-pdf.ts'

export async function exportDeckAsPdf(
  deck: Deck,
  slides: Slide[],
  theme: DeckTheme,
): Promise<void> {
  const blob = await createDeckPdfBlob(slides, theme)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = pdfExportFilename(deck.title)
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}
