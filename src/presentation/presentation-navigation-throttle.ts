export const PRESENTATION_NAVIGATION_THROTTLE_MS = 300

export function canAcceptPresentationNavigation(
  lastAcceptedAt: number | null,
  now: number,
  throttleMs: number = PRESENTATION_NAVIGATION_THROTTLE_MS,
): boolean {
  if (lastAcceptedAt === null) return true
  return now - lastAcceptedAt >= throttleMs
}
