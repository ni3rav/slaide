import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slide/slide-dimensions.ts'
import type { Slide } from '../storage/deck-repository.ts'
import { createDeckPdfBlob } from './create-deck-pdf.ts'

describe('createDeckPdfBlob', () => {
  it('creates one borderless 16:9 page for each slide', async () => {
    const slides = [
      createSlide('slide-1', '#ff0000'),
      createSlide('slide-2', '#0000ff'),
    ]

    const blob = await createDeckPdfBlob(slides)
    const pdf = await PDFDocument.load(await blob.arrayBuffer())
    const pages = pdf.getPages()

    expect(blob.type).toBe('application/pdf')
    expect(pages).toHaveLength(2)
    expect(pages.map((page) => page.getSize())).toEqual([
      { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
      { width: SLIDE_WIDTH, height: SLIDE_HEIGHT },
    ])
  })
})

function createSlide(id: string, viewBackgroundColor: string): Slide {
  return {
    id,
    schemaVersion: 1,
    deckId: 'deck-1',
    scene: {
      elements: [],
      appState: { viewBackgroundColor },
      files: {},
    },
    createdAt: 1,
    updatedAt: 1,
  }
}
