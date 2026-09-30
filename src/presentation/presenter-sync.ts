export type PresenterRole = 'audience' | 'presenter'

export type PresenterSyncMessage =
  | { type: 'hello'; role: PresenterRole; sessionId: string }
  | { type: 'index'; index: number; sessionId: string }
  | { type: 'go'; index: number; sessionId: string }
  | { type: 'exit'; sessionId: string }

export type PresenterSyncEffect =
  | { type: 'publish-index' }
  | { type: 'apply-index'; index: number }
  | { type: 'apply-go'; index: number }
  | { type: 'exit' }
  | { type: 'ignore' }

export function presenterChannelName(deckId: string): string {
  return `slaide-presenter:${deckId}`
}

export function createPresenterSessionId(): string {
  return crypto.randomUUID()
}

export function parsePresenterSyncMessage(value: unknown): PresenterSyncMessage | null {
  if (!value || typeof value !== 'object') return null
  const message = value as Partial<PresenterSyncMessage>
  if (typeof message.sessionId !== 'string' || message.sessionId.length === 0) return null

  if (message.type === 'hello') {
    if (message.role !== 'audience' && message.role !== 'presenter') return null
    return { type: 'hello', role: message.role, sessionId: message.sessionId }
  }

  if (message.type === 'index' || message.type === 'go') {
    if (!isSlideIndex(message.index)) return null
    return { type: message.type, index: message.index, sessionId: message.sessionId }
  }

  if (message.type === 'exit') {
    return { type: 'exit', sessionId: message.sessionId }
  }

  return null
}

export function effectForPresenterMessage(
  role: PresenterRole,
  sessionId: string,
  message: PresenterSyncMessage,
): PresenterSyncEffect {
  if (message.sessionId === sessionId) return { type: 'ignore' }

  if (message.type === 'exit') return { type: 'exit' }

  if (role === 'audience') {
    if (message.type === 'hello' && message.role === 'presenter') {
      return { type: 'publish-index' }
    }
    if (message.type === 'go') return { type: 'apply-go', index: message.index }
    return { type: 'ignore' }
  }

  if (message.type === 'index') return { type: 'apply-index', index: message.index }
  return { type: 'ignore' }
}

function isSlideIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
