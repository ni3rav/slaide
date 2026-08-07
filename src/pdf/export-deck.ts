import type { Deck, Slide } from '../storage/deck-repository.ts'
import { pdfExportFilename } from '../slaide-file/filename.ts'
import { createDeckPdfBlob } from './create-deck-pdf.ts'

export async function exportDeckAsPdf(
  deck: Deck,
  slides: Slide[],
): Promise<void> {
  const blob = await createDeckPdfBlob(slides)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = pdfExportFilename(deck.title)
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}
