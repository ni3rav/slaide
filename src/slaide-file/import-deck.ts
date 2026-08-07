import type { Deck, Slide } from '../storage/deck-repository.ts'
import {
  assertImportFileSize,
  parseSlaideFileText,
  remapSlaideFileForImport,
  validateSlaideFile,
} from './import.ts'

export async function prepareDeckImportFromFile(
  file: File,
  existingTitles: Iterable<string>,
): Promise<{ deck: Deck; slides: Slide[] }> {
  assertImportFileSize(file.size)
  const text = await file.text()
  const parsed = parseSlaideFileText(text)
  const validated = validateSlaideFile(parsed)
  return remapSlaideFileForImport(validated, existingTitles)
}

export function importErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Import failed'
}
