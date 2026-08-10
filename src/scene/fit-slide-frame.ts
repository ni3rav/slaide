import { zoomToFitBounds } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

const SLIDE_BOUNDS = [0, 0, 1920, 1080] as const

export function fitSlideFrame(api: ExcalidrawImperativeAPI): void {
  const appState = api.getAppState()
  const { appState: fitted } = zoomToFitBounds({
    bounds: [...SLIDE_BOUNDS],
    appState,
    fit: 'contain',
  })
  api.updateScene({ appState: fitted })
}
