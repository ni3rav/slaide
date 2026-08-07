import { exportToBlob } from '@excalidraw/excalidraw'
import type { ExcalidrawFrameLikeElement } from '@excalidraw/excalidraw/element/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../slide/slide-dimensions.ts'
import type { Scene } from '../storage/deck-repository.ts'

/**
 * Synthetic export frame covering the fixed slide surface.
 * Without this, Excalidraw crops to element bounds and shifts content to the top-left.
 */
const SLIDE_EXPORT_FRAME = {
  id: 'slaide-slide-bounds',
  type: 'frame',
  x: 0,
  y: 0,
  width: SLIDE_WIDTH,
  height: SLIDE_HEIGHT,
  angle: 0 as never,
  strokeColor: 'transparent',
  backgroundColor: 'transparent',
  fillStyle: 'solid',
  strokeWidth: 0,
  strokeStyle: 'solid',
  roughness: 0,
  opacity: 0,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: true,
  index: null,
  name: null,
} as unknown as ExcalidrawFrameLikeElement

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
      exportWithDarkMode: false,
      frameRendering: {
        enabled: false,
        name: false,
        outline: false,
        clip: false,
      },
    },
    files: scene.files as never,
    exportPadding: 0,
    mimeType: 'image/png',
    exportingFrame: SLIDE_EXPORT_FRAME,
    getDimensions: () => ({
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      scale: 1,
    }),
  })
}
