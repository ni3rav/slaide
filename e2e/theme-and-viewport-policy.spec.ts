import { expect, test, type Page } from '@playwright/test'

const VIEWPORT_BLOCKER_MESSAGE =
  '💅 requires a larger screen. Please use a desktop computer.'

test.describe('apply theme and desktop viewport policy', () => {
  test('uses the system theme when no explicit preference exists', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('persists an explicit theme preference across reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')

    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(
      page.getByRole('button', { name: 'Switch to dark theme' }),
    ).toBeVisible()

    const storedTheme = await readStoredThemePreference(page)
    expect(storedTheme).toBe('light')
  })

  test('applies the selected theme to Excalidraw in the editor', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect(page.getByTestId('theme-selector')).toBeEnabled()

    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.excalidraw.theme--dark')).toBeVisible()

    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(page.locator('.excalidraw.theme--dark')).toHaveCount(0)
  })

  test('blocks editing below 1024 pixels and restores access when widened', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    const deckId = page.url().split('/').at(-1)!
    await expect
      .poll(async () => {
        const scene = await readStoredScene(page, deckId)
        return scene.elements.some((element) => element.type === 'rectangle')
      }, { timeout: 5000 })
      .toBe(true)

    await page.setViewportSize({ width: 1023, height: 800 })
    const blocker = page.getByTestId('viewport-blocker')
    await expect(blocker).toBeVisible()
    await expect(blocker).toContainText(VIEWPORT_BLOCKER_MESSAGE)
    await expect(page.getByTestId('excalidraw-host')).toBeHidden()

    await page.setViewportSize({ width: 1024, height: 800 })
    await expect(blocker).toHaveCount(0)
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    const scene = await readStoredScene(page, deckId)
    expect(scene.elements.some((element) => element.type === 'rectangle')).toBe(true)
  })

  test('uses viewport width at the 1024 pixel boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 800 })
    await page.goto('/')
    await expect(page.getByTestId('viewport-blocker')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New deck' })).toBeHidden()

    await page.setViewportSize({ width: 1024, height: 800 })
    await expect(page.getByTestId('viewport-blocker')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'New deck' })).toBeVisible()
  })

  test('applies the viewport blocker in standalone display mode', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(display-mode: standalone)',
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }),
      })
    })

    await page.setViewportSize({ width: 900, height: 800 })
    await page.goto('/')
    await expect(page.getByTestId('viewport-blocker')).toBeVisible()
    await expect(page.getByTestId('viewport-blocker')).toContainText(VIEWPORT_BLOCKER_MESSAGE)
  })
})

async function readStoredThemePreference(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    const record = await new Promise<{ value?: string } | undefined>((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly')
      const request = tx.objectStore('settings').get('theme')
      request.onsuccess = () => resolve(request.result as { value?: string } | undefined)
      request.onerror = () => reject(request.error ?? new Error('settings read failed'))
    })
    db.close()
    return record?.value ?? null
  })
}

async function readStoredScene(
  page: Page,
  deckId: string,
): Promise<{ elements: Array<{ type: string }> }> {
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
    const slide = await new Promise<{ scene: { elements: Array<{ type: string }> } }>(
      (resolve, reject) => {
        const tx = db.transaction('slides', 'readonly')
        const request = tx.objectStore('slides').get(deck.slideOrder[0]!)
        request.onsuccess = () =>
          resolve(
            request.result as { scene: { elements: Array<{ type: string }> } },
          )
        request.onerror = () => reject(request.error ?? new Error('slide read failed'))
      },
    )
    db.close()
    return slide.scene
  }, deckId)
}
