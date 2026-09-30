export const MAX_PRESENTER_NOTES_LENGTH = 8_000

export function isPresenterNotesField(value: unknown): value is string | undefined {
  return value === undefined || isPresenterNotesText(value)
}

export function isPresenterNotesText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_PRESENTER_NOTES_LENGTH
}

export function readPresenterNotes(notes: string | undefined): string {
  return notes ?? ''
}
