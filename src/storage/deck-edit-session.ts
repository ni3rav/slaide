import {
  acquireDeckEditLock,
  waitForDeckEditLock,
  type DeckEditLock,
} from './deck-lock.ts'

type ActiveDeckLock = {
  deckId: string
  sessionId: number
  release: () => void
}

let nextSessionId = 0
let activeDeckLock: ActiveDeckLock | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let openChain: Promise<unknown> = Promise.resolve()

export type DeckEditSession = DeckEditLock & {
  sessionId: number
}

export function openDeckEditSession(deckId: string): Promise<DeckEditSession> {
  const run = openChain.then(() => openDeckEditSessionInner(deckId))
  openChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function openDeckEditSessionInner(deckId: string): Promise<DeckEditSession> {
  const sessionId = ++nextSessionId

  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }

  if (activeDeckLock?.deckId === deckId) {
    activeDeckLock.sessionId = sessionId
    return {
      mode: 'editable',
      sessionId,
      release: () => scheduleCloseDeckEditSession(sessionId),
    }
  }

  if (activeDeckLock) {
    activeDeckLock.release()
    activeDeckLock = null
  }

  const lock = await acquireDeckEditLock(deckId)
  if (lock.mode === 'readonly') {
    return { mode: 'readonly', sessionId }
  }

  if (sessionId !== nextSessionId) {
    lock.release()
    return { mode: 'readonly', sessionId }
  }

  activeDeckLock = { deckId, sessionId, release: lock.release }
  return {
    mode: 'editable',
    sessionId,
    release: () => scheduleCloseDeckEditSession(sessionId),
  }
}

export function scheduleCloseDeckEditSession(sessionId: number): void {
  if (activeDeckLock?.sessionId !== sessionId) return
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    closeTimer = null
    if (activeDeckLock?.sessionId !== sessionId) return
    activeDeckLock.release()
    activeDeckLock = null
  }, 0)
}

export function closeDeckEditSessionNow(sessionId: number): void {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  if (activeDeckLock?.sessionId !== sessionId) return
  activeDeckLock.release()
  activeDeckLock = null
}

export { waitForDeckEditLock }
