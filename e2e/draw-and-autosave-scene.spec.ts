import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
    }
  }
}

test.describe('draw and autosave one scene', () => {
  test('mounts Excalidraw without excluded tools and native scene file actions', async ({
    page,
  }) => {
    await openEditor(page)

    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect(page.getByTestId('editor-tool-rectangle')).toBeVisible()
    await expect(page.getByTestId('editor-tool-freedraw')).toBeVisible()
    await expect(page.getByTestId('editor-tool-autoshape')).toBeVisible()
    await expect(page.getByTestId('editor-tool-lasso')).toBeVisible()
    await expect(page.getByTestId('editor-tool-bucketfill')).toBeVisible()
    await expect(page.getByTestId('editor-tool-image')).toBeVisible()
    await expect(page.getByTestId('editor-tool-eraser')).toBeVisible()
    await expect(page.locator('.App-toolbar__extra-tools-trigger')).toBeHidden()
    await expect(page.locator('.default-sidebar-trigger')).toBeHidden()

    await page.getByTestId('main-menu-trigger').click()
    await expect(page.getByTestId('dropdown-menu')).toBeVisible()
    await expect(page.getByText(/^Load /i)).toHaveCount(0)
    await expect(page.getByText(/^Export to/i)).toHaveCount(0)
    await expect(page.getByText(/^Save to/i)).toHaveCount(0)
    await expect(page.getByTestId('clear-canvas-button')).toBeVisible()
  })

  test('autosaves scene content and restores it after reload', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect
      .poll(async () => {
        const scene = await readStoredScene(page, deckId)
        return scene.elements.some((element) => element.type === 'rectangle')
      }, { timeout: 5000 })
      .toBe(true)

    await page.reload()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    const restored = await readStoredScene(page, deckId)
    expect(restored.elements.some((element) => element.type === 'rectangle')).toBe(true)
    expect(restored.appState.viewBackgroundColor).toBeTruthy()
    expect(restored.appState).not.toHaveProperty('scrollX')
    expect(restored.appState).not.toHaveProperty('zoom')
    expect(restored.appState).not.toHaveProperty('selectedElementIds')
    expect(restored.appState).not.toHaveProperty('activeTool')
  })

  test('force-saves on home navigation and warns when the save fails', async ({
    page,
  }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 })

    await page.evaluate(() => {
      const originalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function patchedPut(value, key) {
        if (this.name === 'slides') {
          IDBObjectStore.prototype.put = originalPut
          this.transaction.abort()
        }
        return originalPut.call(this, value, key)
      }
    })

    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await page.getByRole('link', { name: 'Home' }).click()

    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Save failed' })).toBeVisible()
    await expect(page).toHaveURL(/\/decks\//)

    await page.getByRole('button', { name: 'Stay' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('persists binary files with the scene', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!
    const slideId = await readActiveSlideId(page, deckId)

    await page.evaluate(
      async ({ id }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('slaide', 2)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error ?? new Error('open failed'))
        })
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(['decks', 'slides'], 'readwrite')
          const slides = tx.objectStore('slides')
          const decks = tx.objectStore('decks')
          const getRequest = slides.get(id)
          getRequest.onsuccess = () => {
            const slide = getRequest.result as {
              scene: {
                elements: unknown[]
                appState: Record<string, unknown>
                files: Record<string, unknown>
              }
              deckId: string
              updatedAt: number
            }
            const now = Date.now()
            slide.scene = {
              elements: [
                {
                  id: 'image-1',
                  type: 'image',
                  x: 40,
                  y: 40,
                  width: 100,
                  height: 80,
                  fileId: 'file-1',
                  status: 'saved',
                  scale: [1, 1],
                },
              ],
              appState: { viewBackgroundColor: '#112233' },
              files: {
                'file-1': {
                  id: 'file-1',
                  mimeType: 'image/png',
                  dataURL:
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                  created: now,
                },
              },
            }
            slide.updatedAt = now
            slides.put(slide)
            const deckRequest = decks.get(slide.deckId)
            deckRequest.onsuccess = () => {
              const deck = deckRequest.result as { updatedAt: number }
              deck.updatedAt = now
              decks.put(deck)
            }
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error ?? new Error('seed failed'))
        })
        db.close()
      },
      { id: slideId },
    )

    await page.reload()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    const restored = await readStoredScene(page, deckId)
    expect(restored.files['file-1']).toMatchObject({
      id: 'file-1',
      mimeType: 'image/png',
    })
    expect(restored.appState.viewBackgroundColor).toBe('#112233')
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function readActiveSlideId(page: Page, deckId: string): Promise<string> {
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
    return deck.slideOrder[0]!
  }, deckId)
}

async function readStoredScene(
  page: Page,
  deckId: string,
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
    const deck = await new Promise<{ slideOrder: string[] }>((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly')
      const request = tx.objectStore('decks').get(id)
      request.onsuccess = () => resolve(request.result as { slideOrder: string[] })
      request.onerror = () => reject(request.error ?? new Error('deck read failed'))
    })
    const slide = await new Promise<{
      scene: {
        elements: Array<{ type: string }>
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
  }, deckId)
}
