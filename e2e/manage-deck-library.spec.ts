import { expect, test, type Page } from '@playwright/test'

test.describe('manage the deck library', () => {
  test('shows title, slide count, and last-modified time without thumbnails', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New deck' }).click()
    await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL('/')

    const deckItem = page.getByRole('listitem').filter({ hasText: 'Untitled deck' })
    await expect(deckItem.getByText('1 slide')).toBeVisible()
    await expect(deckItem.locator('time')).toBeVisible()
    await expect(deckItem.locator('img')).toHaveCount(0)
  })

  test('orders decks by most recently modified after rename', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)
    await createDeckFromHome(page)

    const untitled = page.getByRole('listitem').filter({ hasText: 'Untitled deck' })
    await expect(untitled).toHaveCount(2)

    await renameDeck(page, untitled.nth(1), 'Older deck')
    await renameDeck(
      page,
      page.getByRole('listitem').filter({ hasText: 'Untitled deck' }),
      'Newer deck',
    )

    await expect(page.getByRole('listitem').nth(0)).toContainText('Newer deck')
    await expect(page.getByRole('listitem').nth(1)).toContainText('Older deck')
  })

  test('renames a deck and accepts duplicate titles', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)
    await createDeckFromHome(page)

    const items = page.getByRole('listitem')
    await renameDeck(page, items.nth(0), 'Shared title')
    await renameDeck(page, items.nth(1), 'Shared title')

    await expect(page.getByRole('link', { name: 'Shared title' })).toHaveCount(2)
  })

  test('cancels deletion and leaves the deck unchanged', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)

    await page.getByRole('button', { name: 'Delete Untitled deck' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Untitled deck')
    await expect(dialog).toContainText('1 slide')
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await expect(dialog).toBeHidden()
    await expect(page.getByRole('link', { name: 'Untitled deck' })).toBeVisible()
  })

  test('confirms deletion and removes the deck from the home screen', async ({ page }) => {
    await page.goto('/')
    await createDeckFromHome(page)

    await page.getByRole('button', { name: 'Delete Untitled deck' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Delete “Untitled deck”')
    await expect(dialog).toContainText('1 slide')
    await dialog.getByRole('button', { name: 'Delete deck' }).click()

    await expect(page.getByText('No decks yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Untitled deck' })).toHaveCount(0)
  })
})

async function createDeckFromHome(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New deck' }).click()
  await expect(page).toHaveURL(/\/decks\/[0-9a-f-]{36}$/i)
  await page.getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL('/')
}

async function renameDeck(
  page: Page,
  deckItem: ReturnType<Page['getByRole']>,
  title: string,
): Promise<void> {
  await deckItem.getByRole('button', { name: /Rename/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Deck title').fill(title)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}
