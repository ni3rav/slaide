import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  cameraNeedsCorrection,
  clampCamera,
  computeFitCamera,
  type ViewportSize,
} from './slide-camera.ts'
import {
  constrainElementsAfterGesture,
  toElementsMap,
} from './slide-element-bounds.ts'

export type SlideConstraintController = {
  fitSlideToViewport(): void
  correctCamera(): void
  enforceElementsForTest(): void
  isGestureActive(): boolean
  dispose(): void
}

export function createSlideConstraintController(
  api: ExcalidrawImperativeAPI,
  getViewport: () => ViewportSize | null,
): SlideConstraintController {
  let correctingCamera = false
  let gestureActive = false
  let gestureSnapshot = new Map<string, ExcalidrawElement>()

  function readCamera() {
    const { scrollX, scrollY, zoom } = api.getAppState()
    return { scrollX, scrollY, zoom: zoom.value }
  }

  function applyCamera(viewport: ViewportSize, camera = readCamera()) {
    const clamped = clampCamera(camera, viewport)
    if (
      clamped.scrollX === camera.scrollX &&
      clamped.scrollY === camera.scrollY &&
      clamped.zoom === camera.zoom
    ) {
      return
    }

    correctingCamera = true
    api.updateScene({
      appState: {
        scrollX: clamped.scrollX,
        scrollY: clamped.scrollY,
        zoom: { value: clamped.zoom as never },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
    correctingCamera = false
  }

  function correctCamera() {
    const viewport = getViewport()
    if (!viewport) return
    applyCamera(viewport)
  }

  function fitSlideToViewport() {
    const viewport = getViewport()
    if (!viewport) return
    const fit = computeFitCamera(viewport)
    correctingCamera = true
    api.updateScene({
      appState: {
        scrollX: fit.scrollX,
        scrollY: fit.scrollY,
        zoom: { value: fit.zoom as never },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    })
    correctingCamera = false
  }

  function enforceElementBounds() {
    const elements = api.getSceneElements()
    const constrained = constrainElementsAfterGesture(elements, gestureSnapshot)
    if (elementsIdentical(elements, constrained)) {
      return
    }
    api.updateScene({
      elements: constrained,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
  }

  const unsubscribeScroll = api.onScrollChange(() => {
    if (correctingCamera) return
    const viewport = getViewport()
    if (!viewport) return
    const camera = readCamera()
    if (!cameraNeedsCorrection(camera, viewport)) return
    applyCamera(viewport, camera)
  })

  const unsubscribePointerDown = api.onPointerDown((_tool, state) => {
    gestureActive = true
    gestureSnapshot = new Map(state.originalElements)
  })

  const unsubscribePointerUp = api.onPointerUp(() => {
    enforceElementBounds()
    gestureActive = false
    gestureSnapshot = new Map()
  })

  return {
    fitSlideToViewport,
    correctCamera,
    enforceElementsForTest: enforceElementBounds,
    isGestureActive() {
      return gestureActive
    },
    dispose() {
      unsubscribeScroll()
      unsubscribePointerDown()
      unsubscribePointerUp()
      gestureActive = false
      gestureSnapshot = new Map()
    },
  }
}

function elementsIdentical(
  left: readonly ExcalidrawElement[],
  right: readonly ExcalidrawElement[],
): boolean {
  if (left.length !== right.length) return false
  const rightMap = toElementsMap(right)
  return left.every((element) => {
    const other = rightMap.get(element.id)
    return other != null && JSON.stringify(element) === JSON.stringify(other)
  })
}
