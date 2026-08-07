import { describe, expect, it } from 'vitest'
import { planSlideDeletion } from './slide-deletion.ts'

describe('planSlideDeletion', () => {
  const slides = ['a', 'b', 'c', 'd'] as const

  it('removes deleted ids from slide order while keeping the active slide', () => {
    const plan = planSlideDeletion(slides, 'b', ['a', 'c'])

    expect(plan.slideOrder).toEqual(['b', 'd'])
    expect(plan.nextActiveSlideId).toBe('b')
    expect(plan.deletedSlideIds).toEqual(['a', 'c'])
    expect(plan.requiresBlankSlide).toBe(false)
  })

  it('activates the slide that followed the deleted active slide', () => {
    const plan = planSlideDeletion(slides, 'b', ['b'])

    expect(plan.slideOrder).toEqual(['a', 'c', 'd'])
    expect(plan.nextActiveSlideId).toBe('c')
    expect(plan.requiresBlankSlide).toBe(false)
  })

  it('activates the preceding slide when the deleted active slide was last', () => {
    const plan = planSlideDeletion(slides, 'd', ['d'])

    expect(plan.slideOrder).toEqual(['a', 'b', 'c'])
    expect(plan.nextActiveSlideId).toBe('c')
    expect(plan.requiresBlankSlide).toBe(false)
  })

  it('selects the slide at the active index after deleting the active slide and later selections', () => {
    const plan = planSlideDeletion(slides, 'b', ['b', 'c'])

    expect(plan.slideOrder).toEqual(['a', 'd'])
    expect(plan.nextActiveSlideId).toBe('d')
    expect(plan.requiresBlankSlide).toBe(false)
  })

  it('activates a remaining middle slide when deleting outer selections while active is last', () => {
    const plan = planSlideDeletion(slides, 'd', ['a', 'd'])

    expect(plan.slideOrder).toEqual(['b', 'c'])
    expect(plan.nextActiveSlideId).toBe('c')
    expect(plan.requiresBlankSlide).toBe(false)
  })

  it('requires a blank slide when every slide is deleted', () => {
    const plan = planSlideDeletion(slides, 'c', ['a', 'b', 'c', 'd'])

    expect(plan.slideOrder).toEqual([])
    expect(plan.nextActiveSlideId).toBeNull()
    expect(plan.deletedSlideIds).toEqual(['a', 'b', 'c', 'd'])
    expect(plan.requiresBlankSlide).toBe(true)
  })

  it('requires a blank slide when deleting the only slide', () => {
    const plan = planSlideDeletion(['solo'], 'solo', ['solo'])

    expect(plan.slideOrder).toEqual([])
    expect(plan.nextActiveSlideId).toBeNull()
    expect(plan.requiresBlankSlide).toBe(true)
  })
})
