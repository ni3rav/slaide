import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
      getSceneElementCount: () => number
    }
  }
}

test.describe('delete slides safely', () => {
  test('deletes checked slides and removes their scene records', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(3)

    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('checkbox', { name: 'Select slide 3' }).check()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(await readSlideOrder(page, deckId)).toEqual([slideB])
    expect(await slideExists(page, slideA)).toBe(false)
    expect(await slideExists(page, slideC)).toBe(false)
    expect(await slideExists(page, slideB)).toBe(true)
  })

  test('activates the following slide when the active slide is deleted', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await expect(page.getByText('Slide 1 of 1')).toBeVisible()
  })

  test('activates the preceding slide when the deleted active slide was last', async ({
    page,
  }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('checkbox', { name: 'Select slide 2' }).check()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('creates and activates one blank slide when every slide is deleted', async ({
    page,
  }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!
    const originalSlideId = (await readSlideOrder(page, deckId))[0]!

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    const replacementSlideId = (await readSlideOrder(page, deckId))[0]!
    expect(replacementSlideId).not.toBe(originalSlideId)
    expect((await readStoredScene(page, replacementSlideId)).elements).toHaveLength(0)
    expect(await slideExists(page, originalSlideId)).toBe(false)
  })

  test('does not navigate when toggling a slide checkbox', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await page.getByRole('checkbox', { name: 'Select slide 2' }).check()

    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })
})

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

async function slideExists(page: Page, slideId: string): Promise<boolean> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    const slide = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('slides', 'readonly')
      const request = tx.objectStore('slides').get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('slide read failed'))
    })
    db.close()
    return slide != null
  }, slideId)
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
