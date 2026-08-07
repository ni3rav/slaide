import { expect, test, type Page } from '@playwright/test'

test.describe('reorder slides by drag handle', () => {
  test('moves one slide downward with an insertion indicator', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(3)

    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await dragSlideToInsertion(page, 1, 3)

    await expect
      .poll(() => readSlideOrder(page, deckId))
      .toEqual([slideB, slideC, slideA])
  })

  test('moves one slide upward with an insertion indicator', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await dragSlideToInsertion(page, 3, 0)

    await expect
      .poll(() => readSlideOrder(page, deckId))
      .toEqual([slideC, slideA, slideB])
  })

  test('moves a slide to the end boundary', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await dragSlideToInsertion(page, 1, 3)

    await expect
      .poll(() => readSlideOrder(page, deckId))
      .toEqual([slideB, slideC, slideA])
  })

  test('does not reorder when dragging from the slide row button', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    const before = await readSlideOrder(page, deckId)

    const rowButton = page.getByRole('button', { name: '1', exact: true })
    const target = page.getByTestId('slide-insertion-2')
    const rowBox = await rowButton.boundingBox()
    const targetBox = await target.boundingBox()
    if (!rowBox || !targetBox) throw new Error('missing drag target')
    await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      { steps: 12 },
    )
    await page.mouse.up()

    await expect.poll(() => readSlideOrder(page, deckId)).toEqual(before)
  })

  test('preserves checked state after reordering a checked slide', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await page.getByRole('checkbox', { name: 'Select slide 1' }).check()
    await dragSlideToInsertion(page, 1, 3)

    await expect
      .poll(() => readSlideOrder(page, deckId))
      .toEqual([slideB, slideC, slideA])
    await expect(page.getByRole('checkbox', { name: 'Select slide 3' })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('reorders with keyboard controls on the drag handle', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    const handle = page.getByRole('button', { name: 'Reorder slide 1' })
    await handle.focus()
    await handle.press('ArrowDown')

    await expect
      .poll(() => readSlideOrder(page, deckId))
      .toEqual([slideB, slideA, slideC])
  })

  test('persists reordered slide order across reload', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    const [slideA, slideB, slideC] = await readSlideOrder(page, deckId)

    await dragSlideToInsertion(page, 1, 2)

    const expected = [slideB, slideA, slideC]
    await expect.poll(() => readSlideOrder(page, deckId)).toEqual(expected)

    await page.reload()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect.poll(() => readSlideOrder(page, deckId)).toEqual(expected)
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function dragSlideToInsertion(
  page: Page,
  slideNumber: number,
  insertionIndex: number,
): Promise<void> {
  const handle = page.getByRole('button', { name: `Reorder slide ${slideNumber}` })
  const target = page.getByTestId(`slide-insertion-${insertionIndex}`)
  const handleBox = await handle.boundingBox()
  const targetBox = await target.boundingBox()
  if (!handleBox || !targetBox) {
    throw new Error('missing drag target')
  }

  await handle.scrollIntoViewIfNeeded()
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 15 },
  )
  await page.mouse.up()
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
