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
  let generation = 0

  function revoke() {
    generation += 1
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl)
      objectUrl = null
    }
  }

  async function load(scene: Scene): Promise<string> {
    revoke()
    const loadGeneration = generation
    const blob = await render(scene)
    if (loadGeneration !== generation) {
      throw new Error('Preview generation was superseded')
    }

    const url = URL.createObjectURL(blob)
    objectUrl = url
    return url
  }

  return {
    load,
    revoke,
    getActiveUrlCount() {
      return objectUrl ? 1 : 0
    },
  }
}
