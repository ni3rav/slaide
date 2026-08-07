import type { Scene } from '../storage/deck-repository.ts'

export type SlidePreviewController = {
  load: (scene: Scene) => Promise<string>
  revoke: () => void
  getActiveUrlCount: () => number
}

export type SlidePreviewRender = (scene: Scene) => Promise<Blob>

export function createSlidePreviewController(
  render: SlidePreviewRender,
): SlidePreviewController {
  let objectUrl: string | null = null
  let pending: Promise<string> | null = null

  function revoke() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
    pending = null
  }

  async function load(scene: Scene): Promise<string> {
    if (objectUrl) return objectUrl
    if (pending) return pending

    pending = render(scene)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        objectUrl = url
        pending = null
        return url
      })
      .catch((error) => {
        pending = null
        throw error
      })

    return pending
  }

  return {
    load,
    revoke,
    getActiveUrlCount() {
      return objectUrl ? 1 : 0
    },
  }
}
