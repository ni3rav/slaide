import { expect, test, type Page } from '@playwright/test'

test.describe('duplicate and swap slides', () => {
  test('shows duplicate and swap actions when slides are checked', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()

    await expect(page.getByRole('button', { name: 'Duplicate' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Swap' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('enables swap only when exactly two slides are checked', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await expect(page.getByRole('button', { name: 'Swap' })).toBeDisabled()

    await page.getByRole('checkbox', { name: 'Select slide 3' }).check()
    await expect(page.getByRole('button', { name: 'Swap' })).toBeEnabled()

    await page.getByRole('checkbox', { name: 'Select slide 2' }).check()
    await expect(page.getByRole('button', { name: 'Swap' })).toBeDisabled()
  })

  test('duplicates nonadjacent selections directly after each source', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(3)

    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('checkbox', { name: 'Select slide 3' }).check()
    await page.getByRole('button', { name: 'Duplicate' }).click()

    await expect(page.getByRole('listitem')).toHaveCount(5)
    const order = await readSlideOrder(page, deckId)
    expect(order).toHaveLength(5)
    expect(order[0]).toBe(slideA)
    expect(order[2]).toBe(slideB)
    expect(order[3]).toBe(slideC)
    expect(order[1]).not.toBe(slideA)
    expect(order[4]).not.toBe(slideC)
    expect(order[1]).not.toBe(slideB)
    expect(order[4]).not.toBe(slideB)
    expect(await slideExists(page, order[1]!)).toBe(true)
    expect(await slideExists(page, order[4]!)).toBe(true)
  })

  test('duplicates scenes and binary files with new slide ids', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!
    const [slideA] = await readSlideOrder(page, deckId)

    await page.evaluate(() => window.__slaideTest?.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved')

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('button', { name: 'Duplicate' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(2)

    const order = await readSlideOrder(page, deckId)
    expect(order).toHaveLength(2)
    const copyId = order[1]!
    expect(copyId).not.toBe(slideA)

    const sourceScene = await readStoredScene(page, slideA)
    const copiedScene = await readStoredScene(page, copyId)
    expect(copiedScene.elements).toHaveLength(sourceScene.elements.length)
    expect(copiedScene.elements[0]?.type).toBe('rectangle')
  })

  test('swaps exactly two checked positions', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()

    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('checkbox', { name: 'Select slide 3' }).check()
    await page.getByRole('button', { name: 'Swap' }).click()

    expect(await readSlideOrder(page, deckId)).toEqual([slideC, slideB, slideA])
    await expect(page.getByRole('button', { name: '1', exact: true })).toContainText('1')
    await expect(page.getByRole('button', { name: '3', exact: true })).toContainText('3')
  })

  test('keeps checked state during slide navigation and clears after duplicate', async ({
    page,
  }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Select slide 2' }).check()

    await expect(page.getByRole('checkbox', { name: 'Select slide 2' })).toBeChecked()
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await page.getByRole('button', { name: 'Duplicate' }).click()

    await expect(page.getByRole('button', { name: 'Duplicate' })).toBeHidden()
    await expect(page.getByRole('checkbox', { name: 'Select slide 2' })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Select slide 3' })).not.toBeChecked()
  })

  test('clears checked state after swap and when opening another deck', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await page.getByRole('checkbox', { name: 'Select slide 2' }).check()
    await page.getByRole('button', { name: 'Swap' }).click()

    await expect(page.getByRole('button', { name: 'Swap' })).toBeHidden()

    await page.getByRole('link', { name: 'Home' }).click()
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await expect(page.getByRole('button', { name: 'Duplicate' })).toBeVisible()
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
