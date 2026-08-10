import { expect, test, type Page } from '@playwright/test'

declare global {
  interface Window {
    __slaideTest?: {
      updateLibraryItems: (items: unknown[]) => Promise<void>
    }
  }
}

test.describe('excalidraw library', () => {
  test('opens the library panel from the left toolbar on the right side', async ({
    page,
  }) => {
    await openEditor(page)

    await expect(page.getByTestId('editor-tool-library')).toBeVisible()
    await expect(page.locator('.default-sidebar-trigger')).toBeHidden()

    await page.getByTestId('editor-tool-library').click()
    await expect(page.getByTestId('editor-tool-library')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const sidebar = page.locator('.excalidraw .sidebar')
    await expect(sidebar).toBeVisible()

    const hostBox = await page.getByTestId('excalidraw-host').boundingBox()
    const sidebarBox = await sidebar.boundingBox()
    expect(hostBox).toBeTruthy()
    expect(sidebarBox).toBeTruthy()
    expect(sidebarBox!.x).toBeGreaterThan(hostBox!.x + hostBox!.width / 2)

    await page.getByTestId('editor-tool-library').click()
    await expect(page.getByTestId('editor-tool-library')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('persists library items in IndexedDB across reload', async ({ page }) => {
    await openEditor(page)
    await page.waitForFunction(() => window.__slaideTest != null)

    await page.evaluate(async () => {
      await window.__slaideTest!.updateLibraryItems([
        {
          id: 'lib-item-1',
          status: 'unpublished',
          created: Date.now(),
          elements: [
            {
              type: 'rectangle',
              version: 1,
              versionNonce: 1,
              isDeleted: false,
              id: 'lib-el-1',
              fillStyle: 'solid',
              strokeWidth: 1,
              strokeStyle: 'solid',
              roughness: 1,
              opacity: 100,
              angle: 0,
              x: 10,
              y: 10,
              strokeColor: '#1e1e1e',
              backgroundColor: 'transparent',
              width: 120,
              height: 80,
              seed: 1,
              groupIds: [],
              frameId: null,
              roundness: null,
              boundElements: [],
              updated: 1,
              link: null,
              locked: false,
            },
          ],
        },
      ])
    })

    await expect
      .poll(async () => readStoredLibraryCount(page), { timeout: 5000 })
      .toBe(1)

    await page.reload()
    await expect(page.getByTestId('excalidraw-host')).toBeVisible()
    await page.waitForFunction(() => window.__slaideTest != null)

    expect(await readStoredLibraryCount(page)).toBe(1)

    await page.getByTestId('editor-tool-library').click()
    await expect(page.locator('.excalidraw .sidebar')).toBeVisible()
  })
})

async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await expect(page.getByTestId('excalidraw-host')).toBeVisible()
}

async function readStoredLibraryCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('slaide', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('open failed'))
    })
    const record = await new Promise<{ value?: unknown[] } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction('settings', 'readonly')
        const request = tx.objectStore('settings').get('libraryItems')
        request.onsuccess = () =>
          resolve(request.result as { value?: unknown[] } | undefined)
        request.onerror = () =>
          reject(request.error ?? new Error('library read failed'))
      },
    )
    db.close()
    return Array.isArray(record?.value) ? record.value.length : 0
  })
}
