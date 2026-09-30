import { describe, expect, it } from 'vitest'
import {
  isPresenterNotesField,
  isPresenterNotesText,
  MAX_PRESENTER_NOTES_LENGTH,
  readPresenterNotes,
} from './presenter-notes.ts'

describe('presenter notes', () => {
  it('accepts omitted notes and text within the length limit', () => {
    expect(isPresenterNotesField(undefined)).toBe(true)
    expect(isPresenterNotesText('')).toBe(true)
    expect(isPresenterNotesText('a'.repeat(MAX_PRESENTER_NOTES_LENGTH))).toBe(true)
  })

  it('rejects non-text notes and text past the length limit', () => {
    expect(isPresenterNotesField(12)).toBe(false)
    expect(isPresenterNotesField(null)).toBe(false)
    expect(isPresenterNotesText('a'.repeat(MAX_PRESENTER_NOTES_LENGTH + 1))).toBe(false)
  })

  it('reads missing notes as an empty string', () => {
    expect(readPresenterNotes(undefined)).toBe('')
    expect(readPresenterNotes('Cue the demo')).toBe('Cue the demo')
  })
})
