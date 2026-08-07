import { expect, test, type Page } from '@playwright/test'

const SLIDE_WIDTH = 1920
const SLIDE_HEIGHT = 1080
const MAX_ZOOM = 30

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
      addOversizedRectangle: () => void
      moveRectangleOffSlide: () => void
      getCamera: () => { scrollX: number; scrollY: number; zoom: number }
      getViewport: () => { width: number; height: number }
      setCamera: (camera: {
        scrollX?: number
        scrollY?: number
        zoom?: number
      }) => void
      getStoredElementsInsideSlide: () => boolean
    }
  }
}

test.describe('constrain the fixed slide', () => {
  test('fits the complete slide frame when the editor opens', async ({ page }) => {
    await openEditor(page)
    const visibility = await readSlideVisibility(page)

    expect(visibility.minX).toBeLessThanOrEqual(0)
    expect(visibility.minY).toBeLessThanOrEqual(0)
    expect(visibility.maxX).toBeGreaterThanOrEqual(SLIDE_WIDTH)
    expect(visibility.maxY).toBeGreaterThanOrEqual(SLIDE_HEIGHT)
    expect(visibility.zoom).toBeCloseTo(visibility.fitZoom, 5)
  })

  test('clamps invalid pan and zoom through the public camera APIs', async ({ page }) => {
    await openEditor(page)

    await page.evaluate(() => {
      window.__slaideTest!.setCamera({ scrollX: -800, scrollY: 500, zoom: 0.01 })
    })

    const corrected = await readSlideVisibility(page)
    expect(corrected.zoom).toBeGreaterThanOrEqual(corrected.fitZoom)
    expect(corrected.zoom).toBeLessThanOrEqual(MAX_ZOOM)
    expect(corrected.minX).toBeLessThanOrEqual(0)
    expect(corrected.minY).toBeLessThanOrEqual(0)
    expect(corrected.maxX).toBeGreaterThanOrEqual(SLIDE_WIDTH)
    expect(corrected.maxY).toBeGreaterThanOrEqual(SLIDE_HEIGHT)

    await page.evaluate(() => {
      window.__slaideTest!.setCamera({ scrollX: -500, scrollY: 400, zoom: 2 })
    })

    const zoomedIn = await readSlideVisibility(page)
    expect(zoomedIn.minX).toBeGreaterThanOrEqual(0)
    expect(zoomedIn.minY).toBeGreaterThanOrEqual(0)
    expect(zoomedIn.maxX).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(zoomedIn.maxY).toBeLessThanOrEqual(SLIDE_HEIGHT)
  })

  test('scales an oversized inserted element to fit and keeps saves inside the slide', async ({
    page,
  }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addOversizedRectangle())

    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getStoredElementsInsideSlide()))
      .toBe(true)

    await expect
      .poll(async () => {
        const scene = await readStoredScene(page, deckId)
        return scene.elements.some((element) => element.type === 'rectangle')
      }, { timeout: 5000 })
      .toBe(true)

    const stored = await readStoredScene(page, deckId)
    const rectangle = stored.elements.find((element) => element.type === 'rectangle') as {
      width: number
      height: number
    }
    expect(rectangle.width).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(rectangle.height).toBeLessThanOrEqual(SLIDE_HEIGHT)
  })

  test('keeps a moved rectangle inside the slide after it crosses the edge', async ({
    page,
  }) => {
    await openEditor(page)

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await page.evaluate(() => window.__slaideTest!.moveRectangleOffSlide())

    expect(await page.evaluate(() => window.__slaideTest!.getStoredElementsInsideSlide())).toBe(
      true,
    )
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
  await page.waitForFunction(() => window.__slaideTest != null)
}

async function readSlideVisibility(page: Page): Promise<{
  minX: number
  minY: number
  maxX: number
  maxY: number
  zoom: number
  fitZoom: number
}> {
  return page.evaluate(
    ([slideWidth, slideHeight]) => {
      const api = window.__slaideTest!
      const camera = api.getCamera()
      const viewport = api.getViewport()
      const fitZoom = Math.min(viewport.width / slideWidth, viewport.height / slideHeight)
      const visibleWidth = viewport.width / camera.zoom
      const visibleHeight = viewport.height / camera.zoom
      return {
        minX: -camera.scrollX,
        minY: -camera.scrollY,
        maxX: -camera.scrollX + visibleWidth,
        maxY: -camera.scrollY + visibleHeight,
        zoom: camera.zoom,
        fitZoom,
      }
    },
    [SLIDE_WIDTH, SLIDE_HEIGHT],
  )
}

async function readStoredScene(
  page: Page,
  deckId: string,
): Promise<{
  elements: Array<{ type: string; width?: number; height?: number }>
}> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    const deck = await new Promise<{ slideOrder: string[] }>((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly')
      const request = tx.objectStore('decks').get(id)
      request.onsuccess = () => resolve(request.result as { slideOrder: string[] })
      request.onerror = () => reject(request.error ?? new Error('deck read failed'))
    })
    const slide = await new Promise<{
      scene: { elements: Array<{ type: string; width?: number; height?: number }> }
    }>((resolve, reject) => {
      const tx = db.transaction('slides', 'readonly')
      const request = tx.objectStore('slides').get(deck.slideOrder[0]!)
      request.onsuccess = () =>
        resolve(
          request.result as {
            scene: { elements: Array<{ type: string; width?: number; height?: number }> }
          },
        )
      request.onerror = () => reject(request.error ?? new Error('slide read failed'))
    })
    db.close()
    return slide.scene
  }, deckId)
}
