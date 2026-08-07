import { describe, expect, it } from 'vitest'
import { pdfExportFilename, slaideExportFilename } from './filename.ts'

describe('slaideExportFilename', () => {
  it('uses the deck title with a .slaide extension', () => {
    expect(slaideExportFilename('Quarterly review')).toBe('Quarterly review.slaide')
  })

  it('replaces filesystem-unsafe characters', () => {
    expect(slaideExportFilename('Q1: Sales / Forecast')).toBe('Q1_ Sales _ Forecast.slaide')
  })

  it('falls back when the title is empty after sanitization', () => {
    expect(slaideExportFilename('   ')).toBe('Untitled deck.slaide')
    expect(slaideExportFilename('///')).toBe('Untitled deck.slaide')
  })

  it('trims surrounding whitespace', () => {
    expect(slaideExportFilename('  My deck  ')).toBe('My deck.slaide')
  })
})

describe('pdfExportFilename', () => {
  it('uses the existing sanitization with a .pdf extension', () => {
    expect(pdfExportFilename('Q1: Sales / Forecast')).toBe(
      'Q1_ Sales _ Forecast.pdf',
    )
  })
})
