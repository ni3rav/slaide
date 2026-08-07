import type { Scene } from '../storage/deck-repository.ts'

export type SaveStatus = 'saved' | 'saving' | 'failed'

export type SceneAutosave = {
  schedule: (scene: Scene) => void
  flush: () => Promise<void>
  getStatus: () => SaveStatus
  dispose: () => void
}

type CreateSceneAutosaveOptions = {
  save: (scene: Scene) => Promise<void>
  debounceMs?: number
  onStatusChange?: (status: SaveStatus) => void
}

export function createSceneAutosave(
  options: CreateSceneAutosaveOptions,
): SceneAutosave {
  const debounceMs = options.debounceMs ?? 500
  const onStatusChange = options.onStatusChange

  let pending: Scene | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null
  let status: SaveStatus = 'saved'
  let inFlight: Promise<void> | null = null
  let generation = 0

  function setStatus(next: SaveStatus) {
    status = next
    onStatusChange?.(next)
  }

  async function commit(scene: Scene) {
    const currentGeneration = ++generation
    setStatus('saving')
    try {
      await options.save(scene)
      if (currentGeneration === generation) {
        setStatus('saved')
      }
    } catch {
      if (currentGeneration === generation) {
        setStatus('failed')
      }
      throw new Error('Scene save failed')
    }
  }

  function clearPendingTimer() {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  return {
    schedule(scene) {
      pending = scene
      clearPendingTimer()
      timerId = setTimeout(() => {
        timerId = null
        const toSave = pending
        pending = null
        if (toSave) {
          inFlight = commit(toSave).catch(() => undefined)
        }
      }, debounceMs)
    },

    async flush() {
      clearPendingTimer()
      const toSave = pending
      pending = null
      if (inFlight) {
        await inFlight.catch(() => undefined)
      }
      if (!toSave) return
      inFlight = commit(toSave)
      await inFlight
    },

    getStatus() {
      return status
    },

    dispose() {
      clearPendingTimer()
      pending = null
      generation += 1
    },
  }
}
