export type DeckEditLock =
  | {
      mode: 'editable'
      release: () => void
    }
  | {
      mode: 'readonly'
    }

export function deckLockName(deckId: string): string {
  return `slaide-deck-${deckId}`
}

export async function acquireDeckEditLock(deckId: string): Promise<DeckEditLock> {
  return new Promise((resolve) => {
    void navigator.locks.request(
      deckLockName(deckId),
      { mode: 'exclusive', ifAvailable: true },
      (lock) => {
        if (!lock) {
          resolve({ mode: 'readonly' })
          return Promise.resolve()
        }

        return new Promise<void>((releaseLock) => {
          resolve({
            mode: 'editable',
            release: () => releaseLock(),
          })
        })
      },
    )
  })
}

export function waitForDeckEditLock(deckId: string): Promise<() => void> {
  return new Promise((resolve) => {
    void navigator.locks.request(deckLockName(deckId), { mode: 'exclusive' }, () => {
      return new Promise<void>((releaseLock) => {
        resolve(() => releaseLock())
      })
    })
  })
}
