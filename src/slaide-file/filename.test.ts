import { describe, expect, it } from 'vitest'
import { slaideExportFilename } from './filename.ts'

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
