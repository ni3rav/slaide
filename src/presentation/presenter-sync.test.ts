import { describe, expect, it } from 'vitest'
import {
  effectForPresenterMessage,
  parsePresenterSyncMessage,
  presenterChannelName,
} from './presenter-sync.ts'

describe('presenter sync messages', () => {
  it('names the channel from the deck id', () => {
    expect(presenterChannelName('deck-1')).toBe('slaide-presenter:deck-1')
  })

  it('parses hello, index, go, and exit messages', () => {
    expect(parsePresenterSyncMessage({ type: 'hello', role: 'presenter', sessionId: 'a' })).toEqual({
      type: 'hello',
      role: 'presenter',
      sessionId: 'a',
    })
    expect(parsePresenterSyncMessage({ type: 'index', index: 2, sessionId: 'a' })).toEqual({
      type: 'index',
      index: 2,
      sessionId: 'a',
    })
    expect(parsePresenterSyncMessage({ type: 'go', index: 0, sessionId: 'a' })).toEqual({
      type: 'go',
      index: 0,
      sessionId: 'a',
    })
    expect(parsePresenterSyncMessage({ type: 'exit', sessionId: 'a' })).toEqual({
      type: 'exit',
      sessionId: 'a',
    })
  })

  it('rejects malformed messages', () => {
    expect(parsePresenterSyncMessage(null)).toBeNull()
    expect(parsePresenterSyncMessage({ type: 'index', index: -1, sessionId: 'a' })).toBeNull()
    expect(parsePresenterSyncMessage({ type: 'index', index: 1.5, sessionId: 'a' })).toBeNull()
    expect(parsePresenterSyncMessage({ type: 'hello', role: 'notes', sessionId: 'a' })).toBeNull()
    expect(parsePresenterSyncMessage({ type: 'exit', sessionId: '' })).toBeNull()
    expect(parsePresenterSyncMessage({ type: 'nope', sessionId: 'a' })).toBeNull()
  })

  it('lets the audience window own the slide index', () => {
    expect(
      effectForPresenterMessage('audience', 'audience-1', {
        type: 'hello',
        role: 'presenter',
        sessionId: 'presenter-1',
      }),
    ).toEqual({ type: 'publish-index' })

    expect(
      effectForPresenterMessage('audience', 'audience-1', {
        type: 'go',
        index: 3,
        sessionId: 'presenter-1',
      }),
    ).toEqual({ type: 'apply-go', index: 3 })

    expect(
      effectForPresenterMessage('audience', 'audience-1', {
        type: 'index',
        index: 3,
        sessionId: 'presenter-1',
      }),
    ).toEqual({ type: 'ignore' })

    expect(
      effectForPresenterMessage('presenter', 'presenter-1', {
        type: 'index',
        index: 4,
        sessionId: 'audience-1',
      }),
    ).toEqual({ type: 'apply-index', index: 4 })

    expect(
      effectForPresenterMessage('presenter', 'presenter-1', {
        type: 'go',
        index: 1,
        sessionId: 'presenter-2',
      }),
    ).toEqual({ type: 'ignore' })
  })

  it('ignores a window own messages and exits when the other window exits', () => {
    expect(
      effectForPresenterMessage('audience', 'audience-1', {
        type: 'go',
        index: 1,
        sessionId: 'audience-1',
      }),
    ).toEqual({ type: 'ignore' })

    expect(
      effectForPresenterMessage('presenter', 'presenter-1', {
        type: 'exit',
        sessionId: 'audience-1',
      }),
    ).toEqual({ type: 'exit' })
  })
})
