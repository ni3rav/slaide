import { describe, expect, it } from 'vitest'
import type { Deck, Slide } from '../storage/deck-repository.ts'
import { SLAIDE_FILE_FORMAT_VERSION } from './schema.ts'
import { serializeDeckToSlaideFile } from './serialize.ts'

const deck: Deck = {
  id: 'deck-1',
  schemaVersion: 1,
  title: 'Demo deck',
  slideOrder: ['slide-2', 'slide-1'],
  createdAt: 100,
  updatedAt: 200,
}

const slideOne: Slide = {
  id: 'slide-1',
  schemaVersion: 1,
  deckId: 'deck-1',
  scene: {
    elements: [{ id: 'a', type: 'rectangle' }],
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
        fileId: 'file-1',
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

describe('serializeDeckToSlaideFile', () => {
  it('writes a versioned file with deck metadata and ordered slides', () => {
    const file = serializeDeckToSlaideFile(deck, [slideOne, slideTwo])

    expect(file.formatVersion).toBe(SLAIDE_FILE_FORMAT_VERSION)
    expect(file.deck).toEqual(deck)
    expect(file.slides.map((slide) => slide.id)).toEqual(['slide-2', 'slide-1'])
  })

  it('includes presenter notes when a slide has them', () => {
    const file = serializeDeckToSlaideFile(deck, [{ ...slideOne, notes: 'Cue' }, slideTwo])
    const exportedSlide = file.slides.find((slide) => slide.id === 'slide-1')

    expect(exportedSlide?.notes).toBe('Cue')
    expect(file.slides.find((slide) => slide.id === 'slide-2')?.notes).toBeUndefined()
  })

  it('embeds scene elements, app state, and binary files', () => {
    const file = serializeDeckToSlaideFile(deck, [slideOne, slideTwo])
    const exportedSlide = file.slides.find((slide) => slide.id === 'slide-2')

    expect(exportedSlide?.scene.elements).toEqual(slideTwo.scene.elements)
    expect(exportedSlide?.scene.appState).toEqual(slideTwo.scene.appState)
    expect(exportedSlide?.scene.files).toEqual(slideTwo.scene.files)
  })

  it('stores the selected theme in deck metadata when provided', () => {
    expect(serializeDeckToSlaideFile(deck, [slideOne, slideTwo], 'dark').deck.theme).toBe(
      'dark',
    )
    expect(serializeDeckToSlaideFile(deck, [slideOne, slideTwo], 'light').deck.theme).toBe(
      'light',
    )
  })

  it('omits the theme when none is provided', () => {
    expect(serializeDeckToSlaideFile(deck, [slideOne, slideTwo]).deck.theme).toBeUndefined()
  })

  it('rejects slides that do not belong to the deck', () => {
    const foreignSlide: Slide = {
      ...slideOne,
      id: 'slide-9',
      deckId: 'deck-2',
    }

    expect(() => serializeDeckToSlaideFile(deck, [slideOne, foreignSlide])).toThrow(
      /deck/i,
    )
  })

  it('rejects missing slides from slide order', () => {
    expect(() => serializeDeckToSlaideFile(deck, [slideOne])).toThrow(/slide-2/i)
  })
})
