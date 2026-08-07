export type SlideId = string

export type SlideDeletionPlan = {
  slideOrder: SlideId[]
  nextActiveSlideId: SlideId | null
  deletedSlideIds: SlideId[]
  requiresBlankSlide: boolean
}

export function planSlideDeletion(
  slideOrder: readonly SlideId[],
  activeSlideId: SlideId,
  slideIdsToDelete: readonly SlideId[],
): SlideDeletionPlan {
  const deleteSet = new Set(slideIdsToDelete)
  const deletedSlideIds = slideOrder.filter((id) => deleteSet.has(id))
  const nextOrder = slideOrder.filter((id) => !deleteSet.has(id))

  if (nextOrder.length === 0) {
    return {
      slideOrder: [],
      nextActiveSlideId: null,
      deletedSlideIds,
      requiresBlankSlide: true,
    }
  }

  if (!deleteSet.has(activeSlideId)) {
    return {
      slideOrder: nextOrder,
      nextActiveSlideId: activeSlideId,
      deletedSlideIds,
      requiresBlankSlide: false,
    }
  }

  const activeIndex = slideOrder.indexOf(activeSlideId)
  let nextActiveSlideId: SlideId | null = null

  for (let index = activeIndex; index < slideOrder.length; index += 1) {
    const slideId = slideOrder[index]!
    if (!deleteSet.has(slideId)) {
      nextActiveSlideId = slideId
      break
    }
  }

  if (!nextActiveSlideId) {
    for (let index = activeIndex - 1; index >= 0; index -= 1) {
      const slideId = slideOrder[index]!
      if (!deleteSet.has(slideId)) {
        nextActiveSlideId = slideId
        break
      }
    }
  }

  return {
    slideOrder: nextOrder,
    nextActiveSlideId,
    deletedSlideIds,
    requiresBlankSlide: false,
  }
}
