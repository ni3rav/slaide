import { useEffect, useRef } from 'react'
import {
  createPresenterSessionId,
  effectForPresenterMessage,
  parsePresenterSyncMessage,
  presenterChannelName,
  type PresenterRole,
  type PresenterSyncMessage,
} from './presenter-sync.ts'

type UsePresenterSyncOptions = {
  deckId: string | undefined
  role: PresenterRole
  enabled: boolean
  getIndex: () => number | null
  onIndex: (index: number) => void
  onGo: (index: number) => void
  onExit: () => void
}

export type PresenterSyncApi = {
  publishIndex: (index: number) => void
  publishGo: (index: number) => void
  publishExit: () => void
}

export function usePresenterSync(options: UsePresenterSyncOptions): PresenterSyncApi {
  const sessionIdRef = useRef(createPresenterSessionId())
  const publishRef = useRef<(message: PresenterSyncMessage) => void>(() => {})
  const getIndexRef = useRef(options.getIndex)
  const onIndexRef = useRef(options.onIndex)
  const onGoRef = useRef(options.onGo)
  const onExitRef = useRef(options.onExit)

  getIndexRef.current = options.getIndex
  onIndexRef.current = options.onIndex
  onGoRef.current = options.onGo
  onExitRef.current = options.onExit

  useEffect(() => {
    if (!options.enabled || !options.deckId) return

    const channel = new BroadcastChannel(presenterChannelName(options.deckId))
    const sessionId = sessionIdRef.current
    const role = options.role

    function post(message: PresenterSyncMessage) {
      channel.postMessage(message)
    }

    publishRef.current = post

    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = parsePresenterSyncMessage(event.data)
      if (!message) return

      const effect = effectForPresenterMessage(role, sessionId, message)
      if (effect.type === 'publish-index') {
        const index = getIndexRef.current()
        if (index == null) return
        post({ type: 'index', index, sessionId })
        return
      }
      if (effect.type === 'apply-index') {
        onIndexRef.current(effect.index)
        return
      }
      if (effect.type === 'apply-go') {
        onGoRef.current(effect.index)
        return
      }
      if (effect.type === 'exit') {
        onExitRef.current()
      }
    }

    post({ type: 'hello', role, sessionId })
    if (role === 'audience') {
      const index = getIndexRef.current()
      if (index != null) post({ type: 'index', index, sessionId })
    }

    return () => {
      publishRef.current = () => {}
      channel.close()
    }
  }, [options.deckId, options.enabled, options.role])

  return {
    publishIndex(index) {
      publishRef.current({ type: 'index', index, sessionId: sessionIdRef.current })
    },
    publishGo(index) {
      publishRef.current({ type: 'go', index, sessionId: sessionIdRef.current })
    },
    publishExit() {
      publishRef.current({ type: 'exit', sessionId: sessionIdRef.current })
    },
  }
}
