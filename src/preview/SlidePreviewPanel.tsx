import { useEffect, useRef } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SlidePreviewPanelState =
  | 'loading'
  | 'ready'
  | 'error'

type SlidePreviewPanelProps = {
  slideNumber: number
  state: SlidePreviewPanelState
  imageUrl: string | null
  onRetry: () => void
}

export function SlidePreviewPanel({
  slideNumber,
  state,
  imageUrl,
  onRetry,
}: SlidePreviewPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const image = panel.querySelector('img')
    const panelRect = panel.getBoundingClientRect()
    const panelStyle = getComputedStyle(panel)
    const centerX = panelRect.left + panelRect.width / 2
    const centerY = panelRect.top + panelRect.height / 2
    const coveringElement =
      panelRect.width > 0 && panelRect.height > 0
        ? document.elementFromPoint(centerX, centerY)
        : null
    // #region agent log
    void fetch('/__agent-debug-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hypothesisId: 'D,E',
        location: 'SlidePreviewPanel.tsx:render',
        message: 'Preview panel committed to DOM',
        data: {
          state,
          hasImageUrl: imageUrl != null,
          panelRect: {
            width: panelRect.width,
            height: panelRect.height,
            x: panelRect.x,
            y: panelRect.y,
          },
          panelDisplay: panelStyle.display,
          panelVisibility: panelStyle.visibility,
          panelOpacity: panelStyle.opacity,
          panelZIndex: panelStyle.zIndex,
          coveringTag: coveringElement?.tagName ?? null,
          coveringTestId: coveringElement?.getAttribute('data-testid') ?? null,
          imagePresent: image != null,
          imageComplete: image?.complete ?? null,
          imageNaturalWidth: image?.naturalWidth ?? null,
          imageNaturalHeight: image?.naturalHeight ?? null,
        },
        timestamp: Date.now(),
      }),
    })
    // #endregion
  }, [imageUrl, state])

  return (
    <div
      ref={panelRef}
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-md bg-card"
      data-testid="slide-preview-panel"
      data-preview-state={state}
      aria-label={`Preview for slide ${slideNumber}`}
    >
      {state === 'loading' ? (
        <div className="flex size-full items-center justify-center">
          <LoaderCircle
            className="size-5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">Generating preview</span>
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="pointer-events-auto flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
          <p className="m-0 text-xs text-destructive">Preview failed</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {state === 'ready' && imageUrl ? (
        <img
          src={imageUrl}
          alt={`Slide ${slideNumber} preview`}
          className="size-full object-contain"
          data-testid="slide-preview-image"
          width={1920}
          height={1080}
        />
      ) : null}
    </div>
  )
}
