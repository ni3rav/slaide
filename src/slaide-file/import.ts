import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { isPresenterNotesField } from '../slide/presenter-notes.ts'
import { allElementsInsideSlide } from '../slide/slide-element-bounds.ts'
import type { Deck, Scene, Slide } from '../storage/deck-repository.ts'
import { SLAIDE_FILE_FORMAT_VERSION, type SlaideFile } from './schema.ts'

export const SLAIDE_MAX_IMPORT_BYTES = 100 * 1024 * 1024

const RECORD_SCHEMA_VERSION = 1

const FORBIDDEN_ELEMENT_TYPES = new Set([
  'frame',
  'magicframe',
  'embeddable',
  'iframe',
])

export class SlaideImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlaideImportError'
  }
}

export function assertImportFileSize(bytes: number): void {
  if (bytes > SLAIDE_MAX_IMPORT_BYTES) {
    throw new SlaideImportError(
      `Import file exceeds the ${formatMegabytes(SLAIDE_MAX_IMPORT_BYTES)} limit`,
    )
  }
}

export function parseSlaideFileText(text: string): unknown {
  assertImportFileSize(new TextEncoder().encode(text).byteLength)
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new SlaideImportError('Import file is not valid JSON')
  }
}

export function validateSlaideFile(value: unknown): SlaideFile {
  if (!value || typeof value !== 'object') {
    throw new SlaideImportError('Import file is missing required data')
  }

  const file = value as Partial<SlaideFile>
  if (file.formatVersion !== SLAIDE_FILE_FORMAT_VERSION) {
    throw new SlaideImportError('Import file uses an unsupported format version')
  }

  const deck = file.deck
  if (!deck || typeof deck !== 'object') {
    throw new SlaideImportError('Import file is missing deck data')
  }

  if (
    typeof deck.id !== 'string' ||
    deck.schemaVersion !== RECORD_SCHEMA_VERSION ||
    typeof deck.title !== 'string' ||
    typeof deck.createdAt !== 'number' ||
    typeof deck.updatedAt !== 'number' ||
    !Array.isArray(deck.slideOrder) ||
    deck.slideOrder.length < 1 ||
    !deck.slideOrder.every((id) => typeof id === 'string') ||
    new Set(deck.slideOrder).size !== deck.slideOrder.length
  ) {
    throw new SlaideImportError('Import file contains invalid deck data')
  }

  if (!Array.isArray(file.slides) || file.slides.length < 1) {
    throw new SlaideImportError('Import file is missing slide data')
  }

  const slidesById = new Map<string, Slide>()
  for (const slide of file.slides) {
    if (!slide || typeof slide !== 'object') {
      throw new SlaideImportError('Import file contains invalid slide data')
    }

    if (
      typeof slide.id !== 'string' ||
      slide.schemaVersion !== RECORD_SCHEMA_VERSION ||
      slide.deckId !== deck.id ||
      typeof slide.createdAt !== 'number' ||
      typeof slide.updatedAt !== 'number' ||
      !isPresenterNotesField(slide.notes) ||
      !isValidScene(slide.scene)
    ) {
      throw new SlaideImportError(
        slide.notes !== undefined && !isPresenterNotesField(slide.notes)
          ? 'Import file contains invalid presenter notes'
          : 'Import file contains invalid slide data',
      )
    }

    if (slidesById.has(slide.id)) {
      throw new SlaideImportError('Import file contains duplicate slide IDs')
    }

    validateSceneOwnership(slide.scene)
    validateElementBounds(slide.scene.elements)
    slidesById.set(slide.id, slide as Slide)
  }

  for (const slideId of deck.slideOrder) {
    if (!slidesById.has(slideId)) {
      throw new SlaideImportError(`Import file is missing slide ${slideId}`)
    }
  }

  if (slidesById.size !== deck.slideOrder.length) {
    throw new SlaideImportError('Import file contains slides that are not in slide order')
  }

  const theme = deck.theme === 'light' || deck.theme === 'dark' ? deck.theme : undefined
  const normalizedDeck: Deck = { ...(deck as Deck) }
  if (theme) {
    normalizedDeck.theme = theme
  } else {
    delete normalizedDeck.theme
  }

  return {
    formatVersion: SLAIDE_FILE_FORMAT_VERSION,
    deck: normalizedDeck,
    slides: deck.slideOrder.map((slideId) => slidesById.get(slideId)!),
  }
}

export function remapSlaideFileForImport(
  file: SlaideFile,
  existingTitles: Iterable<string>,
): { deck: Deck; slides: Slide[] } {
  const titleSet = new Set(existingTitles)
  const deckId = crypto.randomUUID()
  const slideIdMap = new Map<string, string>()

  for (const slide of file.slides) {
    slideIdMap.set(slide.id, crypto.randomUUID())
  }

  const title = titleSet.has(file.deck.title)
    ? `${file.deck.title} (Imported)`
    : file.deck.title

  const deck: Deck = {
    ...file.deck,
    id: deckId,
    title,
    slideOrder: file.deck.slideOrder.map((slideId) => slideIdMap.get(slideId)!),
  }

  const slides: Slide[] = file.slides.map((slide) => ({
    ...slide,
    id: slideIdMap.get(slide.id)!,
    deckId,
    scene: cloneScene(slide.scene),
  }))

  return { deck, slides }
}

function isValidScene(value: unknown): value is Scene {
  if (!value || typeof value !== 'object') return false
  const scene = value as Scene
  return (
    Array.isArray(scene.elements) &&
    !!scene.appState &&
    typeof scene.appState === 'object' &&
    !!scene.files &&
    typeof scene.files === 'object'
  )
}

function validateSceneOwnership(scene: Scene): void {
  for (const element of scene.elements) {
    if (!element || typeof element !== 'object') {
      throw new SlaideImportError('Import file contains invalid scene elements')
    }

    const type = (element as { type?: unknown }).type
    if (typeof type !== 'string') {
      throw new SlaideImportError('Import file contains invalid scene elements')
    }

    if (FORBIDDEN_ELEMENT_TYPES.has(type)) {
      throw new SlaideImportError(`Import file contains unsupported element type: ${type}`)
    }

    const fileId = (element as { fileId?: unknown }).fileId
    if (fileId != null) {
      if (typeof fileId !== 'string' || !(fileId in scene.files)) {
        throw new SlaideImportError('Import file references a missing binary file')
      }
    }
  }

  for (const [key, file] of Object.entries(scene.files)) {
    if (!file || typeof file !== 'object') {
      throw new SlaideImportError('Import file contains invalid binary files')
    }

    const record = file as { id?: unknown; mimeType?: unknown; dataURL?: unknown }
    if (
      typeof record.id !== 'string' ||
      typeof record.mimeType !== 'string' ||
      typeof record.dataURL !== 'string'
    ) {
      throw new SlaideImportError('Import file contains invalid binary files')
    }

    if (record.id !== key) {
      throw new SlaideImportError('Import file contains mismatched binary file IDs')
    }
  }
}

function validateElementBounds(elements: unknown[]): void {
  const excalidrawElements = elements as ExcalidrawElement[]
  if (!allElementsInsideSlide(excalidrawElements)) {
    throw new SlaideImportError('Import file contains elements outside the slide bounds')
  }
}

function cloneScene(scene: Scene): Scene {
  return {
    elements: structuredClone(scene.elements),
    appState: structuredClone(scene.appState),
    files: structuredClone(scene.files),
  }
}

function formatMegabytes(bytes: number): string {
  return `${bytes / (1024 * 1024)} MB`
}
