import { describe, expect, it } from 'vitest'
import {
  PRESENTATION_WINDOW_RADIUS,
  computePresentationWindowIndices,
} from './presentation-window.ts'

describe('computePresentationWindowIndices', () => {
  it('returns an empty list for zero slides', () => {
    expect(computePresentationWindowIndices(0, 0)).toEqual([])
  })

  it('returns only the current slide for a single-slide deck', () => {
    expect(computePresentationWindowIndices(0, 1)).toEqual([0])
  })

  it('keeps the current slide centered with two neighbors on each side', () => {
    expect(computePresentationWindowIndices(4, 10)).toEqual([2, 3, 4, 5, 6])
  })

  it('clips the window at the start of the deck', () => {
    expect(computePresentationWindowIndices(0, 10)).toEqual([0, 1, 2])
    expect(computePresentationWindowIndices(1, 10)).toEqual([0, 1, 2, 3])
  })

  it('clips the window at the end of the deck', () => {
    expect(computePresentationWindowIndices(9, 10)).toEqual([7, 8, 9])
    expect(computePresentationWindowIndices(8, 10)).toEqual([6, 7, 8, 9])
  })

  it('never returns more than radius slides on each side plus the current slide', () => {
    const indices = computePresentationWindowIndices(5, 20)
    expect(indices.length).toBeLessThanOrEqual(PRESENTATION_WINDOW_RADIUS * 2 + 1)
    expect(indices).toEqual([3, 4, 5, 6, 7])
  })
})
