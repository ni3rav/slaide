export const MIN_SUPPORTED_VIEWPORT_WIDTH = 1024

export const VIEWPORT_BLOCKER_MESSAGE =
  'Slaide requires a larger screen. Please use a desktop computer.'

export function isViewportSupported(
  width: number,
  minWidth = MIN_SUPPORTED_VIEWPORT_WIDTH,
): boolean {
  return width >= minWidth
}
