import { describe, expect, it } from 'vitest'
import { planSlideDuplication } from './slide-duplication.ts'

describe('planSlideDuplication', () => {
  const slides = ['a', 'b', 'c', 'd'] as const

  it('inserts one copy directly after its source', () => {
    const plan = planSlideDuplication(slides, ['b'], () => 'b-copy')

    expect(plan.slideOrder).toEqual(['a', 'b', 'b-copy', 'c', 'd'])
    expect(plan.copies).toEqual([{ sourceId: 'b', copyId: 'b-copy' }])
  })

  it('preserves source order for nonadjacent selections', () => {
    let next = 0
    const plan = planSlideDuplication(slides, ['a', 'c'], () => `copy-${next++}`)

    expect(plan.slideOrder).toEqual(['a', 'copy-0', 'b', 'c', 'copy-1', 'd'])
    expect(plan.copies).toEqual([
      { sourceId: 'a', copyId: 'copy-0' },
      { sourceId: 'c', copyId: 'copy-1' },
    ])
  })

  it('preserves source order for adjacent selections', () => {
    let next = 0
    const plan = planSlideDuplication(['a', 'b', 'c'], ['a', 'b'], () => `copy-${next++}`)

    expect(plan.slideOrder).toEqual(['a', 'copy-0', 'b', 'copy-1', 'c'])
    expect(plan.copies).toEqual([
      { sourceId: 'a', copyId: 'copy-0' },
      { sourceId: 'b', copyId: 'copy-1' },
    ])
  })

  it('uses slide order rather than selection order', () => {
    let next = 0
    const plan = planSlideDuplication(slides, ['c', 'a'], () => `copy-${next++}`)

    expect(plan.slideOrder).toEqual(['a', 'copy-0', 'b', 'c', 'copy-1', 'd'])
    expect(plan.copies.map((copy) => copy.sourceId)).toEqual(['a', 'c'])
  })

  it('throws when a selected slide is missing from slide order', () => {
    expect(() => planSlideDuplication(slides, ['missing'], () => 'copy')).toThrow(
      'Slide not found in order',
    )
  })
})
