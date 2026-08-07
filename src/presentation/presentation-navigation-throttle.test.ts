import { describe, expect, it } from 'vitest'
import {
  PRESENTATION_NAVIGATION_THROTTLE_MS,
  canAcceptPresentationNavigation,
} from './presentation-navigation-throttle.ts'

describe('canAcceptPresentationNavigation', () => {
  it('accepts the first navigation input immediately', () => {
    expect(canAcceptPresentationNavigation(null, 1_000)).toBe(true)
  })

  it('rejects navigation inside the throttle window', () => {
    const acceptedAt = 1_000
    expect(
      canAcceptPresentationNavigation(
        acceptedAt,
        acceptedAt + PRESENTATION_NAVIGATION_THROTTLE_MS - 1,
      ),
    ).toBe(false)
  })

  it('accepts navigation after the throttle window elapses', () => {
    const acceptedAt = 1_000
    expect(
      canAcceptPresentationNavigation(
        acceptedAt,
        acceptedAt + PRESENTATION_NAVIGATION_THROTTLE_MS,
      ),
    ).toBe(true)
  })
})
