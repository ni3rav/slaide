import { describe, expect, it } from 'vitest'
import {
  isViewportSupported,
  MIN_SUPPORTED_VIEWPORT_WIDTH,
  VIEWPORT_BLOCKER_MESSAGE,
} from './viewport-policy.ts'

describe('viewport policy', () => {
  it('requires at least 1024 pixels', () => {
    expect(MIN_SUPPORTED_VIEWPORT_WIDTH).toBe(1024)
  })

  it('blocks viewports below the threshold', () => {
    expect(isViewportSupported(1023)).toBe(false)
    expect(isViewportSupported(320)).toBe(false)
  })

  it('allows viewports at and above the threshold', () => {
    expect(isViewportSupported(1024)).toBe(true)
    expect(isViewportSupported(1440)).toBe(true)
  })

  it('uses the approved larger-screen message', () => {
    expect(VIEWPORT_BLOCKER_MESSAGE).toBe(
      '💅 requires a larger screen. Please use a desktop computer.',
    )
  })
})
