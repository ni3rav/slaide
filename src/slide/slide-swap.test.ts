import { describe, expect, it } from 'vitest'
import { planSlideSwap } from './slide-swap.ts'

describe('planSlideSwap', () => {
  const slides = ['a', 'b', 'c', 'd'] as const

  it('exchanges only the two selected positions', () => {
    const plan = planSlideSwap(slides, 'a', 'c')

    expect(plan.slideOrder).toEqual(['c', 'b', 'a', 'd'])
    expect(plan.changed).toBe(true)
  })

  it('leaves slide order unchanged when both ids are the same', () => {
    const plan = planSlideSwap(slides, 'b', 'b')

    expect(plan.slideOrder).toEqual([...slides])
    expect(plan.changed).toBe(false)
  })

  it('swaps adjacent slides', () => {
    const plan = planSlideSwap(slides, 'b', 'c')

    expect(plan.slideOrder).toEqual(['a', 'c', 'b', 'd'])
    expect(plan.changed).toBe(true)
  })

  it('throws when a slide is missing from slide order', () => {
    expect(() => planSlideSwap(slides, 'a', 'missing')).toThrow('Slide not found in order')
  })
})
