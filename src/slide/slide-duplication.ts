export type SlideId = string

export type SlideDuplicationPlan = {
  slideOrder: SlideId[]
  copies: Array<{ sourceId: SlideId; copyId: SlideId }>
}

export function planSlideDuplication(
  slideOrder: readonly SlideId[],
  slideIdsToDuplicate: readonly SlideId[],
  createId: () => SlideId = () => crypto.randomUUID(),
): SlideDuplicationPlan {
  const duplicateSet = new Set(slideIdsToDuplicate)
  const sourcesInOrder = slideOrder.filter((id) => duplicateSet.has(id))

  if (sourcesInOrder.length !== slideIdsToDuplicate.length) {
    throw new Error('Slide not found in order')
  }

  const copies = sourcesInOrder.map((sourceId) => ({
    sourceId,
    copyId: createId(),
  }))

  const nextOrder = [...slideOrder]
  for (let index = copies.length - 1; index >= 0; index -= 1) {
    const { sourceId, copyId } = copies[index]!
    const sourceIndex = nextOrder.indexOf(sourceId)
    nextOrder.splice(sourceIndex + 1, 0, copyId)
  }

  return { slideOrder: nextOrder, copies }
}
