import {
  convertToExcalidrawElements,
  getCommonBounds,
  newElementWith,
} from '@excalidraw/excalidraw'
import { describe, expect, it } from 'vitest'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from './slide-dimensions.ts'
import {
  allElementsInsideSlide,
  clampElementInsideSlide,
  constrainAllElements,
  constrainElementsAfterGesture,
  elementFitsInSlide,
  isElementInsideSlide,
  scaleElementToFitSlide,
  toElementsMap,
} from './slide-element-bounds.ts'

function rectangle(overrides: Record<string, unknown> = {}) {
  return convertToExcalidrawElements([
    {
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      ...overrides,
    },
  ])[0]!
}

describe('slide element bounds', () => {
  it('detects when an element is inside the slide', () => {
    const element = rectangle()
    const map = toElementsMap([element])
    expect(isElementInsideSlide(element, map)).toBe(true)
  })

  it('clamps a moved element that still fits', () => {
    const element = rectangle({ x: 1800, y: 980 })
    const map = toElementsMap([element])
    expect(elementFitsInSlide(element, map)).toBe(true)

    const clamped = clampElementInsideSlide(element, map)
    const [minX, minY, maxX, maxY] = getCommonBounds([clamped])
    expect(minX).toBeGreaterThanOrEqual(0)
    expect(minY).toBeGreaterThanOrEqual(0)
    expect(maxX).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(maxY).toBeLessThanOrEqual(SLIDE_HEIGHT)
  })

  it('restores the previous geometry after an invalid resize', () => {
    const previous = rectangle({ width: 200, height: 120 })
    const resized = newElementWith(previous, { width: 3000, height: 120 })
    const map = toElementsMap([resized])
    const result = constrainElementsAfterGesture(
      [resized],
      new Map([[previous.id, previous]]),
    )

    expect(result[0]?.width).toBe(200)
    expect(result[0]?.height).toBe(120)
    expect(isElementInsideSlide(result[0]!, map)).toBe(true)
  })

  it('proportionally scales a newly inserted oversized element', () => {
    const oversized = rectangle({ x: 0, y: 0, width: 3840, height: 2160 })
    const map = toElementsMap([oversized])
    const scaled = scaleElementToFitSlide(oversized, map)
    const [minX, minY, maxX, maxY] = getCommonBounds([scaled])

    expect(maxX - minX).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(maxY - minY).toBeLessThanOrEqual(SLIDE_HEIGHT)
    expect(maxX - minX).toBeCloseTo(SLIDE_WIDTH, 0)
    expect(maxY - minY).toBeCloseTo(SLIDE_HEIGHT, 0)
  })

  it('handles rotated elements using visual bounds', () => {
    const rotated = convertToExcalidrawElements([
      {
        type: 'rectangle',
        x: 1700,
        y: 500,
        width: 400,
        height: 100,
        angle: Math.PI / 4,
      },
    ])[0]!
    const previous = newElementWith(rotated, { x: 900, y: 400 })
    const moved = newElementWith(rotated, { x: 1700, y: 500 })
    const result = constrainElementsAfterGesture(
      [moved],
      new Map([[previous.id, previous]]),
    )
    const map = toElementsMap(result)
    expect(isElementInsideSlide(result[0]!, map)).toBe(true)
  })

  it('keeps grouped elements constrained together after a move', () => {
    const elements = convertToExcalidrawElements([
      { type: 'rectangle', x: 100, y: 100, width: 80, height: 80, groupIds: ['g1'] },
      { type: 'rectangle', x: 220, y: 140, width: 80, height: 80, groupIds: ['g1'] },
    ])
    const moved = elements.map((element) =>
      newElementWith(element, { x: element.x + 1750, y: element.y + 900 }),
    )
    const previous = new Map(elements.map((element) => [element.id, element]))
    const result = constrainElementsAfterGesture(moved, previous)
    expect(allElementsInsideSlide(result)).toBe(true)
  })

  it('constrains linear elements using point bounds', () => {
    const arrow = convertToExcalidrawElements([
      {
        type: 'arrow',
        x: 1800,
        y: 100,
        width: 200,
        height: 0,
        points: [
          [0, 0],
          [200, 0],
        ],
      },
    ])[0]!
    const result = constrainAllElements([arrow])
    expect(allElementsInsideSlide(result)).toBe(true)
  })
})
