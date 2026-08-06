import { expect, test } from '@playwright/test'

test.describe('create and reopen a local deck', () => {
  test('creates a deck from home and reopens it after reload', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Slaide' })).toBeVisible()
    await expect(page.getByText('No decks yet')).toBeVisible()

    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    await expect(page.getByRole('heading', { name: 'Untitled deck' })).toBeVisible()

    const editorUrl = page.url()
    await page.reload()

    await expect(page).toHaveURL(editorUrl)
    await expect(page.getByRole('heading', { name: 'Untitled deck' })).toBeVisible()

    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Untitled deck' })).toBeVisible()
    await page.getByRole('link', { name: 'Untitled deck' }).click()
    await expect(page).toHaveURL(editorUrl)
  })

  test('shows a recoverable error for a missing deck without creating a replacement', async ({
    page,
  }) => {
    await page.goto(`/decks/${crypto.randomUUID()}`)

    await expect(page.getByRole('heading', { name: 'Deck unavailable' })).toBeVisible()
    await expect(page.getByText(/could not be opened/i)).toBeVisible()

    await page.getByRole('link', { name: 'Return home' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('No decks yet')).toBeVisible()
  })

  test('shows a recoverable error for a corrupt deck without creating a replacement', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    const editorUrl = page.url()
    const deckId = editorUrl.split('/').at(-1)!

    await page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('slaide', 1)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('open failed'))
      })
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('decks', 'readwrite')
        const store = tx.objectStore('decks')
        const getRequest = store.get(id)
        getRequest.onsuccess = () => {
          const deck = getRequest.result as { slideOrder: string[] }
          deck.slideOrder = [crypto.randomUUID()]
          store.put(deck)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('patch failed'))
      })
      db.close()
    }, deckId)

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Deck unavailable' })).toBeVisible()
    await page.getByRole('link', { name: 'Return home' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Untitled deck' })).toBeVisible()
  })
})
