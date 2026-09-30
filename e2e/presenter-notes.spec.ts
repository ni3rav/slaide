import { expect, test, type Page } from '@playwright/test'

test.describe('presenter notes', () => {
  test('shows notes in the presenter window and keeps them off the audience view', async ({
    page,
  }) => {
    await stubFullscreenSuccess(page)
    await openEditor(page)

    await page.getByTestId('presenter-notes').fill('Whisper the title')
    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByTestId('presenter-notes')).toHaveValue('')
    await page.getByTestId('presenter-notes').fill('Point at the diagram')
    await page.getByRole('button', { name: '1', exact: true }).click()
    await expect(page.getByTestId('presenter-notes')).toHaveValue('Whisper the title')

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Present' }).click()
    const presenter = await popupPromise
    await presenter.setViewportSize({ width: 1280, height: 800 })

    await expect(page).toHaveURL(/\/present\?start=0$/)
    await expect(page.getByTestId('presentation-overlay')).toBeVisible()
    await expect(page.getByTestId('presentation-overlay')).not.toContainText('Whisper the title')
    await expect(page.getByTestId('presentation-overlay')).not.toContainText('Point at the diagram')
    await expect(page.getByTestId('presenter-notes-text')).toHaveCount(0)

    await expect(presenter.getByTestId('presenter-view')).toBeVisible({ timeout: 20000 })
    await expect(presenter.getByTestId('presenter-slide-counter')).toHaveText('Slide 1 of 2')
    await expect(presenter.getByTestId('presenter-notes-text')).toHaveText('Whisper the title')
    await expect(presenter.getByTestId('presenter-current-slide')).toBeVisible({ timeout: 15000 })
    await expect(presenter.getByTestId('presenter-next-slide')).toBeVisible()

    await presenter.getByRole('button', { name: 'Next slide' }).click()
    await expect(presenter.getByTestId('presenter-slide-counter')).toHaveText('Slide 2 of 2')
    await expect(presenter.getByTestId('presenter-notes-text')).toHaveText('Point at the diagram')
    await expect(page.getByTestId('presentation-slide-counter')).toHaveText('Slide 2 of 2')
    await expect(page.getByTestId('presentation-overlay')).not.toContainText('Point at the diagram')

    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect.poll(() => presenter.isClosed()).toBe(true)
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
