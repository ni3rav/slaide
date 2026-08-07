import type { Scene } from '../storage/deck-repository.ts'

const FORBIDDEN_ELEMENT_TYPES = new Set([
  'frame',
  'magicframe',
  'embeddable',
  'iframe',
])

const PERSISTENT_APP_STATE_KEYS = [
  'viewBackgroundColor',
  'theme',
  'gridSize',
  'gridStep',
  'gridModeEnabled',
  'currentItemStrokeColor',
  'currentItemBackgroundColor',
  'currentItemFillStyle',
  'currentItemStrokeWidth',
  'currentItemStrokeStyle',
  'currentItemRoughness',
  'currentItemOpacity',
  'currentItemFontFamily',
  'currentItemFontSize',
  'currentItemTextAlign',
  'currentItemStartArrowhead',
  'currentItemEndArrowhead',
  'currentItemRoundness',
  'currentItemArrowType',
  'currentChartType',
] as const

export function toPersistentScene(
  elements: readonly unknown[],
  appState: Record<string, unknown>,
  files: Record<string, unknown>,
): Scene {
  return {
    elements: elements.filter((element) => {
      if (!element || typeof element !== 'object') return false
      const type = (element as { type?: unknown }).type
      return typeof type === 'string' && !FORBIDDEN_ELEMENT_TYPES.has(type)
    }) as unknown[],
    appState: pickPersistentAppState(appState),
    files: { ...files },
  }
}

function pickPersistentAppState(
  appState: Record<string, unknown>,
): Record<string, unknown> {
  const persistent: Record<string, unknown> = {}
  for (const key of PERSISTENT_APP_STATE_KEYS) {
    if (key in appState) {
      persistent[key] = appState[key]
    }
  }
  return persistent
}
