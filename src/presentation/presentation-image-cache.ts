import type { Scene, Slide, SlideId } from '../storage/deck-repository.ts'
import { renderSlideToPngBlob } from './slide-to-png.ts'
import { computePresentationWindowIndices } from './presentation-window.ts'

export type PresentationImageCache = {
  getObjectUrl: (slideId: SlideId, scene: Scene) => Promise<string>
  getCachedObjectUrl: (slideId: SlideId) => string | null
  ensureWindow: (slides: Slide[], currentIndex: number) => void
  revokeAll: () => void
  getActiveUrlCount: () => number
}

type RenderSlide = (scene: Scene) => Promise<Blob>

declare global {
  interface Window {
    __slaidePresentationRenderDelayMs?: number
    __slaidePresentationFailSlideIds?: string[]
  }
}

function getRenderDelayMs(): number {
  if (typeof window !== 'undefined') {
    return window.__slaidePresentationRenderDelayMs ?? 0
  }
  return 0
}

export function createPresentationImageCache(
  render: RenderSlide = renderSlideToPngBlob,
): PresentationImageCache {
  const objectUrls = new Map<SlideId, string>()
  const pending = new Map<SlideId, Promise<string>>()
  let retainedSlideIds = new Set<SlideId>()

  function isRetained(slideId: SlideId): boolean {
    return retainedSlideIds.has(slideId)
  }

  function revokeSlide(slideId: SlideId): void {
    const url = objectUrls.get(slideId)
    if (!url) return
    URL.revokeObjectURL(url)
    objectUrls.delete(slideId)
  }

  function evictOutsideWindow(): void {
    for (const slideId of [...objectUrls.keys()]) {
      if (!isRetained(slideId)) {
        revokeSlide(slideId)
      }
    }
  }

  async function loadObjectUrl(slideId: SlideId, scene: Scene): Promise<string> {
    const existing = objectUrls.get(slideId)
    if (existing) return existing

    const inFlight = pending.get(slideId)
    if (inFlight) return inFlight

    const promise = (async () => {
      const delayMs = getRenderDelayMs()
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }

      if (
        typeof window !== 'undefined' &&
        window.__slaidePresentationFailSlideIds?.includes(slideId)
      ) {
        pending.delete(slideId)
        throw new Error('Presentation image render failed')
      }

      const blob = await render(scene)
      const url = URL.createObjectURL(blob)
      pending.delete(slideId)

      if (isRetained(slideId)) {
        objectUrls.set(slideId, url)
        return url
      }

      URL.revokeObjectURL(url)
      return url
    })()

    pending.set(slideId, promise)
    return promise
  }

  return {
    getObjectUrl: loadObjectUrl,
    getCachedObjectUrl(slideId) {
      return objectUrls.get(slideId) ?? null
    },
    ensureWindow(slides, currentIndex) {
      const windowIndices = computePresentationWindowIndices(currentIndex, slides.length)
      retainedSlideIds = new Set(
        windowIndices
          .map((index) => slides[index]?.id)
          .filter((slideId): slideId is SlideId => slideId != null),
      )
      evictOutsideWindow()

      for (const index of windowIndices) {
        const slide = slides[index]
        if (!slide) continue
        void loadObjectUrl(slide.id, slide.scene).catch(() => {
          // Background preloads surface errors when the slide is navigated to.
        })
      }
    },
    revokeAll() {
      for (const url of objectUrls.values()) {
        URL.revokeObjectURL(url)
      }
      objectUrls.clear()
      pending.clear()
      retainedSlideIds = new Set()
    },
    getActiveUrlCount() {
      return objectUrls.size
    },
  }
}
