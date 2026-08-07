import { describe, expect, it } from 'vitest'
import { resolveTheme } from './theme-policy.ts'

describe('theme policy', () => {
  it('follows the system theme when no explicit preference exists', () => {
    expect(resolveTheme(null, false)).toBe('light')
    expect(resolveTheme(null, true)).toBe('dark')
  })

  it('uses an explicit light or dark preference over the system theme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
