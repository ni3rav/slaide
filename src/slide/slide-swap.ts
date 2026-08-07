export type SlideId = string

export type SlideSwapPlan = {
  slideOrder: SlideId[]
  changed: boolean
}

export function planSlideSwap(
  slideOrder: readonly SlideId[],
  slideIdA: SlideId,
  slideIdB: SlideId,
): SlideSwapPlan {
  const indexA = slideOrder.indexOf(slideIdA)
  const indexB = slideOrder.indexOf(slideIdB)

  if (indexA === -1 || indexB === -1) {
    throw new Error('Slide not found in order')
  }

  if (indexA === indexB) {
    return { slideOrder: [...slideOrder], changed: false }
  }

  const nextOrder = [...slideOrder]
  nextOrder[indexA] = slideIdB
  nextOrder[indexB] = slideIdA

  return { slideOrder: nextOrder, changed: true }
}
