export const PRESENTATION_WINDOW_RADIUS = 2

export function computePresentationWindowIndices(
  currentIndex: number,
  slideCount: number,
): number[] {
  if (slideCount <= 0) return []

  const start = Math.max(0, currentIndex - PRESENTATION_WINDOW_RADIUS)
  const end = Math.min(slideCount - 1, currentIndex + PRESENTATION_WINDOW_RADIUS)
  const indices: number[] = []

  for (let index = start; index <= end; index += 1) {
    indices.push(index)
  }

  return indices
}
