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
    await expect(page.getByText('Slide 2 of 2')).toBeVisible()
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText('Slide 1 of 2')).toBeVisible()
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

  test('stays in presentation when the browser leaves fullscreen', async ({ page }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible()

    await page.evaluate(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => null,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    await expect(page).toHaveURL(/\/present\?start=0$/)
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    await expect(page.getByTestId('fullscreen-warning')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible()
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
    await expect(page.getByText('Slide 2 of 3')).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Slide 3 of 3')).toBeVisible()

    await page.keyboard.press('ArrowRight')
    await expect(page.getByText('Slide 3 of 3')).toBeVisible()

    await page.keyboard.press('ArrowLeft')
    await expect(page.getByText('Slide 2 of 3')).toBeVisible()

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
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
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
