import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireDeckEditLock,
  deckLockName,
  waitForDeckEditLock,
} from './deck-lock.ts'

type QueuedRequest = {
  name: string
  ifAvailable: boolean
  callback: (lock: Lock | null) => Promise<void> | void
}

function createMockLockManager() {
  const held = new Set<string>()
  const queue: QueuedRequest[] = []

  function run(name: string, ifAvailable: boolean, callback: QueuedRequest['callback']) {
    if (ifAvailable && held.has(name)) {
      void callback(null)
      return
    }

    if (!ifAvailable && held.has(name)) {
      queue.push({ name, ifAvailable, callback })
      return
    }

    held.add(name)
    void Promise.resolve(callback({ name } as Lock)).finally(() => {
      held.delete(name)
      const nextIndex = queue.findIndex((request) => request.name === name)
      if (nextIndex === -1) return
      const [next] = queue.splice(nextIndex, 1)
      run(next.name, next.ifAvailable, next.callback)
    })
  }

  return {
    request(
      name: string,
      options: LockOptions,
      callback: (lock: Lock | null) => Promise<void> | void,
    ) {
      run(name, options.ifAvailable === true, callback)
      return Promise.resolve()
    },
  }
}

describe('deckLockName', () => {
  it('scopes locks to a deck id', () => {
    expect(deckLockName('deck-a')).toBe('slaide-deck-deck-a')
    expect(deckLockName('deck-b')).not.toBe(deckLockName('deck-a'))
  })
})

describe('acquireDeckEditLock', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { locks: createMockLockManager() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('acquires an exclusive editable lock for one context', async () => {
    const lock = await acquireDeckEditLock('deck-1')

    expect(lock.mode).toBe('editable')
    if (lock.mode !== 'editable') return

    lock.release()
  })

  it('returns read-only when another context already holds the deck lock', async () => {
    const first = await acquireDeckEditLock('deck-1')
    expect(first.mode).toBe('editable')

    const second = await acquireDeckEditLock('deck-1')
    expect(second).toEqual({ mode: 'readonly' })
    if (first.mode === 'editable') first.release()
  })

  it('allows different decks to be locked independently', async () => {
    const first = await acquireDeckEditLock('deck-1')
    const second = await acquireDeckEditLock('deck-2')

    expect(first.mode).toBe('editable')
    expect(second.mode).toBe('editable')

    if (first.mode === 'editable') first.release()
    if (second.mode === 'editable') second.release()
  })

  it('releases the lock so another context can edit', async () => {
    const first = await acquireDeckEditLock('deck-1')
    if (first.mode !== 'editable') throw new Error('expected editable lock')

    first.release()
    await Promise.resolve()

    const next = await acquireDeckEditLock('deck-1')
    expect(next.mode).toBe('editable')
    if (next.mode === 'editable') next.release()
  })
})

describe('waitForDeckEditLock', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { locks: createMockLockManager() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('waits until the active lock is released', async () => {
    const first = await acquireDeckEditLock('deck-1')
    if (first.mode !== 'editable') throw new Error('expected editable lock')

    const waiting = waitForDeckEditLock('deck-1')
    let resolved = false
    void waiting.then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    first.release()

    const release = await waiting
    expect(resolved).toBe(true)
    release()
  })
})
