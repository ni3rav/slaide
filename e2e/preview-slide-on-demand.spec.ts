import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
    }
    __slaidePreviewTest?: {
      getActiveObjectUrlCount: () => number
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
    await expect(page.getByTestId('slide-preview-panel')).toHaveCSS('z-index', '10')
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
    const firstUrl = await page.getByTestId('slide-preview-image').getAttribute('src')

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
    await expect(page.getByTestId('slide-preview-image')).not.toHaveAttribute('src', firstUrl!)
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(1)
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

  test('clears preview state immediately when closed', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(1)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(0)
  })

  test('generates a fresh preview after the previous preview is closed', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    const firstImage = page.getByTestId('slide-preview-image')
    await expect(firstImage).toBeVisible({ timeout: 15000 })
    const firstUrl = await firstImage.getAttribute('src')

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(0)

    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect(page.getByTestId('save-status')).toHaveText('Saved', { timeout: 5000 })
    await page.getByRole('button', { name: 'Preview slide 1' }).click()

    const replacementImage = page.getByTestId('slide-preview-image')
    await expect(replacementImage).toBeVisible({ timeout: 15000 })
    await expect(replacementImage).not.toHaveAttribute('src', firstUrl!)
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(1)
  })

  test('clears an open preview when the sidebar is collapsed', async ({ page }) => {
    await openEditor(page)

    await page.getByRole('button', { name: 'Preview slide 1' }).click()
    await expect(page.getByTestId('slide-preview-image')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => window.__slaidePreviewTest?.getActiveObjectUrlCount() ?? 0))
      .toBe(0)

    await page.getByRole('button', { name: 'Open sidebar' }).click()
    await expect(page.getByTestId('slide-preview-panel')).toHaveCount(0)
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
