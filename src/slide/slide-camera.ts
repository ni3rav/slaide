import {
  EXCALIDRAW_MAX_ZOOM,
  SLIDE_HEIGHT,
  SLIDE_WIDTH,
} from './slide-dimensions.ts'

export type ViewportSize = {
  width: number
  height: number
}

export type Camera = {
  scrollX: number
  scrollY: number
  zoom: number
}

export function computeFitZoom(viewport: ViewportSize): number {
  return Math.min(viewport.width / SLIDE_WIDTH, viewport.height / SLIDE_HEIGHT)
}

export function computeMinZoom(viewport: ViewportSize): number {
  return computeFitZoom(viewport)
}

export function visibleSceneBounds(
  camera: Camera,
  viewport: ViewportSize,
): readonly [number, number, number, number] {
  const visibleWidth = viewport.width / camera.zoom
  const visibleHeight = viewport.height / camera.zoom
  return [
    -camera.scrollX,
    -camera.scrollY,
    -camera.scrollX + visibleWidth,
    -camera.scrollY + visibleHeight,
  ]
}

export function computeFitCamera(viewport: ViewportSize): Camera {
  const zoom = computeFitZoom(viewport)
  const visibleWidth = viewport.width / zoom
  const visibleHeight = viewport.height / zoom
  return {
    scrollX: (visibleWidth - SLIDE_WIDTH) / 2,
    scrollY: (visibleHeight - SLIDE_HEIGHT) / 2,
    zoom,
  }
}

export function scrollBounds(viewport: ViewportSize, zoom: number) {
  const visibleWidth = viewport.width / zoom
  const visibleHeight = viewport.height / zoom

  return {
    scrollX: axisScrollBounds(visibleWidth, SLIDE_WIDTH),
    scrollY: axisScrollBounds(visibleHeight, SLIDE_HEIGHT),
  }
}

function axisScrollBounds(visibleSize: number, slideSize: number) {
  if (visibleSize <= slideSize) {
    return { min: visibleSize - slideSize, max: 0 }
  }
  const centered = (visibleSize - slideSize) / 2
  return { min: centered, max: centered }
}

export function clampCamera(camera: Camera, viewport: ViewportSize): Camera {
  const minZoom = computeMinZoom(viewport)
  const zoom = Math.min(EXCALIDRAW_MAX_ZOOM, Math.max(minZoom, camera.zoom))
  const bounds = scrollBounds(viewport, zoom)

  return {
    scrollX: clamp(camera.scrollX, bounds.scrollX.min, bounds.scrollX.max),
    scrollY: clamp(camera.scrollY, bounds.scrollY.min, bounds.scrollY.max),
    zoom,
  }
}

export function cameraNeedsCorrection(
  camera: Camera,
  viewport: ViewportSize,
): boolean {
  const clamped = clampCamera(camera, viewport)
  return (
    clamped.scrollX !== camera.scrollX ||
    clamped.scrollY !== camera.scrollY ||
    clamped.zoom !== camera.zoom
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
