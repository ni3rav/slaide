import { exportToBlob } from '@excalidraw/excalidraw'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slide/slide-dimensions.ts'
import type { Scene } from '../storage/deck-repository.ts'

export async function renderSlideToPngBlob(scene: Scene): Promise<Blob> {
  const viewBackgroundColor =
    typeof scene.appState.viewBackgroundColor === 'string'
      ? scene.appState.viewBackgroundColor
      : '#ffffff'

  return exportToBlob({
    elements: scene.elements as never[],
    appState: {
      ...scene.appState,
      exportBackground: true,
      viewBackgroundColor,
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    },
    files: scene.files as never,
    exportPadding: 0,
    mimeType: 'image/png',
    getDimensions: () => ({
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      scale: 1,
    }),
  })
}
