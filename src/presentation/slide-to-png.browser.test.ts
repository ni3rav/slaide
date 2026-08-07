import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { describe, expect, it } from 'vitest'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slide/slide-dimensions.ts'
import type { Scene } from '../storage/deck-repository.ts'
import { renderSlideToPngBlob } from './slide-to-png.ts'

async function samplePixel(
  blob: Blob,
  x: number,
  y: number,
): Promise<[number, number, number, number]> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const { data } = ctx.getImageData(x, y, 1, 1)
  return [data[0]!, data[1]!, data[2]!, data[3]!]
}

describe('renderSlideToPngBlob', () => {
  it('exports the fixed slide size', async () => {
    const scene: Scene = {
      elements: [],
      appState: { viewBackgroundColor: '#abcdef' },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene)
    const bitmap = await createImageBitmap(blob)
    expect(bitmap.width).toBe(SLIDE_WIDTH)
    expect(bitmap.height).toBe(SLIDE_HEIGHT)
    bitmap.close()
  })

  it('preserves element positions inside the slide instead of shifting to top-left', async () => {
    const [rectangle] = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x: 1400,
        y: 800,
        width: 100,
        height: 80,
        backgroundColor: '#ff0000',
        strokeColor: '#ff0000',
        fillStyle: 'solid',
        roughness: 0,
      },
    ])

    const scene: Scene = {
      elements: [rectangle!],
      appState: { viewBackgroundColor: '#00ff00' },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene)

    const topLeft = await samplePixel(blob, 2, 2)
    expect(topLeft[0]).toBeLessThan(40)
    expect(topLeft[1]).toBeGreaterThan(200)
    expect(topLeft[2]).toBeLessThan(40)

    const onRectangle = await samplePixel(blob, 1450, 840)
    expect(onRectangle[0]).toBeGreaterThan(200)
    expect(onRectangle[1]).toBeLessThan(40)
    expect(onRectangle[2]).toBeLessThan(40)

    const nearOriginWhereBugWouldPlaceIt = await samplePixel(blob, 50, 40)
    expect(nearOriginWhereBugWouldPlaceIt[0]).toBeLessThan(40)
    expect(nearOriginWhereBugWouldPlaceIt[1]).toBeGreaterThan(200)
    expect(nearOriginWhereBugWouldPlaceIt[2]).toBeLessThan(40)
  })
})
