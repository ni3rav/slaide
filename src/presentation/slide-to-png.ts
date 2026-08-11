import {
  applyDarkModeFilter,
  exportToBlob,
  exportToCanvas,
} from '@excalidraw/excalidraw'
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

/** Matches Excalidraw `@excalidraw/common` defaults. */
const DEFAULT_GRID_SIZE = 20
const DEFAULT_GRID_STEP = 5

export type SlideRenderTheme = 'light' | 'dark'

type GridLineColors = { bold: string; regular: string }

function gridLineColors(theme: SlideRenderTheme): GridLineColors {
  if (theme === 'dark') {
    return {
      bold: applyDarkModeFilter('#dddddd', true),
      regular: applyDarkModeFilter('#e5e5e5', true),
    }
  }
  return { bold: '#dddddd', regular: '#e5e5e5' }
}

/**
 * Draw Excalidraw's editor grid onto an export canvas.
 * Copied from Excalidraw `strokeGrid` for zoom=1 / scroll=(0,0) slide exports.
 */
function strokeSlideGrid(
  context: CanvasRenderingContext2D,
  {
    gridSize,
    gridStep,
    width,
    height,
    theme,
  }: {
    gridSize: number
    gridStep: number
    width: number
    height: number
    theme: SlideRenderTheme
  },
): void {
  const scrollX = 0
  const scrollY = 0
  const zoomValue = 1
  const offsetX = scrollX % gridSize - gridSize
  const offsetY = scrollY % gridSize - gridSize
  const actualGridSize = gridSize * zoomValue
  const spaceWidth = 1 / zoomValue
  const colors = gridLineColors(theme)

  context.save()
  context.translate(0.5, 0.5)

  for (let x = offsetX; x < offsetX + width + gridSize * 2; x += gridSize) {
    const isBold =
      gridStep > 1 && Math.round(x - scrollX) % (gridStep * gridSize) === 0
    if (!isBold && actualGridSize < 10) {
      continue
    }
    const lineWidth = Math.min(1 / zoomValue, isBold ? 4 : 1)
    context.lineWidth = lineWidth
    const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)]
    context.beginPath()
    context.setLineDash(isBold ? [] : lineDash)
    context.strokeStyle = isBold ? colors.bold : colors.regular
    context.moveTo(x, offsetY - gridSize)
    context.lineTo(x, Math.ceil(offsetY + height + gridSize * 2))
    context.stroke()
  }

  for (let y = offsetY; y < offsetY + height + gridSize * 2; y += gridSize) {
    const isBold =
      gridStep > 1 && Math.round(y - scrollY) % (gridStep * gridSize) === 0
    if (!isBold && actualGridSize < 10) {
      continue
    }
    const lineWidth = Math.min(1 / zoomValue, isBold ? 4 : 1)
    context.lineWidth = lineWidth
    const lineDash = [lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)]
    context.beginPath()
    context.setLineDash(isBold ? [] : lineDash)
    context.strokeStyle = isBold ? colors.bold : colors.regular
    context.moveTo(offsetX - gridSize, y)
    context.lineTo(Math.ceil(offsetX + width + gridSize * 2), y)
    context.stroke()
  }

  context.restore()
}

function readGridSize(appState: Scene['appState']): number {
  const value = appState.gridSize
  return typeof value === 'number' && value > 0 ? value : DEFAULT_GRID_SIZE
}

function readGridStep(appState: Scene['appState']): number {
  const value = appState.gridStep
  return typeof value === 'number' && value > 0 ? value : DEFAULT_GRID_STEP
}

function buildExportAppState(
  scene: Scene,
  theme: SlideRenderTheme,
  exportBackground: boolean,
) {
  const viewBackgroundColor =
    typeof scene.appState.viewBackgroundColor === 'string'
      ? scene.appState.viewBackgroundColor
      : '#ffffff'

  return {
    ...scene.appState,
    exportBackground,
    viewBackgroundColor,
    exportWithDarkMode: theme === 'dark',
    frameRendering: {
      enabled: false,
      name: false,
      outline: false,
      clip: false,
    },
  }
}

const slideExportDimensions = () => ({
  width: SLIDE_WIDTH,
  height: SLIDE_HEIGHT,
  scale: 1,
})

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to encode slide PNG'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export async function renderSlideToPngBlob(
  scene: Scene,
  theme: SlideRenderTheme = 'light',
): Promise<Blob> {
  if (!scene.appState.gridModeEnabled) {
    return exportToBlob({
      elements: scene.elements as never[],
      appState: buildExportAppState(scene, theme, true),
      files: scene.files as never,
      exportPadding: 0,
      mimeType: 'image/png',
      exportingFrame: SLIDE_EXPORT_FRAME,
      getDimensions: slideExportDimensions,
    })
  }

  // Excalidraw's export path hardcodes renderGrid: false. Composite the grid
  // between the background and elements so it matches the editor stacking.
  const [backgroundCanvas, elementsCanvas] = await Promise.all([
    exportToCanvas({
      elements: [],
      appState: buildExportAppState(scene, theme, true),
      files: scene.files as never,
      exportPadding: 0,
      exportingFrame: SLIDE_EXPORT_FRAME,
      getDimensions: slideExportDimensions,
    }),
    exportToCanvas({
      elements: scene.elements as never[],
      appState: buildExportAppState(scene, theme, false),
      files: scene.files as never,
      exportPadding: 0,
      exportingFrame: SLIDE_EXPORT_FRAME,
      getDimensions: slideExportDimensions,
    }),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = SLIDE_WIDTH
  canvas.height = SLIDE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not get 2d context for slide export')
  }

  context.drawImage(backgroundCanvas, 0, 0)
  strokeSlideGrid(context, {
    gridSize: readGridSize(scene.appState),
    gridStep: readGridStep(scene.appState),
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    theme,
  })
  context.drawImage(elementsCanvas, 0, 0)

  return canvasToPngBlob(canvas)
}
