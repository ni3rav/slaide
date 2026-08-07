import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
      getSceneElementCount: () => number
    }
  }
}

test.describe('add and navigate independent slides', () => {
  test('collapses and reopens the slide sidebar', async ({ page }) => {
    await openEditor(page)

    await expect(page.getByRole('complementary', { name: 'Slides' })).toBeVisible()
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByRole('complementary', { name: 'Slides' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Open sidebar' }).click()
    await expect(page.getByRole('complementary', { name: 'Slides' })).toBeVisible()
  })

  test('shows numbered sidebar rows and inserts a blank slide after the active slide', async ({
    page,
  }) => {
    await openEditor(page)

    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await expect(page.getByRole('listitem')).toHaveCount(1)

    await page.getByRole('button', { name: 'Add slide' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(2)
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await expect(page.getByText('Slide 2 of 2')).toBeVisible()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
  })

  test('inserts new slides immediately after the active slide', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    const deckId = page.url().split('/').at(-1)!
    const slideOrder = await readSlideOrder(page, deckId)
    expect(slideOrder).toHaveLength(3)
  })

  test('keeps slide scenes independent across navigation and reload', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 })

    const firstSlideId = (await readSlideOrder(page, deckId))[0]!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    const secondSlideId = (await readSlideOrder(page, deckId))[1]!
    expect((await readStoredScene(page, secondSlideId)).elements).toHaveLength(0)

    await page.getByRole('button', { name: '1', exact: true }).click()
    await waitForSceneElementCount(page, 1)

    const firstSlideScene = await readStoredScene(page, firstSlideId)
    expect(firstSlideScene.elements.some((element) => element.type === 'rectangle')).toBe(true)

    const secondSlideScene = await readStoredScene(page, secondSlideId)
    expect(secondSlideScene.elements).toHaveLength(0)

    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await page.getByRole('button', { name: '1', exact: true }).click()
    await waitForSceneElementCount(page, 1)
  })

  test('force-saves before navigating to another slide', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!
    const firstSlideId = (await readSlideOrder(page, deckId))[0]!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())

    await page.getByRole('button', { name: '2', exact: true }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.waitForFunction(() => window.__slaideTest != null)

    const saved = await readStoredScene(page, firstSlideId)
    expect(saved.elements.some((element) => element.type === 'rectangle')).toBe(true)
  })

  test('mounts at most one Excalidraw instance during add and navigation', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await expect.poll(() => countLiveExcalidrawInstances(page)).toBe(1)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect.poll(() => countLiveExcalidrawInstances(page)).toBe(1)

    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect.poll(() => countLiveExcalidrawInstances(page)).toBe(1)
  })
})

async function countLiveExcalidrawInstances(page: Page): Promise<number> {
  return page.locator('.editor-canvas .excalidraw').count()
}

async function waitForSceneElementCount(page: Page, count: number): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => window.__slaideTest?.getSceneElementCount() ?? -1))
    .toBe(count)
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function readSlideOrder(page: Page, deckId: string): Promise<string[]> {
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
    db.close()
    return deck.slideOrder
  }, deckId)
}

async function readStoredScene(
  page: Page,
  slideId: string,
): Promise<{
  elements: Array<{ type: string }>
  appState: Record<string, unknown>
  files: Record<string, unknown>
}> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    const slide = await new Promise<{
      scene: {
        elements: Array<{ type: string }>
        appState: Record<string, unknown>
        files: Record<string, unknown>
      }
    }>((resolve, reject) => {
      const tx = db.transaction('slides', 'readonly')
      const request = tx.objectStore('slides').get(id)
      request.onsuccess = () =>
        resolve(
          request.result as {
            scene: {
              elements: Array<{ type: string }>
              appState: Record<string, unknown>
              files: Record<string, unknown>
            }
          },
        )
      request.onerror = () => reject(request.error ?? new Error('slide read failed'))
    })
    db.close()
    return slide.scene
  }, slideId)
}
