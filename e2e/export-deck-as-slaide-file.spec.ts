import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
    }
  }
}

type SlaideFile = {
  formatVersion: number
  deck: {
    id: string
    title: string
    slideOrder: string[]
  }
  slides: Array<{
    id: string
    deckId: string
    scene: {
      elements: Array<{ type: string; fileId?: string }>
      appState: Record<string, unknown>
      files: Record<string, unknown>
    }
  }>
}

test.describe('export one deck as a slaide file', () => {
  test('exports one deck from the home screen with ordered slides and binary files', async ({
    page,
  }) => {
    await page.goto('/')
    const deckId = await createDeckFromHome(page)
    await renameDeck(page, 'Q1: Sales / Forecast')

    await page.getByRole('link', { name: 'Q1: Sales / Forecast' }).click()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    await seedSceneWithImage(page, (await readSlideOrder(page, deckId))[0]!, deckId)
    await page.reload()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(2)
    const slideIds = await readSlideOrder(page, deckId)

    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/')

    const download = await triggerHomeExport(page, 'Q1: Sales / Forecast')
    expect(download.suggestedFilename()).toBe('Q1_ Sales _ Forecast.slaide')

    const exported = await readExportedSlaideFile(download)
    expect(exported.formatVersion).toBe(1)
    expect(exported.deck.id).toBe(deckId)
    expect(exported.deck.title).toBe('Q1: Sales / Forecast')
    expect(exported.slides.map((slide) => slide.id)).toEqual(slideIds)
    expect(exported.slides[0]?.scene.files['file-1']).toMatchObject({
      id: 'file-1',
      mimeType: 'image/png',
    })
    expect(exported.slides[1]?.scene.elements).toHaveLength(0)
  })

  test('exports only the selected deck when multiple decks exist', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)
    const exportedDeckId = await createDeckFromHome(page)
    await renameDeck(page, 'Export me')

    const download = await triggerHomeExport(page, 'Export me')
    const exported = await readExportedSlaideFile(download)

    expect(exported.deck.id).toBe(exportedDeckId)
    expect(exported.deck.title).toBe('Export me')
    expect(exported.slides).toHaveLength(1)
    expect(download.suggestedFilename()).toBe('Export me.slaide')
  })

  test('exports a complete deck from the home screen as PDF', async ({ page }) => {
    await openEditor(page)
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await page.getByRole('link', { name: 'Home' }).click()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export Untitled deck' }).click()
    await page.getByRole('menuitem', { name: 'Pdf' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('Untitled deck.pdf')
    const filePath = await download.path()
    expect(filePath).not.toBeNull()
    const pdf = await PDFDocument.load(await readFile(filePath!))
    expect(pdf.getPageCount()).toBe(2)
    expect(pdf.getPages().map((page) => page.getSize())).toEqual([
      { width: 1920, height: 1080 },
      { width: 1920, height: 1080 },
    ])
  })

  test('force-saves from the editor before exporting the active deck', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export deck' }).click()
    await page.getByRole('menuitem', { name: 'Slaide' }).click()
    const download = await downloadPromise

    const exported = await readExportedSlaideFile(download)
    expect(exported.deck.id).toBe(deckId)
    expect(
      exported.slides[0]?.scene.elements.some((element) => element.type === 'rectangle'),
    ).toBe(true)
  })

  test('exports the active deck from the editor as PDF', async ({ page }) => {
    await openEditor(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export deck' }).click()
    await page.getByRole('menuitem', { name: 'Pdf' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('Untitled deck.pdf')
    const filePath = await download.path()
    expect(filePath).not.toBeNull()
    const pdf = await PDFDocument.load(await readFile(filePath!))
    expect(pdf.getPageCount()).toBe(1)
  })

  test('blocks editor export and shows a clear error when force-save fails', async ({
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
          this.transaction.abort()
        }
        return originalPut.call(this, value, key)
      }
    })

    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Save failed', {
      timeout: 5000,
    })
    await page.getByRole('button', { name: 'Export deck' }).click()
    await page.getByRole('menuitem', { name: 'Slaide' }).click()

    await expect(page.getByTestId('export-error')).toBeVisible()
    await expect(page.getByText('Export failed')).toBeVisible()
    await expect(page.getByText(/could not be saved/i)).toBeVisible()
  })

  test('keeps native Excalidraw scene export actions unavailable', async ({ page }) => {
    await openEditor(page)

    await page.getByTestId('main-menu-trigger').click()
    await expect(page.getByText(/^Export to/i)).toHaveCount(0)
    await expect(page.getByText(/^Save to/i)).toHaveCount(0)
    await expect(page.getByText(/^Load /i)).toHaveCount(0)
  })
})

async function createDeckFromHome(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/([0-9a-f-]{36})$/i)
  const deckId = page.url().split('/').at(-1)!
  await page.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL('/')
  return deckId
}

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function renameDeck(page: Page, title: string): Promise<void> {
  const deckItem = page.getByRole('listitem').nth(0)
  await deckItem.getByRole('button', { name: /Rename/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Deck title').fill(title)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

async function triggerHomeExport(page: Page, deckTitle: string) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: `Export ${deckTitle}` }).click()
  await page.getByRole('menuitem', { name: 'Slaide' }).click()
  return downloadPromise
}

async function readExportedSlaideFile(download: {
  path: () => Promise<string | null>
}): Promise<SlaideFile> {
  const filePath = await download.path()
  if (!filePath) {
    throw new Error('Download path missing')
  }
  return JSON.parse(await readFile(filePath, 'utf8')) as SlaideFile
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

async function seedSceneWithImage(
  page: Page,
  slideId: string,
  deckId: string,
): Promise<void> {
  await page.evaluate(
    async ({ id, deck }) => {
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
          const deckRequest = decks.get(deck)
          deckRequest.onsuccess = () => {
            const deckRecord = deckRequest.result as { updatedAt: number }
            deckRecord.updatedAt = now
            decks.put(deckRecord)
          }
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('seed failed'))
      })
      db.close()
    },
    { id: slideId, deck: deckId },
  )
}
