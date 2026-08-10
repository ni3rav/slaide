import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
      getElementCount: () => number
    }
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('prevent concurrent deck editing', () => {
  test('opens a second tab read-only when the deck is already being edited', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const editor = await context.newPage()
    const viewer = await context.newPage()

    const deckId = await createDeck(editor)
    await waitForDeckLockHeld(editor, deckId)
    await openDeck(viewer, deckId)

    await expect(editor.getByTestId('save-status')).toHaveText('Saved')
    await expect(viewer.getByTestId('readonly-notice')).toBeVisible()
    await expect(viewer.getByTestId('readonly-notice')).toContainText(
      'open for editing in another tab or window',
    )
    await expect(viewer.getByTestId('editor-tool-rectangle')).toBeHidden()

    await context.close()
  })

  test('releases the lock when the editing tab leaves and lets the waiting tab take over', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const editor = await context.newPage()
    const viewer = await context.newPage()

    const deckId = await createDeck(editor)
    await waitForDeckLockHeld(editor, deckId)
    await openDeck(viewer, deckId)
    await expect(viewer.getByTestId('readonly-notice')).toBeVisible()

    await editor.getByRole('link', { name: 'Home' }).click()
    await expect(editor).toHaveURL('/')

    await expect(viewer.getByTestId('readonly-notice')).toHaveCount(0, {
      timeout: 5000,
    })
    await expect(viewer.getByTestId('save-status')).toHaveText('Saved')
    await expect(viewer.getByTestId('editor-tool-rectangle')).toBeVisible()

    await context.close()
  })

  test('refreshes stale content when a waiting tab becomes editable', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const editor = await context.newPage()
    const viewer = await context.newPage()

    const deckId = await createDeck(editor)
    await waitForDeckLockHeld(editor, deckId)
    await openDeck(viewer, deckId)

    await editor.waitForFunction(() => window.__slaideTest != null)
    await editor.evaluate(() => window.__slaideTest!.addRectangle())
    await expect
      .poll(async () => {
        const scene = await readStoredScene(editor, deckId)
        return scene.elements.some((element) => element.type === 'rectangle')
      }, { timeout: 5000 })
      .toBe(true)

    await editor.getByRole('link', { name: 'Home' }).click()
    await expect(viewer.getByTestId('readonly-notice')).toHaveCount(0, {
      timeout: 5000,
    })

    await viewer.waitForFunction(() => window.__slaideTest != null)
    await expect
      .poll(async () => viewer.evaluate(() => window.__slaideTest!.getElementCount()))
      .toBe(1)

    const restored = await readStoredScene(viewer, deckId)
    expect(restored.elements.some((element) => element.type === 'rectangle')).toBe(
      true,
    )
  })

  test('does not persist scene changes from a read-only tab', async ({ browser }) => {
    const context = await browser.newContext()
    const editor = await context.newPage()
    const viewer = await context.newPage()

    const deckId = await createDeck(editor)
    await waitForDeckLockHeld(editor, deckId)
    await openDeck(viewer, deckId)
    await expect(viewer.getByTestId('readonly-notice')).toBeVisible()

    await editor.waitForFunction(() => window.__slaideTest != null)
    await editor.evaluate(() => window.__slaideTest!.addRectangle())
    await expect
      .poll(async () => {
        const scene = await readStoredScene(editor, deckId)
        return scene.elements.some((element) => element.type === 'rectangle')
      }, { timeout: 5000 })
      .toBe(true)

    await expect
      .poll(async () => {
        const scene = await readStoredScene(viewer, deckId)
        return scene.elements.filter((element) => element.type === 'rectangle').length
      }, { timeout: 1500 })
      .toBe(1)

    expect(await viewer.evaluate(() => window.__slaideTest)).toBeUndefined()

    await context.close()
  })

  test('allows different decks to be edited in separate tabs simultaneously', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const firstEditor = await context.newPage()
    const secondEditor = await context.newPage()

    const firstDeckId = await createDeck(firstEditor)
    const secondDeckId = await createDeck(secondEditor)

    await expect(firstEditor.getByTestId('save-status')).toHaveText('Saved')
    await expect(secondEditor.getByTestId('save-status')).toHaveText('Saved')
    await expect(firstEditor.getByTestId('readonly-notice')).toHaveCount(0)
    await expect(secondEditor.getByTestId('readonly-notice')).toHaveCount(0)
    await expect(firstEditor.getByTestId('editor-tool-rectangle')).toBeVisible()
    await expect(secondEditor.getByTestId('editor-tool-rectangle')).toBeVisible()

    expect(firstDeckId).not.toBe(secondDeckId)

    await context.close()
  })
})

async function waitForDeckLockHeld(page: Page, deckId: string): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const state = await navigator.locks.query()
        return state.held.some((lock) => lock.name === `slaide-deck-${id}`)
      }, deckId),
    )
    .toBe(true)
}

async function createDeck(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
  return page.url().split('/').at(-1)!
}

async function openDeck(page: Page, deckId: string): Promise<void> {
  await page.goto(`/decks/${deckId}`)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function readStoredScene(
  page: Page,
  deckId: string,
): Promise<{
  elements: Array<{ id?: string; type: string }>
  appState: Record<string, unknown>
  files: Record<string, unknown>
}> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide')
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
      scene: {
        elements: Array<{ id?: string; type: string }>
        appState: Record<string, unknown>
        files: Record<string, unknown>
      }
    }>((resolve, reject) => {
      const tx = db.transaction('slides', 'readonly')
      const request = tx.objectStore('slides').get(deck.slideOrder[0]!)
      request.onsuccess = () =>
        resolve(
          request.result as {
            scene: {
              elements: Array<{ id?: string; type: string }>
              appState: Record<string, unknown>
              files: Record<string, unknown>
            }
          },
        )
      request.onerror = () => reject(request.error ?? new Error('slide read failed'))
    })
    db.close()
    return slide.scene
  }, deckId)
}
