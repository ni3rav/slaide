import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
    }
    __slaidePreviewTest?: {
      getActiveObjectUrlCount: () => number
      isPreviewAnimating: () => boolean
      failNextRender: () => void
    }
  }
}

test.describe('preview slide on demand', () => {
  test('opens a rendered preview without navigating away', async ({ page }) => {
    await openEditor(page)
    const deckId = page.url().split('/').at(-1)!

    await page.waitForFunction(() => window.__slaideTest != null)
    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 })

    await page.getByRole('button', { name: 'Preview slide 1' }).click()

    await expect(page.getByTestId('slide-preview-panel')).toBeVisible()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('slide-preview-image')).toHaveJSProperty('naturalWidth', 1920)
    await expect(page.getByTestId('slide-preview-image')).toHaveJSProperty('naturalHeight', 1080)
    await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`))
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('keeps only one preview open and switches rows', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await page.getByRole('button', { name: 'Add slide' }).click()

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Preview slide 1' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await page.getByRole('button', { name: 'Preview slide 2' }).click()
    await expect(page.getByRole('button', { name: 'Preview slide 1' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Preview slide 2' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
  })

  test('shows retry after a render failure and recovers', async ({ page }) => {
    await openEditor(page)

    await page.waitForFunction(() => window.__slaidePreviewTest != null)
    await page.evaluate(() => window.__slaidePreviewTest!.failNextRender())

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
  })

  test('closes with animation and revokes preview object URLs', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(1)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-panel')).toHaveAttribute(
      'data-preview-state',
      'closing',
    )
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.isPreviewAnimating() ?? false))
      .toBe(true)

    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(0, { timeout: 2000 })
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(0)
  })

  test('closes an open preview when Escape is pressed', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })

    await page.keyboard.press('Escape')

    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(0, { timeout: 2000 })
    await expect(page.getByRole('button', { name: 'Preview slide 1' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  test('preview control does not navigate to another slide', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Add slide' }).click()
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}
