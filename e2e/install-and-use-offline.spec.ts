import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

test.describe.configure({ mode: 'serial', timeout: 60_000 })

test.describe('install and use Slaide offline', () => {
  test('exposes installable PWA metadata and icons', async ({ page }) => {
    await gotoHome(page)

    const manifestHref =
      (await page.locator('link[rel="manifest"]').getAttribute('href')) ??
      '/manifest.webmanifest'

    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(href!)
      return response.json() as Promise<{
        name: string
        short_name: string
        icons: Array<{ src: string; sizes: string; type: string }>
      }>
    }, manifestHref)

    expect(manifest.name).toBe('Slaide')
    expect(manifest.short_name).toBe('Slaide')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, page.url()).toString()
      const iconResponse = await page.request.get(iconUrl)
      expect(iconResponse.ok()).toBe(true)
      expect(iconResponse.headers()['content-type']).toContain('image/png')
    }
  })

  test('registers a service worker that caches the application shell', async ({ page }) => {
    await gotoHome(page)
    await waitForServiceWorker(page)

    const cachedUrls = await listServiceWorkerCacheUrls(page)
    expect(cachedUrls.length).toBeGreaterThan(0)
    expect(cachedUrls.some((url) => url.endsWith('.js') || url.includes('/assets/'))).toBe(true)
  })

  test('does not put deck records in the service-worker cache', async ({ page }) => {
    await gotoHome(page)
    const deckId = await createDeckFromHome(page)
    await waitForServiceWorker(page)

    const cachedUrls = await listServiceWorkerCacheUrls(page)
    expect(cachedUrls.some((url) => url.includes(deckId))).toBe(false)
    expect(cachedUrls.some((url) => url.includes('indexeddb'))).toBe(false)
  })

  test('reopens and edits an existing deck offline after one online load', async ({
    page,
    context,
  }) => {
    await gotoHome(page)
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    const editorUrl = page.url()

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 })

    await waitForServiceWorker(page)
    await context.setOffline(true)
    await page.reload()

    await expect(page).toHaveURL(editorUrl)
    await expect(page.getByRole('heading', { name: 'Untitled deck' })).toBeVisible()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 10_000 })

    await context.setOffline(false)
  })

  test('imports and exports .slaide files while offline', async ({ page, context }) => {
    await gotoHome(page)
    await waitForServiceWorker(page)

    const deckId = await createDeckFromHome(page)
    await renameDeck(page, 'Offline deck')

    await page.getByRole('link', { name: 'Offline deck' }).click()
    await seedSceneWithImage(page, (await readSlideOrder(page, deckId))[0]!, deckId)
    await page.getByRole('link', { name: 'Home' }).click()

    await context.setOffline(true)

    const download = await triggerHomeExport(page, 'Offline deck')
    const exportedPath = await download.path()
    expect(exportedPath).toBeTruthy()

    const importPath = await writeSlaideFixture(
      'offline-import-only.slaide',
      buildValidSlaideFile('Offline import only'),
    )
    await triggerImport(page, importPath)
    await expect(page.getByRole('link', { name: 'Offline import only' })).toBeVisible()

    await context.setOffline(false)
  })

  test('requests persistent storage on first deck create and continues when denied', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let called = false
      const storage = navigator.storage
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: {
          ...storage,
          async persist() {
            called = true
            return false
          },
        },
      })
      ;(window as Window & { __persistCalled?: () => boolean }).__persistCalled = () => called
    })

    await gotoHome(page)
    await page.getByRole('button', { name: 'New deck' }).click()

    await expect.poll(() => page.evaluate(() => window.__persistCalled?.() ?? false)).toBe(true)
    await expect(page.getByRole('heading', { name: 'Untitled deck' })).toBeVisible()
  })

  test('requests persistent storage on first import and continues when denied', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let called = false
      const storage = navigator.storage
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: {
          ...storage,
          async persist() {
            called = true
            return false
          },
        },
      })
      ;(window as Window & { __persistCalled?: () => boolean }).__persistCalled = () => called
    })

    const filePath = await writeSlaideFixture('offline-import.slaide', buildValidSlaideFile('Imported offline'))
    await gotoHome(page)
    await triggerImport(page, filePath)

    await expect.poll(() => page.evaluate(() => window.__persistCalled?.() ?? false)).toBe(true)
    await expect(page.getByRole('link', { name: 'Imported offline' })).toBeVisible()
  })
})

test.describe('application update prompt', () => {
  test('shows reload when an update is waiting and does not auto-reload with unsaved edits', async ({
    page,
  }) => {
    await gotoHome(page)
    await page.getByRole('button', { name: 'New deck' }).click()
    await waitForServiceWorker(page)

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())

    await page.evaluate(() => window.__slaidePwaTest!.showUpdatePrompt())

    await expect(page.getByTestId('app-update-prompt')).toBeVisible()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Untitled deck' })).toBeVisible()
  })

  test('activates the update when reload is chosen', async ({ page }) => {
    await gotoHome(page)
    await waitForServiceWorker(page)

    await page.evaluate(() => window.__slaidePwaTest!.showUpdatePrompt())
    await expect(page.getByTestId('app-update-prompt')).toBeVisible()

    await page.getByTestId('app-update-reload').click()
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null)
    await expect(page.getByRole('heading', { name: 'Slaide' })).toBeVisible()
  })
})

async function gotoHome(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'New deck' })).toBeVisible({
    timeout: 30_000,
  })
}

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(async () => {
    if (!('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.getRegistration()
    return registration != null
  })

  const hasController = await page.evaluate(() => navigator.serviceWorker?.controller != null)
  if (!hasController) {
    await page.reload()
  }

  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 30_000,
  })
}

async function listServiceWorkerCacheUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const names = await caches.keys()
    const urls: string[] = []
    for (const name of names) {
      const cache = await caches.open(name)
      const requests = await cache.keys()
      urls.push(...requests.map((request) => request.url))
    }
    return urls
  })
}

async function createDeckFromHome(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/([0-9a-f-]{36})$/i)
  const deckId = page.url().split('/').at(-1)!
  await page.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL('/')
  return deckId
}

async function renameDeck(page: Page, title: string): Promise<void> {
  const deckItem = page.getByRole('listitem').first()
  await deckItem.getByRole('button', { name: /Rename/ }).click()
  await page.getByRole('dialog').getByLabel('Deck title').fill(title)
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function triggerHomeExport(page: Page, deckTitle: string) {
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: `Export ${deckTitle}` }).click()
  await page.getByRole('menuitem', { name: 'Slaide' }).click()
  return downloadPromise
}

async function triggerImport(page: Page, filePath: string | null | undefined): Promise<void> {
  if (!filePath) {
    throw new Error('Import file path missing')
  }
  await page.locator('[data-testid="import-slaide-input"]').setInputFiles(filePath)
  await expect(page.getByRole('button', { name: 'Import deck' })).toBeEnabled({
    timeout: 15_000,
  })
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

async function seedSceneWithImage(page: Page, slideId: string, deckId: string): Promise<void> {
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

type SlaideFile = {
  formatVersion: number
  deck: {
    id: string
    schemaVersion: number
    title: string
    slideOrder: string[]
    createdAt: number
    updatedAt: number
  }
  slides: Array<{
    id: string
    schemaVersion: number
    deckId: string
    scene: {
      elements: unknown[]
      appState: Record<string, unknown>
      files: Record<string, unknown>
    }
    createdAt: number
    updatedAt: number
  }>
}

function buildValidSlaideFile(title: string): SlaideFile {
  const deckId = 'import-deck-offline'
  const slideId = 'import-slide-offline'
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

async function writeSlaideFixture(filename: string, file: SlaideFile): Promise<string> {
  await mkdir(fixturesDir, { recursive: true })
  const filePath = path.join(fixturesDir, `${Date.now()}-${filename}`)
  await writeFile(filePath, JSON.stringify(file, null, 2), 'utf8')
  return filePath
}

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
    }
    __persistCalled?: () => boolean
    __slaidePwaTest?: {
      showUpdatePrompt: () => void
    }
  }
}
