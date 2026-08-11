import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      getActiveTool: () => string
      getElementTypes: () => string[]
      getElementCount: () => number
      getSelectedElementIds: () => string[]
      addRectangle: () => void
      getElementGeometry: () => Array<{
        id: string
        x: number
        y: number
        width: number
        height: number
      }>
      getCamera: () => { scrollX: number; scrollY: number; zoom: number }
      getViewport: () => { width: number; height: number }
    }
  }
}

test.describe('lasso select and bucket fill', () => {
  test('activates lasso and bucket fill from the sidebar without collapsing it', async ({
    page,
  }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    const sidebar = page.getByRole('complementary', { name: 'Slides' })
    await expect(sidebar).toBeVisible()
    await expect(page.getByTestId('editor-tool-lasso')).toBeVisible()
    await expect(page.getByTestId('editor-tool-bucketfill')).toBeVisible()

    await page.getByTestId('editor-tool-lasso').click()
    await expect(page.getByTestId('editor-tool-lasso')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('lasso')
    await expect(sidebar).toBeVisible()

    await page.getByTestId('editor-tool-bucketfill').click()
    await expect(page.getByTestId('editor-tool-bucketfill')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('bucketfill')
    await expect(sidebar).toBeVisible()

    await page.getByTestId('editor-tool-selection').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('selection')

    await focusCanvas(page)
    await page.keyboard.press('b')
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('bucketfill')
    await expect(page.getByTestId('editor-tool-bucketfill')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(sidebar).toBeVisible()
  })

  test('lasso selects elements crossed by the freehand path', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementCount()))
      .toBeGreaterThan(0)

    await page.getByTestId('editor-tool-lasso').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('lasso')

    const screen = await sceneRectToScreen(page)
    // Loop around the rectangle so the lasso both intersects and encloses it.
    const pad = 24
    const path = [
      { x: screen.left - pad, y: screen.top - pad },
      { x: screen.right + pad, y: screen.top - pad },
      { x: screen.right + pad, y: screen.bottom + pad },
      { x: screen.left - pad, y: screen.bottom + pad },
      { x: screen.left - pad, y: screen.top - pad },
    ]

    await page.mouse.move(path[0]!.x, path[0]!.y)
    await page.mouse.down()
    for (const point of path.slice(1)) {
      await page.mouse.move(point.x, point.y, { steps: 6 })
    }
    await page.mouse.up()

    await expect
      .poll(async () =>
        page.evaluate(() => window.__slaideTest!.getSelectedElementIds().length),
      )
      .toBeGreaterThan(0)
  })

  test('bucket fill paints a closed region as a fill polygon', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await page.evaluate(() => window.__slaideTest!.addRectangle())
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementCount()))
      .toBe(1)

    await page.getByTestId('editor-tool-bucketfill').click()
    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getActiveTool()))
      .toBe('bucketfill')

    const screen = await sceneRectToScreen(page)
    await page.mouse.click((screen.left + screen.right) / 2, (screen.top + screen.bottom) / 2)

    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementTypes()), {
        timeout: 5000,
      })
      .toEqual(expect.arrayContaining(['rectangle', 'line']))

    await expect
      .poll(async () => page.evaluate(() => window.__slaideTest!.getElementCount()))
      .toBeGreaterThan(1)
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

async function sceneRectToScreen(page: Page): Promise<{
  left: number
  top: number
  right: number
  bottom: number
}> {
  const canvas = page.locator('.excalidraw .excalidraw__canvas.interactive')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box).toBeTruthy()

  return page.evaluate((canvasBox) => {
    const api = window.__slaideTest!
    const [rect] = api.getElementGeometry()
    if (!rect) throw new Error('rectangle missing')
    const { scrollX, scrollY, zoom } = api.getCamera()
    const { width, height } = api.getViewport()
    // Excalidraw canvas may be larger than the CSS box; map via viewport size.
    const scaleX = canvasBox.width / width
    const scaleY = canvasBox.height / height
    const toScreen = (sceneX: number, sceneY: number) => ({
      x: canvasBox.x + (sceneX + scrollX) * zoom * scaleX,
      y: canvasBox.y + (sceneY + scrollY) * zoom * scaleY,
    })
    const topLeft = toScreen(rect.x, rect.y)
    const bottomRight = toScreen(rect.x + rect.width, rect.y + rect.height)
    return {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
    }
  }, { x: box!.x, y: box!.y, width: box!.width, height: box!.height })
}
