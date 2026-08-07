import type { SlideId } from '../storage/deck-repository.ts'
import { renderSlideToPngBlob } from './slide-to-png.ts'
import type { Scene } from '../storage/deck-repository.ts'

export type PresentationImageCache = {
  getObjectUrl: (slideId: SlideId, scene: Scene) => Promise<string>
  revokeAll: () => void
  getActiveUrlCount: () => number
}

export function createPresentationImageCache(): PresentationImageCache {
  const objectUrls = new Map<SlideId, string>()
  const pending = new Map<SlideId, Promise<string>>()

  async function loadObjectUrl(slideId: SlideId, scene: Scene): Promise<string> {
    const existing = objectUrls.get(slideId)
    if (existing) return existing

    const inFlight = pending.get(slideId)
    if (inFlight) return inFlight

    const promise = renderSlideToPngBlob(scene).then((blob) => {
      const url = URL.createObjectURL(blob)
      objectUrls.set(slideId, url)
      pending.delete(slideId)
      return url
    })
    pending.set(slideId, promise)
    return promise
  }

  return {
    getObjectUrl: loadObjectUrl,
    revokeAll() {
      for (const url of objectUrls.values()) {
        URL.revokeObjectURL(url)
      }
      objectUrls.clear()
      pending.clear()
    },
    getActiveUrlCount() {
      return objectUrls.size
    },
  }
}
