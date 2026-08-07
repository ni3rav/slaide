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

  it('reuses the in-flight promise for concurrent loads', async () => {
    let resolveRender: (blob: Blob) => void = () => undefined
    const render = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveRender = resolve
        }),
    )
    const controller = createSlidePreviewController(render)

    const first = controller.load(scene)
    const second = controller.load(scene)
    expect(render).toHaveBeenCalledTimes(1)

    resolveRender(new Blob(['png'], { type: 'image/png' }))
    await expect(first).resolves.toMatch(/^blob:/)
    await expect(second).resolves.toMatch(/^blob:/)
  })

  it('revokes the active object URL and clears state', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL')
    const controller = createSlidePreviewController(async () => new Blob(['png'], { type: 'image/png' }))
    const url = await controller.load(scene)

    controller.revoke()

    expect(revokeSpy).toHaveBeenCalledWith(url)
    expect(controller.getActiveUrlCount()).toBe(0)
  })

  it('allows a fresh load after revoke', async () => {
    const render = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))
    const controller = createSlidePreviewController(render)

    const first = await controller.load(scene)
    controller.revoke()
    const second = await controller.load(scene)

    expect(render).toHaveBeenCalledTimes(2)
    expect(second).not.toBe(first)
    expect(controller.getActiveUrlCount()).toBe(1)
  })
})
