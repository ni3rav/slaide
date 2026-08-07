export type FullscreenRequestResult =
  | { status: 'entered' }
  | { status: 'denied' }

export async function requestPresentationFullscreen(
  element: HTMLElement,
): Promise<FullscreenRequestResult> {
  try {
    await element.requestFullscreen()
    return { status: 'entered' }
  } catch {
    return { status: 'denied' }
  }
}

export async function exitPresentationFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch {
      // Ignore exit failures during teardown.
    }
  }
}
