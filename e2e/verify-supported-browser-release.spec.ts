import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * Ticket 17 — release verification for supported desktop Chromium and Firefox.
 * Feature workflows live in their own specs; this file covers cross-cutting
 * accessibility, privacy, contrast, and recovery-surface checks.
 */
test.describe('verify supported-browser release behavior', () => {
  test('home and editor chrome are keyboard-operable with visible focus and accessible names', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Import deck' }).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Shift+Tab')
    const theme = page
      .getByRole('button', { name: 'Switch to dark theme' })
      .or(page.getByRole('button', { name: 'Switch to light theme' }))
    await expect(theme).toBeFocused()
    await expectVisibleFocus(page)

    await page.getByRole('button', { name: 'Import deck' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'New deck' })).toBeFocused()
    await expectVisibleFocus(page)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)

    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export deck' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Present' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add slide' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Select slide 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Preview slide 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reorder slide 1' })).toBeVisible()

    await page.getByRole('button', { name: 'Add slide' }).press('Enter')
    await expect(page.getByRole('listitem')).toHaveCount(2)
    await expect(page.getByText('Slide 2 of 2')).toBeVisible()
  })

  test('dialogs trap focus while open and restore it when closed', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New deck' }).click()
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/')

    const rename = page.getByRole('button', { name: 'Rename Untitled deck' })
    await rename.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('Deck title')).toBeFocused()

    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab')
      const stillInDialog = await page.evaluate(() => {
        const dialogEl = document.querySelector('[role="dialog"]')
        return Boolean(dialogEl && dialogEl.contains(document.activeElement))
      })
      expect(stillInDialog).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(rename).toBeFocused()
  })

  test('application text and primary controls meet the WCAG AA contrast baseline', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByText('Your local decks')).toBeVisible()

    const pairs = await page.evaluate(() => {
      function cssColorToRgb(color: string): { r: number; g: number; b: number } | null {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.fillStyle = '#000000'
        ctx.fillStyle = color
        if (ctx.fillStyle === '#000000' && color !== '#000000' && color !== 'rgb(0, 0, 0)') {
          // Unsupported color string fell back to the probe value.
          if (!/^black|#000|rgb\(\s*0/i.test(color)) return null
        }
        ctx.fillRect(0, 0, 1, 1)
        const data = ctx.getImageData(0, 0, 1, 1).data
        return { r: data[0]!, g: data[1]!, b: data[2]! }
      }

      function channel(c: number): number {
        const v = c / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }

      function luminance(rgb: { r: number; g: number; b: number }): number {
        return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b)
      }

      function ratio(
        fg: { r: number; g: number; b: number },
        bg: { r: number; g: number; b: number },
      ): number {
        const lighter = Math.max(luminance(fg), luminance(bg))
        const darker = Math.min(luminance(fg), luminance(bg))
        return (lighter + 0.05) / (darker + 0.05)
      }

      function opaqueBackground(start: Element): string | null {
        let current: Element | null = start
        while (current) {
          const value = getComputedStyle(current).backgroundColor
          if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') {
            return value
          }
          current = current.parentElement
        }
        return getComputedStyle(document.body).backgroundColor
      }

      const newDeck = Array.from(document.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('New deck'),
      )
      const blurb = Array.from(document.querySelectorAll('p')).find((p) =>
        p.textContent?.includes('Your local decks'),
      )
      const samples = [
        { label: 'blurb', element: blurb },
        { label: 'new-deck', element: newDeck },
      ]

      return samples
        .filter((sample): sample is { label: string; element: Element } => Boolean(sample.element))
        .map((sample) => {
          const fg = cssColorToRgb(getComputedStyle(sample.element).color)
          const bgCss = opaqueBackground(sample.element)
          const bg = bgCss ? cssColorToRgb(bgCss) : null
          if (!fg || !bg) {
            return {
              label: sample.label,
              ratio: 0,
              ok: false,
              fg: getComputedStyle(sample.element).color,
              bg: bgCss,
            }
          }
          const value = ratio(fg, bg)
          return { label: sample.label, ratio: value, ok: value >= 4.5, fg: null, bg: null }
        })
    })

    expect(pairs.length).toBe(2)
    for (const pair of pairs) {
      expect(pair.ok, `${pair.label} contrast ${pair.ratio} (${pair.fg} on ${pair.bg})`).toBe(
        true,
      )
    }
  })

  test('runtime network traffic stays on the application origin', async ({ page }) => {
    const external: string[] = []
    const onRequest = (request: Request) => {
      const url = new URL(request.url())
      if (url.origin !== 'http://127.0.0.1:4174') {
        external.push(request.url())
      }
    }
    page.on('request', onRequest)

    await page.goto('/')
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    await page.waitForLoadState('networkidle')

    page.off('request', onRequest)
    expect(external, `unexpected external requests: ${external.join(', ')}`).toEqual([])
  })

  test('load and import failures expose recovery actions without discarding home', async ({
    page,
  }) => {
    await page.goto(`/decks/${crypto.randomUUID()}`)
    await expect(page.getByRole('heading', { name: 'Deck unavailable' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Return home' })).toBeVisible()
    await page.getByRole('link', { name: 'Return home' }).click()
    await expect(page).toHaveURL('/')

    await page.getByRole('button', { name: 'Import deck' }).click()
    const fileInput = page.getByTestId('import-slaide-input')
    await fileInput.setInputFiles({
      name: 'broken.slaide',
      mimeType: 'application/json',
      buffer: Buffer.from('{not-json', 'utf8'),
    })
    await expect(page.getByTestId('import-error')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New deck' })).toBeVisible()
  })
})

async function expectVisibleFocus(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const active = document.activeElement
        if (!(active instanceof HTMLElement) || active === document.body) return false
        const styles = getComputedStyle(active)
        const outlineVisible =
          styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px'
        const ringVisible = styles.boxShadow !== 'none' && styles.boxShadow !== ''
        return outlineVisible || ringVisible || active.matches(':focus-visible')
      }),
    )
    .toBe(true)
}
