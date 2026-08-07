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
  }
}

test.describe('present static slide images', () => {
  test('enters presentation immediately from slide one', async ({ page }) => {
    await openEditor(page)
    await stubFullscreenSuccess(page)

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
    await openEditor(page)
    await stubFullscreenSuccess(page)
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

    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`))
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()

    await page.getByRole('button', { name: '3', exact: true }).click()
    await page.getByRole('button', { name: 'Present' }).click()
    await page.getByRole('button', { name: 'From beginning' }).click()
    await expect(page).toHaveURL(/\/present\?start=0$/)
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()
  })

  test('force-saves before presentation and shows edited content', async ({ page }) => {
    await openEditor(page)
    await stubFullscreenSuccess(page)

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 5000 })

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
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 5000 })

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

  test('requests fullscreen when supported', async ({ page }) => {
    await openEditor(page)
    await stubFullscreenSuccess(page)

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    await expect(page.getByTestId('fullscreen-warning')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement != null))
      .toBe(true)
  })

  test('navigates with click and arrow keys without wrapping', async ({ page }) => {
    await openEditor(page)
    await stubFullscreenSuccess(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: '1', exact: true }).click()

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByText('Slide 1 of 3')).toBeVisible()

    await page.getByTestId('presentation-overlay').click()
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
  })

  test('exits presentation, releases image resources, and returns to the deck', async ({
    page,
  }) => {
    await openEditor(page)
    await stubFullscreenSuccess(page)
    const deckId = page.url().split('/').at(-1)!

    await page.getByRole('button', { name: 'Present' }).click()
    await expect(page.getByTestId('presentation-slide-image')).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => window.__slaidePresentationTest?.getActiveObjectUrlCount() ?? 0))
      .toBeGreaterThan(0)

    await page.keyboard.press('Escape')

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
    HTMLElement.prototype.requestFullscreen = async function requestFullscreen() {
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
