import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      addRectangle: () => void
      getElementCount: () => number
      getElementIds: () => string[]
      selectElements: (ids: string[]) => void
      getSelectedElementIds: () => string[]
      getElementGroupIds: () => Record<string, string[]>
      isGridEnabled: () => boolean
    }
  }
}

test.describe('arrange controls and grid', () => {
  test('exposes group, layer, and grid controls in the sidebar', async ({
    page,
  }) => {
    await openEditor(page)

    await expect(page.getByTestId('editor-action-group')).toBeVisible()
    await expect(page.getByTestId('editor-action-ungroup')).toBeVisible()
    await expect(page.getByTestId('editor-action-send-to-back')).toBeVisible()
    await expect(page.getByTestId('editor-action-send-backward')).toBeVisible()
    await expect(page.getByTestId('editor-action-bring-forward')).toBeVisible()
    await expect(page.getByTestId('editor-action-bring-to-front')).toBeVisible()
    await expect(page.getByTestId('editor-action-toggle-grid')).toBeVisible()

    await expect(page.getByTestId('editor-action-group')).toBeDisabled()
    await expect(page.getByTestId('editor-action-bring-to-front')).toBeDisabled()
  })

  test('toggles the canvas grid from the sidebar', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await expect(page.getByTestId('editor-action-toggle-grid')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.isGridEnabled()))
      .toBe(false)

    await page.getByTestId('editor-action-toggle-grid').click()
    await expect(page.getByTestId('editor-action-toggle-grid')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.isGridEnabled()))
      .toBe(true)

    await page.getByTestId('editor-action-toggle-grid').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.isGridEnabled()))
      .toBe(false)
  })

  test('groups and ungroups a multi-selection', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await page.evaluate(() => {
      window.__slaideTest!.addRectangle()
      window.__slaideTest!.addRectangle()
    })
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementCount()))
      .toBe(2)

    const ids = await page.evaluate(() => window.__slaideTest!.getElementIds())
    await page.evaluate((elementIds) => {
      window.__slaideTest!.selectElements(elementIds)
    }, ids)

    await expect(page.getByTestId('editor-action-group')).toBeEnabled()
    await page.getByTestId('editor-action-group').click()

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const groups = window.__slaideTest!.getElementGroupIds()
          return Object.values(groups).every((groupIds) => groupIds.length > 0)
        }),
      )
      .toBe(true)

    await expect(page.getByTestId('editor-action-ungroup')).toBeEnabled()
    await page.getByTestId('editor-action-ungroup').click()

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const groups = window.__slaideTest!.getElementGroupIds()
          return Object.values(groups).every((groupIds) => groupIds.length === 0)
        }),
      )
      .toBe(true)
  })

  test('reorders selected elements with layer controls', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await page.evaluate(() => {
      window.__slaideTest!.addRectangle()
      window.__slaideTest!.addRectangle()
    })
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementCount()))
      .toBe(2)

    const before = await page.evaluate(() => window.__slaideTest!.getElementIds())
    const bottomId = before[0]!

    await page.evaluate((id) => {
      window.__slaideTest!.selectElements([id])
    }, bottomId)

    await expect(page.getByTestId('editor-action-bring-to-front')).toBeEnabled()
    await page.getByTestId('editor-action-bring-to-front').click()

    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementIds()))
      .toEqual([before[1], bottomId])

    await page.getByTestId('editor-action-send-to-back').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementIds()))
      .toEqual(before)
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}
