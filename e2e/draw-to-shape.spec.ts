import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      getActiveTool: () => string
      getElementTypes: () => string[]
      getElementCount: () => number
    }
  }
}

test.describe('draw to shape', () => {
  test('activates from the sidebar tool and Shift+X without collapsing the sidebar', async ({
    page,
  }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    const sidebar = page.getByRole('complementary', { name: 'Slides' })
    await expect(sidebar).toBeVisible()
    await expect(page.getByTestId('editor-tool-autoshape')).toBeVisible()

    await page.getByTestId('editor-tool-selection').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('selection')

    await page.getByTestId('editor-tool-autoshape').click()
    await expect(page.getByTestId('editor-tool-autoshape')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('autoshape')
    await expect(sidebar).toBeVisible()

    await page.getByTestId('editor-tool-freedraw').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('freedraw')

    await focusCanvas(page)
    await page.keyboard.press('Shift+X')
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('autoshape')
    await expect(page.getByTestId('editor-tool-autoshape')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(sidebar).toBeVisible()
  })

  test('snaps a freehand rectangle sketch into a rectangle element', async ({
    page,
  }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await page.getByTestId('editor-tool-autoshape').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('autoshape')

    const canvas = page.locator('.excalidraw .excalidraw__canvas.interactive')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()

    const originX = box!.x + box!.width * 0.35
    const originY = box!.y + box!.height * 0.35
    const width = Math.min(220, box!.width * 0.3)
    const height = Math.min(140, box!.height * 0.25)

    await page.mouse.move(originX, originY)
    await page.mouse.down()
    await page.mouse.move(originX + width, originY, { steps: 8 })
    await page.mouse.move(originX + width, originY + height, { steps: 8 })
    await page.mouse.move(originX, originY + height, { steps: 8 })
    await page.mouse.move(originX, originY, { steps: 8 })
    await page.mouse.up()

    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementTypes()), {
        timeout: 5000,
      })
      .toEqual(expect.arrayContaining(['rectangle']))

    const types = await page.evaluate(() => window.__slaideTest!.getElementTypes())
    expect(types.every((type) => type !== 'freedraw')).toBe(true)
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('autoshape')
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function focusCanvas(page: Page): Promise<void> {
  const canvas = page.locator('.excalidraw .excalidraw__canvas.interactive')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()
  // Avoid the top-left Excalidraw chrome overlay (hamburger / properties).
  await page.mouse.click(box!.x + box!.width * 0.55, box!.y + box!.height * 0.55)
}
