import { describe, expect, it } from 'vitest'
import type { Deck, Slide } from '../storage/deck-repository.ts'
import { serializeDeckToSlaideFile, stringifySlaideFile } from './serialize.ts'
import {
  assertImportFileSize,
  parseSlaideFileText,
  remapSlaideFileForImport,
  SLAIDE_MAX_IMPORT_BYTES,
  SlaideImportError,
  validateSlaideFile,
} from './import.ts'

const deck: Deck = {
  id: 'deck-1',
  schemaVersion: 1,
  title: 'Demo deck',
  slideOrder: ['slide-1', 'slide-2'],
  createdAt: 100,
  updatedAt: 200,
}

const slideOne: Slide = {
  id: 'slide-1',
  schemaVersion: 1,
  deckId: 'deck-1',
  scene: {
    elements: [
      {
        id: 'rect-1',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 120,
        angle: 0,
        strokeColor: '#000000',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
      },
    ],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
  },
  createdAt: 110,
  updatedAt: 210,
}

const slideTwo: Slide = {
  id: 'slide-2',
  schemaVersion: 1,
  deckId: 'deck-1',
  scene: {
    elements: [
      {
        id: 'image-1',
        type: 'image',
        x: 40,
        y: 40,
        width: 100,
        height: 80,
        angle: 0,
        strokeColor: 'transparent',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        seed: 1,
        version: 1,
        versionNonce: 1,
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
        fileId: 'file-1',
        status: 'saved',
        scale: [1, 1],
      },
    ],
    appState: { viewBackgroundColor: '#112233' },
    files: {
      'file-1': {
        id: 'file-1',
        mimeType: 'image/png',
        dataURL: 'data:image/png;base64,abc',
      },
    },
  },
  createdAt: 120,
  updatedAt: 220,
}

function validFile() {
  return serializeDeckToSlaideFile(
    structuredClone(deck),
    structuredClone([slideOne, slideTwo]),
  )
}

describe('assertImportFileSize', () => {
  it('rejects files larger than 100 MB', () => {
    expect(() => assertImportFileSize(SLAIDE_MAX_IMPORT_BYTES + 1)).toThrow(
      SlaideImportError,
    )
    expect(() => assertImportFileSize(SLAIDE_MAX_IMPORT_BYTES + 1)).toThrow(/100 MB/)
  })

  it('accepts files at the size limit', () => {
    expect(() => assertImportFileSize(SLAIDE_MAX_IMPORT_BYTES)).not.toThrow()
  })
})

describe('parseSlaideFileText', () => {
  it('parses valid JSON within the size limit', () => {
    const parsed = parseSlaideFileText(stringifySlaideFile(validFile()))
    expect(parsed).toMatchObject({ formatVersion: 1 })
  })

  it('rejects malformed JSON', () => {
    expect(() => parseSlaideFileText('{not json')).toThrow(/valid JSON/i)
  })
})

describe('validateSlaideFile', () => {
  it('accepts a complete exported file', () => {
    const validated = validateSlaideFile(validFile())
    expect(validated.deck.id).toBe('deck-1')
    expect(validated.slides).toHaveLength(2)
  })

  it('rejects unsupported format versions', () => {
    const file = { ...validFile(), formatVersion: 99 }
    expect(() => validateSlaideFile(file)).toThrow(/unsupported format version/i)
  })

  it('rejects missing slides from slide order', () => {
    const file = validFile()
    file.deck.slideOrder = ['slide-1', 'missing']
    expect(() => validateSlaideFile(file)).toThrow(/missing slide/i)
  })

  it('rejects slides that do not belong to the deck', () => {
    const file = validFile()
    file.slides[1] = { ...slideTwo, deckId: 'other-deck' }
    expect(() => validateSlaideFile(file)).toThrow(/invalid slide data/i)
  })

  it('rejects elements outside slide bounds', () => {
    const file = validFile()
    file.slides[0] = {
      ...slideOne,
      scene: {
        ...slideOne.scene,
        elements: [
          {
            ...(slideOne.scene.elements[0] as Record<string, unknown>),
            x: 3000,
            y: 100,
            width: 500,
            height: 120,
          },
        ],
      },
    }
    expect(() => validateSlaideFile(file)).toThrow(/outside the slide bounds/i)
  })

  it('rejects missing binary files referenced by elements', () => {
    const file = validFile()
    file.slides[1] = {
      ...slideTwo,
      scene: {
        ...slideTwo.scene,
        files: {},
      },
    }
    expect(() => validateSlaideFile(file)).toThrow(/missing binary file/i)
  })

  it('preserves presenter notes and accepts slides that omit them', () => {
    const file = validFile()
    file.slides[0] = { ...slideOne, notes: 'Speak slowly' }

    const validated = validateSlaideFile(file)

    expect(validated.slides[0]?.notes).toBe('Speak slowly')
    expect(validated.slides[1]?.notes).toBeUndefined()
  })

  it('rejects presenter notes that are not text', () => {
    const file = validFile()
    file.slides[0] = { ...slideOne, notes: 12 as never }

    expect(() => validateSlaideFile(file)).toThrow(/presenter notes/i)
  })

  it('rejects unsupported element types', () => {
    const file = validFile()
    file.slides[0] = {
      ...slideOne,
      scene: {
        ...slideOne.scene,
        elements: [{ id: 'frame-1', type: 'frame' }],
      },
    }
    expect(() => validateSlaideFile(file)).toThrow(/unsupported element type/i)
  })
})

describe('theme metadata', () => {
  it('preserves a valid theme from deck metadata', () => {
    const file = serializeDeckToSlaideFile(
      structuredClone(deck),
      structuredClone([slideOne, slideTwo]),
      'dark',
    )
    expect(validateSlaideFile(file).deck.theme).toBe('dark')
  })

  it('falls back to no theme when metadata is missing', () => {
    expect(validateSlaideFile(validFile()).deck.theme).toBeUndefined()
  })

  it('drops an invalid theme value instead of breaking the import', () => {
    const file = validFile()
    ;(file.deck as { theme?: unknown }).theme = 'purple'
    expect(validateSlaideFile(file).deck.theme).toBeUndefined()
  })

  it('carries the theme through remap for import', () => {
    const file = serializeDeckToSlaideFile(
      structuredClone(deck),
      structuredClone([slideOne, slideTwo]),
      'light',
    )
    const remapped = remapSlaideFileForImport(validateSlaideFile(file), [])
    expect(remapped.deck.theme).toBe('light')
  })
})

describe('remapSlaideFileForImport', () => {
  it('generates new deck and slide IDs while preserving scene content', () => {
    const file = validFile()
    const remapped = remapSlaideFileForImport(file, [])

    expect(remapped.deck.id).not.toBe(file.deck.id)
    expect(remapped.deck.title).toBe(file.deck.title)
    expect(remapped.deck.slideOrder).toHaveLength(2)
    expect(remapped.deck.slideOrder).not.toEqual(file.deck.slideOrder)
    expect(remapped.slides.map((slide) => slide.id)).toEqual(remapped.deck.slideOrder)
    expect(remapped.slides.every((slide) => slide.deckId === remapped.deck.id)).toBe(true)
    expect(remapped.slides[0]?.scene).toEqual(slideOne.scene)
    expect(remapped.slides[1]?.scene).toEqual(slideTwo.scene)
  })

  it('suffixes the title when a local deck already uses it', () => {
    const remapped = remapSlaideFileForImport(validFile(), ['Demo deck'])
    expect(remapped.deck.title).toBe('Demo deck (Imported)')
  })

  it('keeps the original title when there is no local conflict', () => {
    const remapped = remapSlaideFileForImport(validFile(), ['Other deck'])
    expect(remapped.deck.title).toBe('Demo deck')
  })
})
