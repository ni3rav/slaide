import { describe, expect, it, vi } from 'vitest'
import { createSceneAutosave } from './scene-autosave.ts'
import type { Scene } from '../storage/deck-repository.ts'

const scene = (label: string): Scene => ({
  elements: [{ id: label, type: 'rectangle' }],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
})

describe('createSceneAutosave', () => {
  it('debounces normal saves to 500ms after the latest change', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async () => undefined)
    const autosave = createSceneAutosave({ save })

    autosave.schedule(scene('a'))
    autosave.schedule(scene('b'))
    await vi.advanceTimersByTimeAsync(499)
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(scene('b'))

    autosave.dispose()
    vi.useRealTimers()
  })

  it('force-saves immediately on flush and reports failed status', async () => {
    vi.useFakeTimers()
    const save = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('quota'))
    const statuses: string[] = []
    const autosave = createSceneAutosave({
      save,
      onStatusChange: (status) => statuses.push(status),
    })

    autosave.schedule(scene('draft'))
    await expect(autosave.flush()).rejects.toThrow('Scene save failed')
    expect(save).toHaveBeenCalledTimes(1)
    expect(autosave.getStatus()).toBe('failed')
    expect(statuses).toEqual(['saving', 'failed'])

    autosave.dispose()
    vi.useRealTimers()
  })
})
