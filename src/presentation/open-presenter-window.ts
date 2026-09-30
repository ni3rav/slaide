export const PRESENTER_BLOCKED_STORAGE_KEY = 'slaide-presenter-blocked'

export function openPresenterWindow(deckId: string): Window | null {
  return window.open('about:blank', `slaide-presenter-${deckId}`, 'popup,width=1280,height=800')
}

export function presenterWindowUrl(deckId: string, startIndex: number): string {
  return `/decks/${deckId}/present/notes?start=${startIndex}`
}

export function navigatePresenterWindow(
  presenter: Window,
  deckId: string,
  startIndex: number,
): void {
  presenter.location.replace(presenterWindowUrl(deckId, startIndex))
}

export function markPresenterWindowBlocked(): void {
  try {
    sessionStorage.setItem(PRESENTER_BLOCKED_STORAGE_KEY, '1')
  } catch {
    // Presentation still continues in this window.
  }
}

export function consumePresenterWindowBlocked(): boolean {
  try {
    const blocked = sessionStorage.getItem(PRESENTER_BLOCKED_STORAGE_KEY) === '1'
    if (blocked) sessionStorage.removeItem(PRESENTER_BLOCKED_STORAGE_KEY)
    return blocked
  } catch {
    return false
  }
}
