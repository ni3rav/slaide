const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
const FALLBACK_TITLE = 'Untitled deck'

export function slaideExportFilename(deckTitle: string): string {
  return exportFilename(deckTitle, 'slaide')
}

export function pdfExportFilename(deckTitle: string): string {
  return exportFilename(deckTitle, 'pdf')
}

function exportFilename(deckTitle: string, extension: 'pdf' | 'slaide'): string {
  const sanitized = deckTitle
    .trim()
    .replace(UNSAFE_FILENAME_CHARS, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/\.+$/g, '')
    .trim()

  const baseName = sanitized.length > 0 ? sanitized : FALLBACK_TITLE
  return `${baseName}.${extension}`
}
