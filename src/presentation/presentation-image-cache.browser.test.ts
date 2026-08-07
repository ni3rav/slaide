import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Scene, Slide, SlideId } from '../storage/deck-repository.ts'
import { createPresentationImageCache } from './presentation-image-cache.ts'

function createScene(label: string): Scene {
  return {
    elements: [],
    appState: { viewBackgroundColor: label },
    files: {},
  }
}

function createSlides(count: number): Slide[] {
  const now = 1
  return Array.from({ length: count }, (_, index) => ({
    id: `slide-${index}` as SlideId,
    schemaVersion: 1,
    deckId: 'deck-1' as never,
    scene: createScene(`scene-${index}`),
    createdAt: now,
    updatedAt: now,
  }))
}

describe('presentation image cache', () => {
  afterEach(() => {
    if (typeof window !== 'undefined') {
      delete window.__slaidePresentationFailSlideIds
      delete window.__slaidePresentationRenderDelayMs
    }
  })

  it('retains at most five images for the centered window', async () => {
    const render = vi.fn(async (scene: Scene) => new Blob([JSON.stringify(scene.appState)]))
    const cache = createPresentationImageCache(render)
    const slides = createSlides(10)

    cache.ensureWindow(slides, 5)
    await Promise.all(
      slides
        .slice(3, 8)
        .map((slide) => cache.getObjectUrl(slide.id, slide.scene)),
    )

    expect(cache.getActiveUrlCount()).toBe(5)
    expect(render).toHaveBeenCalledTimes(5)
  })

  it('evicts images outside the window and revokes their object URLs', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
    const render = vi.fn(async () => new Blob(['png']))
    const cache = createPresentationImageCache(render)
    const slides = createSlides(8)

    cache.ensureWindow(slides, 2)
    await Promise.all(
      slides
        .slice(0, 5)
        .map((slide) => cache.getObjectUrl(slide.id, slide.scene)),
    )
    expect(cache.getActiveUrlCount()).toBe(5)

    cache.ensureWindow(slides, 6)
    await Promise.all(
      slides
        .slice(4, 8)
        .map((slide) => cache.getObjectUrl(slide.id, slide.scene)),
    )

    expect(cache.getActiveUrlCount()).toBe(4)
    expect(revokeObjectURL).toHaveBeenCalled()
    revokeObjectURL.mockRestore()
  })

  it('revokes every retained URL on exit', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
    const cache = createPresentationImageCache(async () => new Blob(['png']))
    const slides = createSlides(3)

    cache.ensureWindow(slides, 1)
    await cache.getObjectUrl(slides[1]!.id, slides[1]!.scene)

    cache.revokeAll()

    expect(cache.getActiveUrlCount()).toBe(0)
    expect(revokeObjectURL).toHaveBeenCalled()
    revokeObjectURL.mockRestore()
  })

  it('rejects configured slide ids during render', async () => {
    const render = vi.fn(async () => new Blob(['png']))
    const cache = createPresentationImageCache(render)
    const slides = createSlides(2)

    if (typeof window !== 'undefined') {
      window.__slaidePresentationFailSlideIds = [slides[1]!.id]
    }

    cache.ensureWindow(slides, 1)
    await expect(cache.getObjectUrl(slides[1]!.id, slides[1]!.scene)).rejects.toThrow(
      'Presentation image render failed',
    )
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('drops late renders that finish outside the retained window', async () => {
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL')
    let releaseSlowRender: (() => void) | undefined
    const render = vi.fn((scene: Scene) => {
      if (scene.appState.viewBackgroundColor !== 'scene-0') {
        return Promise.resolve(new Blob(['fast']))
      }
      return new Promise<Blob>((resolve) => {
        releaseSlowRender = () => resolve(new Blob(['slow']))
      })
    })
    const cache = createPresentationImageCache(render)
    const slides = createSlides(4)

    cache.ensureWindow(slides, 0)
    const pendingUrl = cache.getObjectUrl(slides[0]!.id, slides[0]!.scene)

    cache.ensureWindow(slides, 3)
    releaseSlowRender!()
    await pendingUrl

    expect(cache.getActiveUrlCount()).toBe(3)
    expect(cache.getCachedObjectUrl(slides[0]!.id)).toBeNull()
    expect(revokeObjectURL).toHaveBeenCalled()
    revokeObjectURL.mockRestore()
  })
})
