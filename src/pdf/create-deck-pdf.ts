import {
  renderSlideToPngBlob,
  type SlideRenderTheme,
} from '../presentation/slide-to-png.ts'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slide/slide-dimensions.ts'
import type { Slide } from '../storage/deck-repository.ts'

export async function createDeckPdfBlob(
  slides: Slide[],
  theme: SlideRenderTheme = 'light',
): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()

  for (const slide of slides) {
    const pngBlob = await renderSlideToPngBlob(slide.scene, theme)
    const png = await pdf.embedPng(await pngBlob.arrayBuffer())
    const page = pdf.addPage([SLIDE_WIDTH, SLIDE_HEIGHT])
    page.drawImage(png, {
      x: 0,
      y: 0,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
    })
  }

  const bytes = await pdf.save()
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: 'application/pdf' })
}
