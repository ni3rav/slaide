import {
  getCommonBounds,
  isElementInsideBBox,
  newElementWith,
} from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SLIDE_BOUNDS, SLIDE_HEIGHT, SLIDE_WIDTH } from './slide-dimensions.ts'

type ElementsMap = Map<string, ExcalidrawElement>

function elementBounds(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): readonly [number, number, number, number] {
  return getCommonBounds([element], elementsMap)
}

export function toElementsMap(
  elements: readonly ExcalidrawElement[],
): ElementsMap {
  return new Map(elements.map((element) => [element.id, element]))
}

export function isElementInsideSlide(
  element: ExcalidrawElement,
  _elementsMap: ElementsMap,
): boolean {
  if (element.isDeleted) return true
  return isElementInsideBBox(element, SLIDE_BOUNDS)
}

export function elementFitsInSlide(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean {
  if (element.isDeleted) return true
  const [minX, minY, maxX, maxY] = elementBounds(element, elementsMap)
  const width = maxX - minX
  const height = maxY - minY
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return true
  }
  return width <= SLIDE_WIDTH && height <= SLIDE_HEIGHT
}

function clampTranslationInsideSlide(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): ExcalidrawElement {
  if (isElementInsideSlide(element, elementsMap)) {
    return element
  }

  let current = element
  let map = toElementsMap(
    [...elementsMap.values()].map((entry) =>
      entry.id === current.id ? current : entry,
    ),
  )

  for (let iteration = 0; iteration < 64; iteration++) {
    if (isElementInsideSlide(current, map)) {
      return current
    }

    const [minX, minY, maxX, maxY] = elementBounds(current, map)
    let dx = 0
    let dy = 0

    if (minX < SLIDE_BOUNDS[0]) {
      dx = SLIDE_BOUNDS[0] - minX
    } else if (maxX > SLIDE_BOUNDS[2]) {
      dx = SLIDE_BOUNDS[2] - maxX
    }

    if (minY < SLIDE_BOUNDS[1]) {
      dy = SLIDE_BOUNDS[1] - minY
    } else if (maxY > SLIDE_BOUNDS[3]) {
      dy = SLIDE_BOUNDS[3] - maxY
    }

    if (dx === 0 && dy === 0) {
      break
    }

    current = newElementWith(current, {
      x: current.x + dx,
      y: current.y + dy,
    })
    map.set(current.id, current)
  }

  for (const distance of [1, 2, 4, 8, 16, 32, 64, 128, 256]) {
    for (const dx of [-distance, 0, distance]) {
      for (const dy of [-distance, 0, distance]) {
        if (dx === 0 && dy === 0) {
          continue
        }
        const trial = newElementWith(current, {
          x: current.x + dx,
          y: current.y + dy,
        })
        const trialMap = toElementsMap([trial])
        if (isElementInsideSlide(trial, trialMap)) {
          return trial
        }
      }
    }
  }

  return current
}

export function clampElementInsideSlide(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): ExcalidrawElement {
  const clamped = clampTranslationInsideSlide(element, elementsMap)
  if (isElementInsideSlide(clamped, toElementsMap([clamped]))) {
    return clamped
  }
  return scaleElementToFitSlide(clamped, elementsMap)
}

export function scaleElementToFitSlide(
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): ExcalidrawElement {
  const [minX, minY, maxX, maxY] = elementBounds(element, elementsMap)
  const width = maxX - minX
  const height = maxY - minY
  if (width <= 0 || height <= 0) {
    return element
  }

  const scale = Math.min(SLIDE_WIDTH / width, SLIDE_HEIGHT / height, 1)
  if (scale >= 1) {
    return clampTranslationInsideSlide(element, elementsMap)
  }

  const centerX = minX + width / 2
  const centerY = minY + height / 2
  const nextWidth = width * scale
  const nextHeight = height * scale
  const nextMinX = centerX - nextWidth / 2
  const nextMinY = centerY - nextHeight / 2

  const scaled = scaleElementFromBounds(element, {
    minX,
    minY,
    width,
    height,
    nextMinX,
    nextMinY,
    nextWidth,
    nextHeight,
    scale,
  })
  return clampTranslationInsideSlide(scaled, toElementsMap([scaled]))
}

function scaleElementFromBounds(
  element: ExcalidrawElement,
  layout: {
    minX: number
    minY: number
    width: number
    height: number
    nextMinX: number
    nextMinY: number
    nextWidth: number
    nextHeight: number
    scale: number
  },
): ExcalidrawElement {
  const { scale, nextMinX, nextMinY, nextWidth, nextHeight } = layout

  if (
    element.type === 'rectangle' ||
    element.type === 'ellipse' ||
    element.type === 'diamond' ||
    element.type === 'image' ||
    element.type === 'text'
  ) {
    const widthRatio = 'width' in element ? nextWidth / element.width : 1
    const heightRatio = 'height' in element ? nextHeight / element.height : 1
    return newElementWith(element, {
      x: nextMinX,
      y: nextMinY,
      ...( 'width' in element ? { width: element.width * widthRatio } : {}),
      ...( 'height' in element ? { height: element.height * heightRatio } : {}),
    } as never)
  }

  if (element.type === 'freedraw') {
    return newElementWith(element, {
      width: element.width * scale,
      height: element.height * scale,
      points: element.points.map(([px, py]: readonly [number, number]) => [px * scale, py * scale] as const),
    })
  }

  if (element.type === 'line' || element.type === 'arrow') {
    return newElementWith(element, {
      width: element.width * scale,
      height: element.height * scale,
      points: element.points.map(([px, py]: readonly [number, number]) => [px * scale, py * scale] as const),
    })
  }

  return newElementWith(element, {
    x: element.x + (nextMinX - layout.minX),
    y: element.y + (nextMinY - layout.minY),
  })
}

export function resizeMadeElementTooLarge(
  current: ExcalidrawElement,
  previous: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean {
  if (!geometryChangedSince(current, previous)) {
    return false
  }

  const sizeChanged =
    ('width' in current &&
      'width' in previous &&
      current.width !== previous.width) ||
    ('height' in current &&
      'height' in previous &&
      current.height !== previous.height) ||
    ('points' in current &&
      'points' in previous &&
      JSON.stringify(current.points) !== JSON.stringify(previous.points))

  if (!sizeChanged) {
    return false
  }

  return !elementFitsInSlide(current, elementsMap)
}

function geometryChangedSince(
  current: ExcalidrawElement,
  previous: ExcalidrawElement | undefined,
): boolean {
  if (!previous) return false
  return (
    current.x !== previous.x ||
    current.y !== previous.y ||
    ('width' in current &&
      'width' in previous &&
      current.width !== previous.width) ||
    ('height' in current &&
      'height' in previous &&
      current.height !== previous.height) ||
    ('points' in current &&
      'points' in previous &&
      JSON.stringify(current.points) !== JSON.stringify(previous.points)) ||
    ('angle' in current &&
      'angle' in previous &&
      current.angle !== previous.angle)
  )
}

export function constrainElementsAfterGesture(
  elements: readonly ExcalidrawElement[],
  previousElements: ReadonlyMap<string, ExcalidrawElement>,
): ExcalidrawElement[] {
  const elementsMap = toElementsMap(elements)
  let changed = false
  const nextElements = elements.map((element) => {
    if (element.isDeleted || isElementInsideSlide(element, elementsMap)) {
      return element
    }

    const previous = previousElements.get(element.id)
    const isNew = previous == null

    if (isNew) {
      changed = true
      if (elementFitsInSlide(element, elementsMap)) {
        return clampElementInsideSlide(element, elementsMap)
      }
      return scaleElementToFitSlide(element, elementsMap)
    }

    if (resizeMadeElementTooLarge(element, previous, elementsMap)) {
      changed = true
      return previous
    }

    if (elementFitsInSlide(element, elementsMap)) {
      changed = true
      return clampElementInsideSlide(element, elementsMap)
    }

    changed = true
    return scaleElementToFitSlide(element, elementsMap)
  })

  if (!changed) {
    return elements as ExcalidrawElement[]
  }

  return reconcileElements(elementsMap, nextElements)
}

function reconcileElements(
  staleMap: ElementsMap,
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  const nextMap = toElementsMap(elements)
  return elements.map((element) => {
    if (element.isDeleted) return element
    if (isElementInsideSlide(element, nextMap)) {
      return element
    }
    if (elementFitsInSlide(element, staleMap)) {
      return clampElementInsideSlide(element, nextMap)
    }
    return element
  })
}

export function constrainAllElements(
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] {
  return constrainElementsAfterGesture(elements, new Map())
}

export function allElementsInsideSlide(
  elements: readonly ExcalidrawElement[],
): boolean {
  const elementsMap = toElementsMap(elements)
  return elements.every(
    (element) => element.isDeleted || isElementInsideSlide(element, elementsMap),
  )
}
