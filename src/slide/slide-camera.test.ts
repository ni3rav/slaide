import { describe, expect, it } from 'vitest'
import {
  clampCamera,
  computeFitCamera,
  computeFitZoom,
  computeMinZoom,
  visibleSceneBounds,
} from './slide-camera.ts'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from './slide-dimensions.ts'

describe('slide camera', () => {
  it('computes fit zoom from viewport size', () => {
    expect(computeFitZoom({ width: 1920, height: 1080 })).toBe(1)
    expect(computeFitZoom({ width: 960, height: 540 })).toBe(0.5)
    expect(computeFitZoom({ width: 1280, height: 720 })).toBeCloseTo(720 / SLIDE_HEIGHT)
  })

  it('uses the same value for minimum zoom', () => {
    const viewport = { width: 1280, height: 900 }
    expect(computeMinZoom(viewport)).toBe(computeFitZoom(viewport))
  })

  it('fits the complete slide frame on open', () => {
    const viewport = { width: 1280, height: 900 }
    const camera = computeFitCamera(viewport)
    const [minX, minY, maxX, maxY] = visibleSceneBounds(camera, viewport)

    expect(minX).toBeLessThanOrEqual(0)
    expect(minY).toBeLessThanOrEqual(0)
    expect(maxX).toBeGreaterThanOrEqual(SLIDE_WIDTH)
    expect(maxY).toBeGreaterThanOrEqual(SLIDE_HEIGHT)
    expect(camera.zoom).toBe(computeFitZoom(viewport))
  })

  it('clamps zoom between fitted minimum and Excalidraw maximum', () => {
    const viewport = { width: 960, height: 540 }
    const minZoom = computeMinZoom(viewport)

    expect(clampCamera({ scrollX: 0, scrollY: 0, zoom: minZoom / 2 }, viewport).zoom).toBe(
      minZoom,
    )
    expect(clampCamera({ scrollX: 0, scrollY: 0, zoom: 100 }, viewport).zoom).toBe(30)
  })

  it('keeps the visible camera inside the slide when zoomed in', () => {
    const viewport = { width: 960, height: 540 }
    const zoom = 1
    const clamped = clampCamera({ scrollX: -500, scrollY: 200, zoom }, viewport)

    const [minX, minY, maxX, maxY] = visibleSceneBounds(clamped, viewport)
    expect(minX).toBeGreaterThanOrEqual(0)
    expect(minY).toBeGreaterThanOrEqual(0)
    expect(maxX).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(maxY).toBeLessThanOrEqual(SLIDE_HEIGHT)
  })

  it('locks pan at fit zoom so the slide stays fully visible', () => {
    const viewport = { width: 1280, height: 900 }
    const fit = computeFitCamera(viewport)
    const clamped = clampCamera(
      { scrollX: fit.scrollX + 400, scrollY: fit.scrollY - 300, zoom: fit.zoom },
      viewport,
    )

    expect(clamped.scrollX).toBeCloseTo(fit.scrollX)
    expect(clamped.scrollY).toBeCloseTo(fit.scrollY)
  })

  it('returns the same camera when already valid', () => {
    const viewport = { width: 960, height: 540 }
    const camera = clampCamera({ scrollX: 120, scrollY: 80, zoom: 2 }, viewport)
    expect(clampCamera(camera, viewport)).toEqual(camera)
  })
})
