import { describe, expect, it } from 'vitest'
import {
  CONTRAST_BASELINE,
  contrastRatio,
  parseCssRgb,
  relativeLuminance,
} from './contrast.ts'

describe('contrast helpers', () => {
  it('parses rgb and rgba CSS colors', () => {
    expect(parseCssRgb('rgb(36, 41, 66)')).toEqual({ r: 36, g: 41, b: 66 })
    expect(parseCssRgb('rgba(255, 255, 255, 0.9)')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseCssRgb('oklch(0.5 0.1 120)')).toBeNull()
  })

  it('computes WCAG relative luminance extremes', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1)
  })

  it('requires at least the AA normal-text baseline for black on white', () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })
    expect(ratio).toBeCloseTo(21)
    expect(ratio).toBeGreaterThanOrEqual(CONTRAST_BASELINE)
  })
})
