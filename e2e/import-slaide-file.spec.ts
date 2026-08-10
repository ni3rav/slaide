import { expect, test, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type SlaideFile = {
  formatVersion: number
  deck: {
    id: string
    schemaVersion: number
    title: string
    slideOrder: string[]
    createdAt: number
    updatedAt: number
    theme?: 'light' | 'dark'
  }
  slides: Array<{
    id: string
    schemaVersion: number
    deckId: string
    scene: {
      elements: Array<Record<string, unknown>>
      appState: Record<string, unknown>
      files: Record<string, unknown>
    }
    createdAt: number
    updatedAt: number
  }>
}

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

test.describe('import a slaide file from the home screen', () => {
  test('imports a valid file as a separate deck with remapped ids', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('import-slaide-input')).not.toHaveAttribute('multiple')
    const originalDeckId = await createDeckFromHome(page)
    await renameDeck(page, 'Original deck')

    const transfer = buildValidSlaideFile('Transfer deck')
    transfer.slides[0]!.scene.elements = [buildRectangle('transfer-rectangle')]
    const filePath = await writeSlaideFixture('valid-deck.slaide', transfer)
    await triggerImport(page, filePath)

    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    await expect(page.getByRole('heading', { name: 'Transfer deck' })).toBeVisible()
    await page.waitForFunction(() => window.__slaideTest != null)
    await expect.poll(() => page.evaluate(() => window.__slaideTest!.getSceneElementCount())).toBe(1)

    const importedDeckId = page.url().split('/').at(-1)!
    expect(importedDeckId).not.toBe(originalDeckId)
    expect(importedDeckId).not.toBe('import-deck-1')

    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('link', { name: 'Transfer deck' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Original deck' })).toBeVisible()

    const freshPath = await writeSlaideFixture(
      'fresh-deck.slaide',
      buildValidSlaideFile('Fresh deck'),
    )
    await triggerImport(page, freshPath)

    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    await expect(page.getByRole('heading', { name: 'Fresh deck' })).toBeVisible()
    await page.waitForFunction(() => window.__slaideTest != null)
    await expect.poll(() => page.evaluate(() => window.__slaideTest!.getSceneElementCount())).toBe(0)
    expect(page.url().split('/').at(-1)).not.toBe(importedDeckId)
  })

  test('suffixes the title when a local deck already uses it', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)
    await renameDeck(page, 'Shared title')
    await expect(page.getByRole('link', { name: 'Shared title' })).toHaveCount(1)

    const filePath = await writeSlaideFixture(
      'shared-title.slaide',
      buildValidSlaideFile('Shared title'),
    )
    await triggerImport(page, filePath)

    await expect(page.getByRole('heading', { name: 'Shared title (Imported)' })).toBeVisible()
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('link', { name: 'Shared title', exact: true })).toHaveCount(1)
    await expect(
      page.getByRole('link', { name: 'Shared title (Imported)', exact: true }),
    ).toBeVisible()
  })

  test('rejects malformed files with a clear error and leaves storage unchanged', async ({
    page,
  }) => {
    await page.goto('/')
    await createDeckFromHome(page)
    await renameDeck(page, 'Still here')

    const filePath = await writeSlaideFixture('broken.slaide', '{not json')
    await triggerImport(page, filePath)

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText('Import failed')
    await expect(page.getByTestId('import-error')).toContainText(/valid JSON/i)
    await expect(page.getByRole('link', { name: 'Still here' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Transfer deck' })).toHaveCount(0)
  })

  test('rejects unsupported format versions before writing', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)

    const file = buildValidSlaideFile('Unsupported')
    file.formatVersion = 99
    const filePath = await writeSlaideFixture('unsupported.slaide', file)
    await triggerImport(page, filePath)

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText(/unsupported format version/i)
    await expect(page.getByRole('link', { name: 'Unsupported' })).toHaveCount(0)
  })

  test('rejects out-of-bounds elements before writing', async ({ page }) => {
    await page.goto('/')

    const file = buildValidSlaideFile('Out of bounds')
    file.slides[0]!.scene.elements = [
      {
        id: 'rect-1',
        type: 'rectangle',
        x: 3000,
        y: 100,
        width: 500,
        height: 120,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
      },
    ]
    const filePath = await writeSlaideFixture('out-of-bounds.slaide', file)
    await triggerImport(page, filePath)

    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByTestId('import-error')).toContainText(/outside the slide bounds/i)
    await expect(page.getByRole('link', { name: 'Out of bounds' })).toHaveCount(0)
  })

  test('stores the exported theme and restores it on import', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)
    await renameDeck(page, 'Theme deck')

    const download = await triggerHomeExport(page, 'Theme deck', 'dark')
    const exported = await readExportedSlaideFile(download)
    expect(exported.deck.theme).toBe('dark')

    await triggerImport(page, await download.path())
    await expect(page.getByRole('heading', { name: 'Theme deck (Imported)' })).toBeVisible()

    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.classList.contains('dark')),
      )
      .toBe(true)
  })

  test('export then import round trips scene content with new identities', async ({ page }) => {
    await page.goto('/')
    const originalDeckId = await createDeckFromHome(page)
    await renameDeck(page, 'Round trip deck')

    await page.getByRole('link', { name: 'Round trip deck' }).click()
    await seedSceneWithImage(page, (await readSlideOrder(page, originalDeckId))[0]!, originalDeckId)
    await page.getByRole('link', { name: 'Home' }).click()

    const download = await triggerHomeExport(page, 'Round trip deck')
    const exported = await readExportedSlaideFile(download)

    await triggerImport(page, await download.path())
    await expect(page.getByRole('heading', { name: 'Round trip deck (Imported)' })).toBeVisible()

    const importedDeckId = page.url().split('/').at(-1)!
    expect(importedDeckId).not.toBe(originalDeckId)

    const imported = await readDeckFromIndexedDb(page, importedDeckId)
    expect(imported.deck.title).toBe('Round trip deck (Imported)')
    expect(imported.deck.id).not.toBe(exported.deck.id)
    expect(imported.deck.slideOrder).not.toEqual(exported.deck.slideOrder)
    expect(imported.slides[0]?.scene.appState).toEqual(exported.slides[0]?.scene.appState)
    expect(imported.slides[0]?.scene.files).toEqual(exported.slides[0]?.scene.files)
    expect(imported.slides[0]?.scene.elements).toEqual(exported.slides[0]?.scene.elements)
  })
})

async function createDeckFromHome(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/([0-9a-f-]{36})$/i)
  const deckId = page.url().split('/').at(-1)!
  await page.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL('/', { timeout: 15_000 })
  return deckId
}

async function renameDeck(page: Page, title: string): Promise<void> {
  const deckItem = page.getByRole('listitem').first()
  await deckItem.getByRole('button', { name: /Rename/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').locator('input').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function triggerImport(page: Page, filePath: string | null | undefined): Promise<void> {
  if (!filePath) {
    throw new Error('Import file path missing')
  }
  await page.locator('[data-testid="import-slaide-input"]').setInputFiles(filePath)
}

async function triggerHomeExport(
  page: Page,
  deckTitle: string,
  theme: 'light' | 'dark' = 'light',
) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: `Export ${deckTitle}` }).click()
  await page.getByRole('menuitem', { name: 'Slaide' }).click()
  const dialog = page.getByTestId('export-theme-dialog')
  await expect(dialog).toBeVisible()
  if (theme === 'dark') {
    await dialog.getByRole('radio', { name: 'Dark Mode' }).click()
  }
  await dialog.getByRole('button', { name: 'Export' }).click()
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

async function readDeckFromIndexedDb(
  page: Page,
  deckId: string,
): Promise<{ deck: SlaideFile['deck']; slides: SlaideFile['slides'] }> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    const deck = await new Promise<SlaideFile['deck']>((resolve, reject) => {
      const tx = db.transaction('decks', 'readonly')
      const request = tx.objectStore('decks').get(id)
      request.onsuccess = () => resolve(request.result as SlaideFile['deck'])
      request.onerror = () => reject(request.error ?? new Error('deck read failed'))
    })
    const slides: SlaideFile['slides'] = []
    for (const slideId of deck.slideOrder) {
      const slide = await new Promise<SlaideFile['slides'][number]>((resolve, reject) => {
        const tx = db.transaction('slides', 'readonly')
        const request = tx.objectStore('slides').get(slideId)
        request.onsuccess = () => resolve(request.result as SlaideFile['slides'][number])
        request.onerror = () => reject(request.error ?? new Error('slide read failed'))
      })
      slides.push(slide)
    }
    db.close()
    return { deck, slides }
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
                angle: 0,
                strokeColor: 'transparent',
                backgroundColor: 'transparent',
                fillStyle: 'solid',
                strokeWidth: 1,
                strokeStyle: 'solid',
                roughness: 1,
                opacity: 100,
                seed: 1,
                version: 1,
                versionNonce: 1,
                isDeleted: false,
                groupIds: [],
                frameId: null,
                boundElements: null,
                updated: 1,
                link: null,
                locked: false,
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

function buildValidSlaideFile(title: string): SlaideFile {
  const deckId = 'import-deck-1'
  const slideId = 'import-slide-1'
  const now = Date.now()
  return {
    formatVersion: 1,
    deck: {
      id: deckId,
      schemaVersion: 1,
      title,
      slideOrder: [slideId],
      createdAt: now,
      updatedAt: now,
    },
    slides: [
      {
        id: slideId,
        schemaVersion: 1,
        deckId,
        scene: {
          elements: [],
          appState: { viewBackgroundColor: '#ffffff' },
          files: {},
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

function buildRectangle(id: string): Record<string, unknown> {
  return {
    id,
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 300,
    height: 200,
    angle: 0,
    strokeColor: '#000000',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
  }
}

async function writeSlaideFixture(filename: string, file: SlaideFile | string): Promise<string> {
  await mkdir(fixturesDir, { recursive: true })
  const filePath = path.join(fixturesDir, `${Date.now()}-${filename}`)
  const contents = typeof file === 'string' ? file : JSON.stringify(file, null, 2)
  await writeFile(filePath, contents, 'utf8')
  return filePath
}
