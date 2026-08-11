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

  it('renders a light background by default', async () => {
    const scene: Scene = {
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene)
    const [r, g, b] = await samplePixel(blob, SLIDE_WIDTH / 2, SLIDE_HEIGHT / 2)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeGreaterThan(200)
    expect(b).toBeGreaterThan(200)
  })

  it('carries the dark theme into the exported background', async () => {
    const scene: Scene = {
      elements: [],
      appState: { viewBackgroundColor: '#ffffff' },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene, 'dark')
    const [r, g, b] = await samplePixel(blob, SLIDE_WIDTH / 2, SLIDE_HEIGHT / 2)
    expect(r).toBeLessThan(80)
    expect(g).toBeLessThan(80)
    expect(b).toBeLessThan(80)
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

  it('draws the grid when gridModeEnabled is set on the scene', async () => {
    const scene: Scene = {
      elements: [],
      appState: {
        viewBackgroundColor: '#ffffff',
        gridModeEnabled: true,
        gridSize: 20,
        gridStep: 5,
      },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene)

    // Mid-cell (10,10) stays near-white; a bold grid line at x=0 is darker.
    const midCell = await samplePixel(blob, 10, 10)
    expect(midCell[0]).toBeGreaterThan(240)
    expect(midCell[1]).toBeGreaterThan(240)
    expect(midCell[2]).toBeGreaterThan(240)

    const onBoldGridLine = await samplePixel(blob, 0, 10)
    expect(onBoldGridLine[0]).toBeLessThan(midCell[0]!)
    expect(onBoldGridLine[1]).toBeLessThan(midCell[1]!)
    expect(onBoldGridLine[2]).toBeLessThan(midCell[2]!)
  })

  it('keeps the grid under opaque elements', async () => {
    const [rectangle] = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        backgroundColor: '#ff0000',
        strokeColor: '#ff0000',
        fillStyle: 'solid',
        roughness: 0,
      },
    ])

    const scene: Scene = {
      elements: [rectangle!],
      appState: {
        viewBackgroundColor: '#ffffff',
        gridModeEnabled: true,
        gridSize: 20,
        gridStep: 5,
      },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene)
    const onRectangle = await samplePixel(blob, 20, 20)
    expect(onRectangle[0]).toBeGreaterThan(200)
    expect(onRectangle[1]).toBeLessThan(40)
    expect(onRectangle[2]).toBeLessThan(40)
  })

  it('omits the grid when gridModeEnabled is off', async () => {
    const scene: Scene = {
      elements: [],
      appState: {
        viewBackgroundColor: '#ffffff',
        gridModeEnabled: false,
        gridSize: 20,
        gridStep: 5,
      },
      files: {},
    }

    const blob = await renderSlideToPngBlob(scene)
    const midCell = await samplePixel(blob, 10, 10)
    const onGridLine = await samplePixel(blob, 0, 10)
    expect(onGridLine[0]).toBe(midCell[0])
    expect(onGridLine[1]).toBe(midCell[1])
    expect(onGridLine[2]).toBe(midCell[2])
  })
})
