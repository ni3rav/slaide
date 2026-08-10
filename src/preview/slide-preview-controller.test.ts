import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSlidePreviewController } from './slide-preview-controller.ts'
import type { Scene } from '../storage/deck-repository.ts'

const scene: Scene = {
  elements: [],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createSlidePreviewController', () => {
  it('creates an object URL from the rendered blob', async () => {
    const blob = new Blob(['png'], { type: 'image/png' })
    const render = vi.fn(async () => blob)
    const controller = createSlidePreviewController(render)

    const url = await controller.load(scene)

    expect(render).toHaveBeenCalledWith(scene)
    expect(url).toMatch(/^blob:/)
    expect(controller.getActiveUrlCount()).toBe(1)
  })

  it('supersedes an in-flight render when a fresh preview is requested', async () => {
    const renderResolvers: Array<(blob: Blob) => void> = []
    const render = vi.fn(() => new Promise<Blob>((resolve) => renderResolvers.push(resolve)))
    const controller = createSlidePreviewController(render)

    const first = controller.load(scene)
    const second = controller.load(scene)
    expect(render).toHaveBeenCalledTimes(2)

    renderResolvers[0]!(new Blob(['old'], { type: 'image/png' }))
    await expect(first).rejects.toThrow(/superseded/i)
    expect(controller.getActiveUrlCount()).toBe(0)

    renderResolvers[1]!(new Blob(['new'], { type: 'image/png' }))
    await expect(second).resolves.toMatch(/^blob:/)
    expect(controller.getActiveUrlCount()).toBe(1)
  })

  it('revokes the active object URL and clears state', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const controller = createSlidePreviewController(async () => new Blob(['png'], { type: 'image/png' }))
    const url = await controller.load(scene)

    controller.revoke()

    expect(revokeSpy).toHaveBeenCalledWith(url)
    expect(controller.getActiveUrlCount()).toBe(0)
  })

  it('replaces the active preview for every new load', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const render = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))
    const controller = createSlidePreviewController(render)

    const first = await controller.load(scene)
    const second = await controller.load(scene)

    expect(render).toHaveBeenCalledTimes(2)
    expect(revokeSpy).toHaveBeenCalledWith(first)
    expect(second).not.toBe(first)
    expect(controller.getActiveUrlCount()).toBe(1)
  })
})
