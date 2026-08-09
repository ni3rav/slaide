import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
    }
    __slaidePresentationTest?: {
      getActiveObjectUrlCount: () => number
      getCurrentSlideIndex: () => number
      isFullscreenDenied: () => boolean
    }
    __fullscreenRequestPaths?: string[]
    __slaidePresentationRenderDelayMs?: number
    __slaidePresentationFailSlideIds?: string[]
  }
}

test.describe('present static slide images', () => {
  test('enters presentation immediately from slide one', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Present' }).click()

    await expect(page).toHaveURL(/\/present\?start=0$/)
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    await expect(page.getByTestId('excalidraw-host')).toHaveCount(0)
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('Slide 1 of 1')).toBeVisible()
  })

  test('asks to start from current slide or from beginning on later slides', async ({
    page,
  }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '3', exact: true }).click()

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expect(page.getByRole('button', { name: 'From current slide' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'From beginning' })).toBeVisible()

    await page.getByRole('button', { name: 'From current slide' }).click()
    await expect(page).toHaveURL(/\/present\?start=2$/)
    await expect(page.getByText('Slide 3 of 3')).toBeVisible()

    await page.getByRole('button', { name: 'Exit presentation' }).click()
    await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`))
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Present' }).click()
    await page.getByRole('button', { name: 'From beginning' }).click()
    await expect(page).toHaveURL(/\/present\?start=0$/)
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()
  })

  test('force-saves before presentation and shows edited content', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 })

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible()
    await expect(page.getByTestId('presentation-slide-image')).toHaveJSProperty(
      'naturalWidth',
      1920,
    )
    await expect(page.getByTestId('presentation-slide-image')).toHaveJSProperty(
      'naturalHeight',
      1080,
    )
  })

  test('blocks presentation when force-save fails', async ({ page }) => {
    await stubFullscreenSuccess(page)
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
    await page.getByRole('button', { name: 'Present' }).click()

    await expect(page.getByTestId('present-error')).toBeVisible()
    await expect(page).not.toHaveURL(/\/present/)
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement != null))
      .toBe(false)
  })

  test('continues in-page when fullscreen is denied', async ({ page }) => {
    await stubFullscreenDenied(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    await expect(page.getByTestId('fullscreen-warning')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.__slaidePresentationTest?.isFullscreenDenied()))
      .toBe(true)
  })

  test('dismisses the fullscreen warning and keeps presenting', async ({ page }) => {
    await stubFullscreenDenied(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('fullscreen-warning')).toBeVisible()

    await page.getByRole('button', { name: 'Dismiss fullscreen warning' }).click()
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 2 of 2')
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)

    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 1 of 2')
  })

  test('re-enters fullscreen from the warning action', async ({ page }) => {
    await stubFullscreenDeniedOnce(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('fullscreen-warning')).toBeVisible()

    await page.getByRole('button', { name: 'Enter fullscreen' }).click()
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement != null))
      .toBe(true)
  })

  test('exits with Escape while presenting in-page', async ({ page }) => {
    await stubFullscreenDenied(page)
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('fullscreen-warning')).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`))
  })

  test('requests fullscreen within the Present click gesture', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement != null))
      .toBe(true)

    // The request must fire on the editor route, before the async save and
    // navigation, so real browsers still see the user activation.
    const requestPath = await page.evaluate(() => window.__fullscreenRequestPaths?.[0])
    expect(requestPath).toMatch(/^\/decks\/[0-9a-f-]{36}$/i)
  })

  test('exits presentation to the editor when the browser leaves fullscreen', async ({
    page,
  }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible()

    await page.evaluate(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`))
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect(page.getByTestId('presentation-overlay')).toHaveCount(0)
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)
  })

  test('navigates with controls and arrow keys without wrapping', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()

    await page.getByTestId('presentation-overlay').click({ position: { x: 500, y: 300 } })
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()

    await page.getByRole('button', { name: 'Next slide' }).click()
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 2 of 3')

    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 3 of 3')

    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 3 of 3')

    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 2 of 3')

    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Previous slide' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Next slide' })).toBeEnabled()
  })

  test('exits presentation, releases image resources, and returns to the deck', async ({
    page,
  }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.__slaidePresentationTest?.getActiveObjectUrlCount() ?? 0))
      .toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Exit presentation' }).click()

    await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`))
    await expect(page.getByTestId('presentation-overlay')).toHaveCount(0)
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.__slaidePresentationTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(0)
  })

  test('retains at most five presentation images while navigating a large deck', async ({
    page,
  }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await addSlides(page, 7)

    await presentFromBeginning(page)
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 15000,
    })

    for (let index = 0; index < 7; index += 1) {
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('presentation-slide-counter')).toHaveText(
        `Slide ${index + 2} of 8`,
      )
      await waitForNavigationThrottle(page)
    }

    await expect
      .poll(() =>
        page.evaluate(() => window.__slaidePresentationTest?.getActiveObjectUrlCount() ?? 0),
      )
      .toBeLessThanOrEqual(5)
  })

  test('shows loading while a delayed target image is still rendering', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await page.addInitScript(() => {
      window.__slaidePresentationRenderDelayMs = 2_000
    })
    await openEditor(page)

    await addSlides(page, 5)

    await presentFromBeginning(page)
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 20_000,
    })

    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowRight')
    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowRight')
    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowRight')
    await waitForNavigationThrottle(page)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('presentation-loading')).toBeVisible()
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 5 of 6')
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 20_000,
    })
  })

  test('ignores rapid navigation input for 300 milliseconds', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await page.addInitScript(() => {
      window.__slaidePresentationRenderDelayMs = 1_000
    })
    await openEditor(page)

    await addSlides(page, 3)

    await presentFromBeginning(page)
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 15000,
    })

    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 2 of 4')

    await page.waitForTimeout(350)
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 3 of 4')
  })

  test('shows Retry and Exit when image generation fails', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await addSlides(page, 5)

    await presentFromBeginning(page)
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 15000,
    })

    const failingSlideId = await getSlideIdAtDeckIndex(page, 4)

    await page.evaluate((slideId) => {
      window.__slaidePresentationFailSlideIds = [slideId]
    }, failingSlideId)

    for (let index = 0; index < 4; index += 1) {
      await waitForNavigationThrottle(page)
      await page.keyboard.press('ArrowRight')
    }

    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 5 of 6')
    await expect(page.getByTestId('presentation-retry')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('presentation-exit')).toBeVisible()
    await expect(page.getByTestId('presentation-slide-image')).toHaveCount(0)
  })

  test('revokes evicted image URLs while navigating forward and backward', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await addSlides(page, 6)

    await presentFromBeginning(page)
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible({
      timeout: 15000,
    })

    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('ArrowRight')
      await waitForNavigationThrottle(page)
    }
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 7 of 7')

    await expect
      .poll(() =>
        page.evaluate(() => window.__slaidePresentationTest?.getActiveObjectUrlCount() ?? 0),
      )
      .toBeLessThanOrEqual(5)

    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press('ArrowLeft')
      await waitForNavigationThrottle(page)
    }
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 1 of 7')
    await expect
      .poll(() =>
        page.evaluate(() => window.__slaidePresentationTest?.getActiveObjectUrlCount() ?? 0),
      )
      .toBeLessThanOrEqual(5)
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function addSlides(page: Page, count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('button', { name: String(index + 2), exact: true })).toBeVisible()
  }
}

async function presentFromBeginning(page: Page): Promise<void> {
  await page.getByRole('button', { name: '1', exact: true }).click()
  await page.getByRole('button', { name: 'Present' }).click()
  const fromBeginning = page.getByRole('button', { name: 'From beginning' })
  if (await fromBeginning.isVisible()) {
    await fromBeginning.click()
  }
  await expect(page).toHaveURL(/\/present\?start=0$/)
}

async function waitForNavigationThrottle(page: Page): Promise<void> {
  await page.waitForTimeout(350)
}

async function getSlideIdAtDeckIndex(page: Page, index: number): Promise<string> {
  return page.evaluate(async (slideIndex) => {
    const deckId = window.location.pathname.split('/')[2]!
    const request = indexedDB.open('slaide')
    return await new Promise<string>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('decks', 'readonly')
        const deckRequest = tx.objectStore('decks').get(deckId)
        deckRequest.onsuccess = () => {
          const deck = deckRequest.result as { slideOrder: string[] }
          resolve(deck.slideOrder[slideIndex]!)
        }
        deckRequest.onerror = () => reject(deckRequest.error)
      }
    })
  }, index)
}

async function stubFullscreenSuccess(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__fullscreenRequestPaths = []
    HTMLElement.prototype.requestFullscreen = async function requestFullscreen() {
      window.__fullscreenRequestPaths!.push(window.location.pathname)
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => this,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    }
    document.exitFullscreen = async () => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    }
  })
}

async function stubFullscreenDenied(page: Page): Promise<void> {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = async function requestFullscreen() {
      throw new Error('Fullscreen denied')
    }
  })
}

async function stubFullscreenDeniedOnce(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let denied = false
    HTMLElement.prototype.requestFullscreen = async function requestFullscreen() {
      if (!denied) {
        denied = true
        throw new Error('Fullscreen denied')
      }
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => this,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    }
    document.exitFullscreen = async () => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    }
  })
}
