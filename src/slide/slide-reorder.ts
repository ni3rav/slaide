export type SlideId = string

export type SlideInsertionPlan = {
  slideOrder: SlideId[]
  changed: boolean
}

export function planSlideInsertion(
  slideOrder: readonly SlideId[],
  slideId: SlideId,
  insertionIndex: number,
): SlideInsertionPlan {
  const fromIndex = slideOrder.indexOf(slideId)
  if (fromIndex === -1) {
    throw new Error('Slide not found in order')
  }

  if (insertionIndex < 0 || insertionIndex > slideOrder.length) {
    throw new Error('Insertion index out of bounds')
  }

  if (insertionIndex === fromIndex || insertionIndex === fromIndex + 1) {
    return { slideOrder: [...slideOrder], changed: false }
  }

  const withoutSlide = slideOrder.filter((id) => id !== slideId)
  const adjustedIndex =
    insertionIndex > fromIndex ? insertionIndex - 1 : insertionIndex
  const nextOrder = [...withoutSlide]
  nextOrder.splice(adjustedIndex, 0, slideId)

  return { slideOrder: nextOrder, changed: true }
}
