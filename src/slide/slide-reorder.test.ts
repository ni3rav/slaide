import { describe, expect, it } from 'vitest'
import { planSlideInsertion } from './slide-reorder.ts'

describe('planSlideInsertion', () => {
  const slides = ['a', 'b', 'c', 'd'] as const

  it('moves a slide downward by insertion between later rows', () => {
    const plan = planSlideInsertion(slides, 'a', 2)

    expect(plan.slideOrder).toEqual(['b', 'a', 'c', 'd'])
    expect(plan.changed).toBe(true)
  })

  it('moves a slide upward by insertion before earlier rows', () => {
    const plan = planSlideInsertion(slides, 'd', 0)

    expect(plan.slideOrder).toEqual(['d', 'a', 'b', 'c'])
    expect(plan.changed).toBe(true)
  })

  it('moves a slide to the end boundary', () => {
    const plan = planSlideInsertion(slides, 'a', 4)

    expect(plan.slideOrder).toEqual(['b', 'c', 'd', 'a'])
    expect(plan.changed).toBe(true)
  })

  it('moves a slide to the start boundary', () => {
    const plan = planSlideInsertion(slides, 'c', 0)

    expect(plan.slideOrder).toEqual(['c', 'a', 'b', 'd'])
    expect(plan.changed).toBe(true)
  })

  it('is a no-op when the insertion point keeps the slide in place', () => {
    expect(planSlideInsertion(slides, 'b', 1)).toEqual({
      slideOrder: ['a', 'b', 'c', 'd'],
      changed: false,
    })
    expect(planSlideInsertion(slides, 'b', 2)).toEqual({
      slideOrder: ['a', 'b', 'c', 'd'],
      changed: false,
    })
  })

  it('is a no-op for a single-slide deck', () => {
    expect(planSlideInsertion(['solo'], 'solo', 0)).toEqual({
      slideOrder: ['solo'],
      changed: false,
    })
    expect(planSlideInsertion(['solo'], 'solo', 1)).toEqual({
      slideOrder: ['solo'],
      changed: false,
    })
  })

  it('moves a checked slide without affecting other ids', () => {
    const plan = planSlideInsertion(slides, 'b', 3)

    expect(plan.slideOrder).toEqual(['a', 'c', 'b', 'd'])
    expect(plan.changed).toBe(true)
  })
})
